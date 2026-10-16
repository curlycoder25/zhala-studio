import {z} from 'zod';
import {ownerContext,writeOrigin,requestBody,channels,invokePostiz,PostizError,postizFailure} from '@/lib/postiz';
import {json,ApiError} from '@/app/api/collaboration-utils';
import {digest,publicJob,previewLink} from '@/db/postiz';
import type {JobRow} from '@/db/postiz';
import {postizApiConfigured,uploadPostizFile,PostizApiError} from '@/lib/postiz-http';
import type {UploadedPostizMedia} from '@/lib/postiz-http';
import {wallTimeToUtc,captionHtml,samePlatform} from '@/app/postiz-rules';
export const dynamic='force-dynamic';
const input=z.object({requestId:z.string().uuid(),postId:z.string().min(1).max(200),channelId:z.string().min(1).max(200),caption:z.string().trim().min(1,'Paylaşım açıklamasını yaz.').max(6000),localTime:z.string().max(30),assetIds:z.array(z.string().min(1).max(200)).min(1,'En az bir son tasarım seç.').max(10)}).strict();
type Asset={id:string;object_key:string;content_type:string;name:string};
export async function GET(){try{const{db,owner}=await ownerContext();const rows=await db.prepare('SELECT * FROM publish_jobs WHERE owner=? AND actor=? ORDER BY created_at DESC LIMIT 100').bind(owner,owner).all<JobRow>();return json({jobs:rows.results.map(publicJob)});}catch(error){return postizFailure(error);}}
export async function POST(req:Request){
 let active:{db:D1Database;id:string;owner:string;phase:'preparing'|'submitting'}|undefined;
 try{
  writeOrigin(req);const{db,owner,user}=await ownerContext();const parsed=input.safeParse(await requestBody(req));if(!parsed.success)throw new ApiError(parsed.error.issues[0]?.message||'Alanları kontrol et.',400);
  const body=parsed.data;const fingerprint=await digest(JSON.stringify(body));
  const previous=await db.prepare('SELECT * FROM publish_jobs WHERE id=? AND owner=? AND actor=?').bind(body.requestId,owner,user.userId).first<JobRow>();
  if(previous){if(previous.fingerprint!==fingerprint)throw new ApiError('Bu işlem kimliği başka bir içerikle kullanılmış. Önce paylaşım geçmişini kontrol et.',409);return json({job:publicJob(previous),alreadyProcessed:true},['scheduled','published','draft'].includes(previous.state)?200:409);}
  const post=await db.prepare('SELECT id,title,brand,format,platform,status FROM posts WHERE id=? AND owner=?').bind(body.postId,owner).first<{id:string;title:string;brand:string;format:string;platform:string;status:string}>();
  if(!post)throw new ApiError('İçerik bulunamadı.',404);
  if(post.status!=='Hazır')throw new ApiError('Planlamadan önce tasarımı onaylayıp içerik durumunu “Hazır” yap.',400);
  if(post.format==='Reels')throw new ApiError('Bu ilk sürüm fotoğraflı gönderi, karusel ve Story içindir. Reels için video aktarımı henüz yok.',400);
  if(!['Instagram','Facebook'].includes(post.platform))throw new ApiError('Bu ilk sürümde Instagram ve Facebook planlanabilir.',400);
  const utc=wallTimeToUtc(body.localTime),when=Date.parse(utc),now=Date.now();if(when<now+300000||when>now+366*86400000)throw new ApiError('Paylaşımı en az 5 dakika sonraya ve en fazla bir yıl ileriye planla.',400);
  if(new Set(body.assetIds).size!==body.assetIds.length)throw new ApiError('Aynı görseli iki kez seçemezsin.',400);
  if(post.format==='Story'&&body.assetIds.length!==1)throw new ApiError('Story için tek görsel seç.',400);
  if(post.format==='Gönderi'&&body.assetIds.length!==1)throw new ApiError('Tek gönderi için bir görsel seç. Birden fazla görsel için formatı Karusel yap.',400);
  if(post.format==='Karusel'&&body.assetIds.length<2)throw new ApiError('Karusel için en az iki görsel seç.',400);
  const found=await db.prepare(`SELECT id,object_key,content_type,name FROM post_assets WHERE post_id=? AND owner=? AND kind='design' AND id IN (${body.assetIds.map(()=>'?').join(',')})`).bind(post.id,owner,...body.assetIds).all<Asset>();
  if(found.results.length!==body.assetIds.length)throw new ApiError('Seçilen son tasarımlardan biri artık bulunamıyor. Görselleri yeniden seç.',409);
  const assets=body.assetIds.map(id=>found.results.find(a=>a.id===id)!);if(assets.some(a=>!['image/jpeg','image/png'].includes(a.content_type)))throw new ApiError('Paylaşım için JPG veya PNG son tasarımlarını seç.',400);
  const accountCall=await channels();const channel=accountCall.channels.find(c=>c.id===body.channelId);if(!channel||!samePlatform(post.platform,channel.platform))throw new ApiError('Bu platforma ait bağlı bir Postiz hesabı seç.',400);
  const rulesCall=await invokePostiz('rules',{platform:channel.platform,isPremium:false},{channelId:channel.id});const rules=z.object({output:z.object({maxLength:z.number().int().positive().max(100000),rules:z.string(),settings:z.unknown().optional()})}).safeParse(rulesCall.value);
  if(!rules.success)throw new ApiError('Postiz paylaşım kurallarını doğrulayamadık. Henüz plan oluşturulmadı.',502);
  if([...body.caption].length>rules.data.output.maxLength)throw new ApiError(`Bu hesap için açıklama en fazla ${rules.data.output.maxLength} karakter olabilir.`,400);
  const settings=rules.data.output.settings as {required?:string[];properties?:{post_type?:{enum?:string[]}}}|undefined;
  if(settings?.required?.some(key=>!['post_type','__type'].includes(key)))throw new ApiError('Bu hesap ek yayın ayarları istiyor. Bu paylaşımı Postiz üzerinden tamamla.',400);
  const postType=post.format==='Story'?'story':'post';if(settings?.properties?.post_type?.enum&&!settings.properties.post_type.enum.includes(postType))throw new ApiError('Bu hesap seçilen paylaşım formatını desteklemiyor.',400);
  const id=body.requestId;const inserted=await db.prepare("INSERT INTO publish_jobs (id,owner,actor,post_id,title,brand,channel_id,channel_name,platform,scheduled_at,caption,fingerprint,state,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,'preparing',?,? WHERE NOT EXISTS (SELECT 1 FROM publish_jobs WHERE owner=? AND actor=? AND post_id=? AND channel_id=? AND state NOT IN ('resolved','published'))").bind(id,owner,user.userId,post.id,post.title,post.brand,channel.id,channel.name,channel.platform,utc,body.caption,fingerprint,now,now,owner,user.userId,post.id,channel.id).run();
  if(!inserted.meta.changes)throw new ApiError('Bu içerik için bu hesapta zaten bir plan veya kontrol bekleyen işlem var. Paylaşım planından durumunu kontrol et.',409);
  active={db,id,owner,phase:'preparing'};
  await db.prepare('DELETE FROM publish_media WHERE expires_at<?').bind(now).run();
  const attachments:UploadedPostizMedia[]=[];
  const direct=postizApiConfigured(),batchSize=direct?2:3;
  for(let start=0;start<assets.length;start+=batchSize){
   const batch=await Promise.allSettled(assets.slice(start,start+batchSize).map(async asset=>{
   if(direct)return uploadPostizFile(asset);
   const token=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
   await db.prepare('INSERT INTO publish_media (token_hash,job_id,owner,asset_id,expires_at) VALUES (?,?,?,?,?)').bind(await digest(token),id,owner,asset.id,Date.now()+900000).run();
   const mediaUrl=new URL('/api/postiz/media/'+token,req.url).href;
   const upload=await invokePostiz('upload',{url:mediaUrl});const uploaded=z.object({path:z.string().url(),id:z.string().optional(),error:z.never().optional()}).safeParse(upload.value);
   if(!uploaded.success)throw new ApiError('Görsel Postiz’e aktarılamadı. Henüz paylaşım planlanmadı; geçmişten kontrol et.',502);
   const path=new URL(uploaded.data.path);if(path.protocol!=='https:')throw new ApiError('Postiz görsel adresini doğrulayamadık.',502);
   return {path:path.href,...(uploaded.data.id?{id:uploaded.data.id}:{})};
   }));
   const failed=batch.find(item=>item.status==='rejected');if(failed?.status==='rejected')throw failed.reason;
   for(const item of batch)if(item.status==='fulfilled')attachments.push(item.value);
  }
  // Persist before the single external schedule call. Never replay this call after an uncertain result.
  await db.prepare("UPDATE publish_jobs SET state='submitting',updated_at=? WHERE id=? AND owner=?").bind(Date.now(),id,owner).run();active.phase='submitting';
  const call=await invokePostiz('schedule',{socialPost:[{date:utc,integrationId:channel.id,isPremium:false,postsAndComments:[{content:captionHtml(body.caption),attachments:attachments.map(m=>m.path)}],settings:[{key:'post_type',value:postType}],shortLink:false,type:'schedule'}]},{platform:channel.platform,media:attachments});
  const receipt=z.object({output:z.array(z.object({integration:z.string(),postId:z.string().min(1),previewUrl:z.string()})).length(1)}).safeParse(call.value);
  if(!receipt.success){const rejected=z.object({output:z.object({errors:z.string().min(1)})}).safeParse(call.value);if(rejected.success){await db.prepare("UPDATE publish_jobs SET state='error',message=?,updated_at=? WHERE id=? AND owner=?").bind(rejected.data.output.errors.slice(0,2000),Date.now(),id,owner).run();return json({...call.envelope,job:publicJob((await db.prepare('SELECT * FROM publish_jobs WHERE id=? AND owner=?').bind(id,owner).first<JobRow>())!)});}throw new ApiError('Postiz’in planlama yanıtı doğrulanamadı. Yeni bir denemeden önce paylaşım geçmişini kontrol et.',502);}
  const remote=receipt.data.output[0];await db.prepare("UPDATE publish_jobs SET state='scheduled',remote_id=?,preview_url=?,message='',updated_at=? WHERE id=? AND owner=?").bind(remote.postId,previewLink(remote.previewUrl),Date.now(),id,owner).run();
  try{await db.prepare('UPDATE posts SET date=? WHERE id=? AND owner=?').bind(body.localTime.slice(0,10),post.id,owner).run();}catch{}
  const job=await db.prepare('SELECT * FROM publish_jobs WHERE id=? AND owner=?').bind(id,owner).first<JobRow>();return json({...call.envelope,job:publicJob(job!)},201);
 }catch(error){
  if(active){const denied=(error instanceof PostizApiError&&error.confirmedRejected)||error instanceof PostizError&&['invalid_request','request_context_expired','reauthentication_required','connector_access_disabled','tool_not_found','tool_not_allowed','binding_unavailable','rate_limited'].includes(error.envelope.status);const state=active.phase==='preparing'?'upload_failed':denied?'error':'uncertain';try{await active.db.prepare('UPDATE publish_jobs SET state=?,message=?,updated_at=? WHERE id=? AND owner=?').bind(state,error instanceof Error?error.message.slice(0,2000):'İşlem kontrol edilmeli.',Date.now(),active.id,active.owner).run();}catch{}}
  return postizFailure(error);
 }finally{if(active){try{await active.db.prepare('DELETE FROM publish_media WHERE job_id=? AND owner=?').bind(active.id,active.owner).run();}catch{}}}
}
