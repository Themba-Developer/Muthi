import { env } from 'cloudflare:workers';
export async function settlePayment(reference:string,amount:number,currency:string){
 const db=env.DB!;const row=await db.prepare('SELECT data FROM orders WHERE id=?').bind(reference).first<{data:string}>();
 if(!row)return false;const order=JSON.parse(row.data);
 if(currency!=='ZAR'||amount!==Math.round(order.total*100))return false;
 if(order.status==='Paid')return true;
 // D1 batches run in a transaction. Update stock only while the order is unpaid;
 // marking it paid last makes both webhook and browser verification idempotent.
 const statements=order.items.map((i:any)=>db.prepare("UPDATE products SET data=json_set(data,'$.stock',MAX(0,CAST(json_extract(data,'$.stock') AS INTEGER)-?)) WHERE id=? AND EXISTS(SELECT 1 FROM orders WHERE id=? AND json_extract(data,'$.status')!='Paid')").bind(i.qty,i.id,reference));
 order.status='Paid';statements.push(db.prepare("UPDATE orders SET data=? WHERE id=? AND json_extract(data,'$.status')!='Paid'").bind(JSON.stringify(order),reference));
 await db.batch(statements);return true;
}
