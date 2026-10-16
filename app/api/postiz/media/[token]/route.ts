import {database,bucket} from '@/db/store';
import {digest} from '@/db/postiz';
export const dynamic='force-dynamic';
type Route={params:Promise<{token:string}>};
// Only media explicitly selected by the owner is available during the Postiz transfer.
export async function GET(_req:Request,route:Route){
 const{token}=await route.params;if(!/^[a-f0-9]{64}$/.test(token))return new Response(null,{status:404});
 try{const asset=await database().prepare("SELECT a.object_key,a.content_type FROM publish_media m JOIN post_assets a ON a.id=m.asset_id AND a.owner=m.owner JOIN posts p ON p.id=a.post_id AND p.owner=a.owner JOIN publish_jobs j ON j.id=m.job_id AND j.owner=m.owner WHERE m.token_hash=? AND m.expires_at>? AND a.kind='design' AND j.state='preparing'").bind(await digest(token),Date.now()).first<{object_key:string;content_type:string}>();if(!asset)return new Response(null,{status:404});const object=await bucket().get(asset.object_key);if(!object)return new Response(null,{status:404});return new Response(object.body,{headers:{'Content-Type':asset.content_type,'Content-Length':String(object.size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'"}});}catch{return new Response(null,{status:503,headers:{'Cache-Control':'no-store'}});}
}
export async function HEAD(req:Request,route:Route){const response=await GET(req,route);return new Response(null,{status:response.status,headers:response.headers});}
