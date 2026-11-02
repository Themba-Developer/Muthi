import {env} from 'cloudflare:workers';
import {settlePayment} from '../../../../lib/payments';
export async function POST(req:Request){
 const secret=(env as unknown as Record<string,string>).PAYSTACK_SECRET_KEY;
 if(!secret)return new Response('Payments unavailable',{status:503});
 const body=await req.text();const signature=req.headers.get('x-paystack-signature');
 if(!signature||!/^[a-f0-9]{128}$/.test(signature))return new Response('Invalid signature',{status:401});
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-512'},false,['verify']);
 const bytes=Uint8Array.from(signature.match(/.{2}/g)!,x=>parseInt(x,16));
 if(!await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(body)))return new Response('Invalid signature',{status:401});
 try{const event=JSON.parse(body);if(event.event==='charge.success'&&event.data?.status==='success'){await settlePayment(event.data.reference,event.data.amount,event.data.currency)}return new Response('OK')}catch{return new Response('Processing failed',{status:500})}
}
