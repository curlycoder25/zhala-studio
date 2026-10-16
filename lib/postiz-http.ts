import {env} from 'cloudflare:workers';
import {z} from 'zod';
import type {ConnectorResult,Json} from './connectors';
import {bucket} from '@/db/store';
export type UploadedPostizMedia={id?:string;path:string};
export type PostizHttpOptions={channelId?:string;platform?:string;media?:UploadedPostizMedia[]};
export class PostizApiError extends Error{
 providerStatus?:number;
 operation?:string;
 constructor(message:string,public httpStatus=502,public setupRequired=false,public retryAfterMs?:number,public confirmedRejected=false){super(message);}
}
function configuredApiKey(){
 const values=env as unknown as Record<string,unknown>;
 for(const name of ['POSTIZ_API_KEY','postiz']){const value=values[name];if(typeof value==='string'&&value.trim())return value.trim();}
 return '';
}
export function postizApiConfigured(){return configuredApiKey().length>0;}
function apiKey(){const key=configuredApiKey();if(!key||key.length>5000||/[\s\x00-\x1f\x7f]/.test(key))throw new PostizApiError('Postiz API anahtarı sitenin gizli ayarına tanımlanmalı.',503,true,undefined,true);return key;}
const API='https://api.postiz.com/public/v1/';
function result(raw:unknown,value:unknown){return{value,envelope:{status:'success',result:{content:[],structuredContent:raw as Json}} as Extract<ConnectorResult,{status:'success'}>};}
async function request(path:string,options:RequestInit={}){
 const key=apiKey();let response:Response;
 const operation=path.split(/[/?]/)[0];
 const fail=(message:string,status=502,setup=false,retry?:number,rejected=false)=>Object.assign(new PostizApiError(message,status,setup,retry,rejected),{providerStatus:response?.status,operation});
 // workerd rejects redirect:"error" before sending a request. Manual mode keeps
 // credentials on the fixed origin; reject all redirects without following them.
 try{response=await fetch(API+path,{...options,headers:{Accept:'application/json',...options.headers,Authorization:key},redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(90000)});}catch{throw fail('Postiz sunucusuna ulaşılamadı. Plan oluşturduysan tekrar denemeden önce paylaşım geçmişini kontrol et.');}
 if(response.status>=300&&response.status<400)throw fail('Postiz beklenmedik bir yönlendirme döndürdü. Bağlantı adresi doğrulanamadı. (HTTP '+response.status+')');
 if(!response.ok){
  const delay=response.headers.get('retry-after');const retry=delay?(Number.isFinite(Number(delay))?Number(delay)*1000:Date.parse(delay)-Date.now()):0;
  if(response.status===401){let subscriptionMissing=false;try{const data=await response.json() as {msg?:unknown};subscriptionMissing=data?.msg==='No subscription found';}catch{}if(subscriptionMissing)throw fail('Postiz hesabında API için etkin abonelik bulunamadı. Postiz’de abonelik veya deneme durumunu kontrol et. (HTTP 401)',502,false,undefined,true);throw fail('Postiz API anahtarı kabul edilmedi. Sites ayarlarındaki Postiz API anahtarını kontrol et. (HTTP 401)',502,true,undefined,true);}
  if(response.status===403)throw fail('Postiz bu işlem için izin vermedi. API anahtarının hesabını, planını ve erişim yetkisini kontrol et. (HTTP 403)',502,false,undefined,true);
  if(response.status===429)throw fail('Postiz istek sınırına ulaşıldı. Bir süre sonra tekrar kontrol et. (HTTP 429)',429,false,Number.isFinite(retry)&&retry>0?Math.min(retry,2147483647):60000,true);
  if(response.status===400||response.status===413)throw fail('Postiz gönderi veya görsel ayarlarını kabul etmedi. İçeriği Postiz’de kontrol et. (HTTP '+response.status+')',502,false,undefined,true);
  throw fail('Postiz işlemin sonucunu doğrulayamadı. Tekrar planlamadan önce paylaşım geçmişini kontrol et. (HTTP '+response.status+')',502,false,undefined,response.status===404);
 }
 let data:unknown;try{data=await response.json();}catch{throw fail('Postiz geçerli bir yanıt döndürmedi. Tekrar planlamadan önce geçmişi kontrol et.');}
 if(data&&typeof data==='object'&&!Array.isArray(data)&&('error' in data||'errors' in data))throw fail('Postiz işlemi hata ile yanıtladı. Paylaşım geçmişini ve Postiz hesabını kontrol et.');
 return data;
}
export async function uploadPostizFile(asset:{object_key:string;content_type:string;name:string}):Promise<UploadedPostizMedia>{
 const object=await bucket().get(asset.object_key);if(!object||object.size>15*1024*1024)throw new PostizApiError('Seçilen görsel bulunamadı veya aktarım sınırını aşıyor.',400,false,undefined,true);
 const form=new FormData();form.set('file',new Blob([await object.arrayBuffer()],{type:asset.content_type}),asset.name);
 const raw=await request('upload',{method:'POST',body:form});const parsed=z.object({id:z.string().min(1),path:z.string().url().refine(path=>new URL(path).protocol==='https:')}).safeParse(raw);
 if(!parsed.success)throw new PostizApiError('Postiz görsel aktarımını doğrulayamadık. Henüz plan oluşturulmadı.');return parsed.data;
}
export async function invokePostizApi(action:'channels'|'rules'|'posts'|'schedule'|'upload',args:{[key:string]:Json},options:PostizHttpOptions={}){
 if(action==='channels'){
  const raw=await request('integrations');const parsed=z.array(z.object({id:z.string().min(1),name:z.string(),identifier:z.string(),picture:z.string().nullable().optional(),disabled:z.boolean().optional()})).max(1000).safeParse(raw);
  if(!parsed.success)throw new PostizApiError('Postiz hesap listesi doğrulanamadı.');
  return result(raw,{output:parsed.data.filter(c=>!c.disabled).map(c=>({id:c.id,name:c.name,platform:c.identifier,...(c.picture?{picture:c.picture}:{})}))});
 }
 if(action==='rules'){
  if(!options.channelId||options.channelId.length>200)throw new PostizApiError('Paylaşım kuralları için bağlı bir hesap seç.',400,false,undefined,true);
  const raw=await request('integration-settings/'+encodeURIComponent(options.channelId));const parsed=z.object({output:z.object({rules:z.string(),maxLength:z.number().int().positive(),settings:z.unknown().optional()})}).safeParse(raw);
  if(!parsed.success)throw new PostizApiError('Postiz paylaşım kuralları doğrulanamadı.');return result(raw,raw);
 }
 if(action==='posts'){
  const query=new URLSearchParams({startDate:String(args.startDate),endDate:String(args.endDate)});const raw=await request('posts?'+query);
  const parsed=z.object({posts:z.array(z.object({id:z.string(),content:z.string(),publishDate:z.string(),state:z.string(),error:z.string().nullable().optional(),integration:z.object({id:z.string(),name:z.string().optional(),providerIdentifier:z.string().optional()})})).max(10000)}).safeParse(raw);
  if(!parsed.success)throw new PostizApiError('Postiz paylaşım listesi doğrulanamadı.');return result(raw,{output:{posts:parsed.data.posts.map(p=>({...p,integrationId:p.integration.id,error:p.error||null}))}});
 }
 if(action==='schedule'){
  const parsed=z.object({socialPost:z.array(z.object({date:z.string(),integrationId:z.string(),postsAndComments:z.array(z.object({content:z.string(),attachments:z.array(z.string())})).length(1),settings:z.array(z.object({key:z.string(),value:z.unknown().optional()})),type:z.literal('schedule')})).length(1)}).safeParse(args);
  if(!parsed.success||!options.platform||!['instagram','instagram-standalone','facebook'].includes(options.platform))throw new PostizApiError('Planlama ayarlarını doğrulayamadık.',400,false,undefined,true);
  const post=parsed.data.socialPost[0],media=options.media||[];
  if(media.length!==post.postsAndComments[0].attachments.length||media.some(m=>!m.id))throw new PostizApiError('Aktarılan görseller doğrulanamadı. Henüz paylaşım planlanmadı.',400,false,undefined,true);
  const settings={...Object.fromEntries(post.settings.map(s=>[s.key,s.value])),__type:options.platform};
  const raw=await request('posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'schedule',date:post.date,shortLink:false,tags:[],posts:[{integration:{id:post.integrationId},value:[{content:post.postsAndComments[0].content,image:media.map(m=>({id:m.id,path:m.path}))}],settings}]})});
  const saved=z.array(z.object({postId:z.string().min(1),integration:z.string().min(1)})).length(1).safeParse(raw);
  if(!saved.success||saved.data[0].integration!==post.integrationId)throw new PostizApiError('Postiz’in planlama sonucu doğrulanamadı. Tekrar göndermeden önce paylaşım geçmişini kontrol et.');
  return result(raw,{output:saved.data.map(p=>({...p,previewUrl:''}))});
 }
 throw new PostizApiError('Bu işlem doğrudan Postiz bağlantısında desteklenmiyor.',400,false,undefined,true);
}
