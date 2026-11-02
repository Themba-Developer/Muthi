import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {getChatGPTUser} from '../app/chatgpt-auth';
export const testAccounts:Record<string,{name:string;role:string}>={
 'mahlangu843@gmail.com':{name:'Muthi Admin',role:'admin'},
 'vertcorpgroup@gmail.com':{name:'Vert Corp Group',role:'shopper'}
};
export const testLoginEnabled=()=> (env as unknown as Record<string,string>).DIRECT_PREVIEW==='true';
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('')}
export async function verifyTestPassword(password:string){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode('muthi-test-access-v1'),iterations:100000,hash:'SHA-256'},key,256);
 const actual=Array.from(new Uint8Array(bits),n=>n.toString(16).padStart(2,'0')).join('');
 const expected='20243682d2f66390d516294d0c650347c27deb381f6c4202b809ee1616bebf33';
 let difference=0;for(let i=0;i<expected.length;i++)difference|=actual.charCodeAt(i)^expected.charCodeAt(i);return difference===0;
}
export function sessionToken(cookie:string|null){return cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('muthi_session='))?.slice('muthi_session='.length)||''}
export async function getStoreUser(){
 if(!testLoginEnabled())return getChatGPTUser();
 const token=sessionToken((await headers()).get('cookie'));if(!/^[a-f0-9]{64}$/.test(token))return null;
 const row=await env.DB!.prepare('SELECT email FROM sessions WHERE id=? AND expires_at>?').bind(await digest(token),Date.now()).first<{email:string}>();
 if(!row||!testAccounts[row.email])return null;
 const account=testAccounts[row.email];return {userId:'test:'+row.email,email:row.email,fullName:account.name,displayName:account.name};
}
export function cookie(value:string,req:Request,maxAge:number){return `muthi_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(req.url).protocol==='https:'?'; Secure':''}`}
