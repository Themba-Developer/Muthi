import { env } from 'cloudflare:workers';
import { getStoreUser, testLoginEnabled } from '../../../lib/test-auth';
import { initialProducts, categories, type Product } from '../../../lib/catalog';
import {settlePayment} from '../../../lib/payments';
export const dynamic='force-dynamic';
const adminEmail='mahlangu843@gmail.com';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function catalog():Promise<Product[]>{const rows=await env.DB!.prepare('SELECT data FROM products').all<{data:string}>();return rows.results.length?rows.results.map(x=>JSON.parse(x.data)):initialProducts;}
export async function GET(){try{
 const user=await getStoreUser(); const products=await catalog();
 if(!user)return json({products,user:null,admin:false});
 const admin=user.email.toLowerCase()===adminEmail;
 const profile=await env.DB!.prepare('SELECT data FROM profiles WHERE id=?').bind(user.userId).first<{data:string}>();
 const cart=await env.DB!.prepare('SELECT data FROM carts WHERE id=?').bind(user.userId).first<{data:string}>();
 const rows=admin?await env.DB!.prepare('SELECT id,data FROM orders ORDER BY created_at DESC LIMIT 100').all():await env.DB!.prepare('SELECT id,data FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(user.userId).all();
 return json({products,user:{name:user.fullName||'',email:user.email},admin,profile:profile?JSON.parse(profile.data):{},cart:cart?JSON.parse(cart.data):[],orders:rows.results.map((r:any)=>({id:r.id,...JSON.parse(r.data)}))});
 }catch(e){console.error(e);return json({error:'We could not load your account. Please try again.'},500);}}
export async function POST(req:Request){try{
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Request not permitted.'},403);
 const user=await getStoreUser(); if(!user)return json({error:'Please sign in to continue.'},401);
 const b=await req.json() as any; const db=env.DB!;
 if(b.action==='profile'){
  const p=b.profile||{};if(typeof p.email!=='string'||!/^\S+@\S+\.\S+$/.test(p.email))return json({error:'Enter a valid email address.'},400);
  const profile={name:String(p.name||'').slice(0,120),email:p.email.slice(0,254),phone:String(p.phone||'').slice(0,30),address:String(p.address||'').slice(0,400),city:String(p.city||'').slice(0,100),province:String(p.province||'').slice(0,100),postalCode:String(p.postalCode||'').slice(0,10),marketing:!!p.marketing};
  await db.prepare('INSERT INTO profiles(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind(user.userId,JSON.stringify(profile)).run();return json({ok:true});
 }
 if(b.action==='cart'){
  if(!Array.isArray(b.cart)||b.cart.length>100)return json({error:'Invalid basket.'},400);
  const products=await catalog();const cart=b.cart.filter((x:any)=>products.some(p=>p.id===x.id)&&Number.isInteger(x.qty)&&x.qty>0&&x.qty<=99).map((x:any)=>({id:x.id,qty:x.qty}));
  await db.prepare('INSERT INTO carts(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind(user.userId,JSON.stringify(cart)).run();return json({ok:true});
 }
 if(b.action==='delete-account'){
  if(testLoginEnabled())await db.prepare('DELETE FROM sessions WHERE email=?').bind(user.email).run();
  await db.batch([db.prepare('DELETE FROM profiles WHERE id=?').bind(user.userId),db.prepare('DELETE FROM carts WHERE id=?').bind(user.userId),db.prepare('DELETE FROM orders WHERE user_id=?').bind(user.userId)]);return json({ok:true});
 }
 if(b.action==='product'){
  if(user.email.toLowerCase()!==adminEmail)return json({error:'Administrator access required.'},403);
  const p=b.product as Product;if(!p||typeof p.name!=='string'||!p.name.trim()||p.name.length>120||typeof p.description!=='string'||p.description.length>5000||!Number.isFinite(p.price)||p.price<=0||p.price>100000||!Number.isInteger(p.stock)||p.stock<0||!categories.slice(1).includes(p.category))return json({error:'Check the product name, description, price, category and stock.'},400);
  const count=await db.prepare('SELECT COUNT(*) AS n FROM products').first<{n:number}>();if(!count?.n)await db.batch(initialProducts.map(p=>db.prepare('INSERT INTO products(id,data) VALUES(?,?)').bind(p.id,JSON.stringify(p))));
  const safe={id:String(p.id||crypto.randomUUID()).slice(0,100),name:p.name.trim(),description:p.description,subtitle:String(p.subtitle||'').slice(0,160),price:Math.round(p.price*100)/100,stock:p.stock,category:p.category,size:String(p.size||'').slice(0,50),tone:['sage','olive','amber','rose','clay','rust'].includes(p.tone)?p.tone:'sage',kind:['pouch','jar','bottle','bundle','bowl','soap'].includes(p.kind)?p.kind:'pouch',featured:!!p.featured};
  await db.prepare('INSERT INTO products(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind(safe.id,JSON.stringify(safe)).run();return json({ok:true});
 }
 if(b.action==='checkout'){
  const secret=(env as unknown as Record<string,string>).PAYSTACK_SECRET_KEY;
  if(!secret)return json({error:'Online payments are not available yet. Save your basket and check back shortly.'},503);
  if(!Array.isArray(b.cart)||!b.cart.length||b.cart.length>100)return json({error:'Your basket is empty.'},400);
  const products=await catalog();const ids=new Set();let subtotal=0;const items=[];
  for(const i of b.cart){const p=products.find(p=>p.id===i.id);if(!p||ids.has(i.id)||!Number.isInteger(i.qty)||i.qty<1||i.qty>p.stock)return json({error:'An item is unavailable in the selected quantity. Please update your basket.'},400);ids.add(i.id);subtotal+=Math.round(p.price*100)*i.qty;items.push({id:p.id,name:p.name,price:p.price,qty:i.qty});}
  const row=await db.prepare('SELECT data FROM profiles WHERE id=?').bind(user.userId).first<{data:string}>();const profile=row?JSON.parse(row.data):{};
  if(!profile.address||!profile.city||!profile.postalCode||!profile.name||!profile.email)return json({error:'Add your contact details and delivery address in My account before checking out.'},400);
  const count=await db.prepare('SELECT COUNT(*) AS n FROM products').first<{n:number}>();if(!count?.n)await db.batch(initialProducts.map(p=>db.prepare('INSERT OR IGNORE INTO products(id,data) VALUES(?,?)').bind(p.id,JSON.stringify(p))));
  const total=subtotal+(subtotal>=50000?0:7500);const reference='MUTHI-'+crypto.randomUUID();
  const result=await fetch('https://api.paystack.co/transaction/initialize',{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify({email:profile.email,amount:total,currency:'ZAR',reference,callback_url:new URL('/?payment=verify',req.url).href,metadata:{order:reference}})});const pay=await result.json() as any;
  if(!result.ok||!pay.status)return json({error:'Payment could not be started. Please try again.'},502);
  await db.prepare('INSERT INTO orders(id,user_id,data,created_at) VALUES(?,?,?,?)').bind(reference,user.userId,JSON.stringify({items,total:total/100,status:'Awaiting payment',address:profile,createdAt:Date.now()}),Date.now()).run();return json({url:pay.data.authorization_url});
 }
 if(b.action==='verify'){
  if(typeof b.reference!=='string'||!/^MUTHI-[a-f0-9-]{36}$/.test(b.reference))return json({error:'Invalid payment reference.'},400);
  const row=await db.prepare('SELECT data FROM orders WHERE id=? AND user_id=?').bind(b.reference,user.userId).first<{data:string}>();if(!row)return json({error:'Order not found.'},404);
  const secret=(env as unknown as Record<string,string>).PAYSTACK_SECRET_KEY;if(!secret)return json({error:'Payments are not configured.'},503);
  const response=await fetch('https://api.paystack.co/transaction/verify/'+encodeURIComponent(b.reference),{headers:{Authorization:`Bearer ${secret}`}});const result=await response.json() as any;const order=JSON.parse(row.data);
  if(result.data?.status==='success'&&result.data.currency==='ZAR'&&result.data.amount===Math.round(order.total*100)&&result.data.reference===b.reference){await settlePayment(b.reference,result.data.amount,result.data.currency);await db.prepare('DELETE FROM carts WHERE id=?').bind(user.userId).run();return json({ok:true});}return json({error:'Payment has not been confirmed. Your order remains awaiting payment.'},400);
 }
 return json({error:'Unknown request.'},400);
 }catch(e){console.error(e);return json({error:'Your request could not be completed. Please try again.'},500);}}
