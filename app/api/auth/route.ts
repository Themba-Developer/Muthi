import {env} from 'cloudflare:workers';
import {testAccounts,testLoginEnabled,verifyTestPassword,digest,sessionToken,cookie} from '../../../lib/test-auth';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200,headers:Record<string,string>={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
export async function POST(req:Request){
 if(!testLoginEnabled())return response({error:'Use the Cloudflare preview for test sign-in.'},403);
 if(req.headers.get('origin')!==new URL(req.url).origin)return response({error:'Request not permitted.'},403);
 try{
 const b=await req.json() as any;
 if(b.action==='logout'){
  const token=sessionToken(req.headers.get('cookie'));if(token)await env.DB!.prepare('DELETE FROM sessions WHERE id=?').bind(await digest(token)).run();
  return response({ok:true},200,{'Set-Cookie':cookie('',req,0)});
 }
 const email=String(b.email||'').trim().toLowerCase();const password=String(b.password||'');
 if(password.length>128||email.length>254)return response({error:'Email or password is incorrect.'},401);
 const valid=await verifyTestPassword(password);
 if(!valid||!testAccounts[email])return response({error:'Email or password is incorrect.'},401);
 const previous=sessionToken(req.headers.get('cookie'));if(previous)await env.DB!.prepare('DELETE FROM sessions WHERE id=?').bind(await digest(previous)).run();
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
 await env.DB!.batch([env.DB!.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(Date.now()),env.DB!.prepare('INSERT INTO sessions(id,email,expires_at) VALUES(?,?,?)').bind(await digest(token),email,Date.now()+7*86400000)]);
 return response({ok:true,role:testAccounts[email].role},200,{'Set-Cookie':cookie(token,req,7*86400)});
 }catch(e){console.error(e);return response({error:'Sign-in is temporarily unavailable. Please try again.'},500)}
}
