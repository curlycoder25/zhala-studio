import {z} from 'zod';
import {ownerContext,writeOrigin,requestBody,invokePostiz,postizFailure} from '@/lib/postiz';
import {json,ApiError} from '@/app/api/collaboration-utils';
import {publicJob} from '@/db/postiz';
import type {JobRow} from '@/db/postiz';
import {normalizedCaption} from '@/app/postiz-rules';
export const dynamic='force-dynamic';
type Route={params:Promise<{id:string}>};
export async function POST(req:Request,route:Route){try{
 writeOrigin(req);const{db,owner,user}=await ownerContext();const{id}=await route.params;const row=await db.prepare('SELECT * FROM publish_jobs WHERE id=? AND owner=? AND actor=?').bind(id,owner,user.userId).first<JobRow>();if(!row)throw new ApiError('Planlama kaydı bulunamadı.',404);
 const body=z.object({action:z.enum(['check','resolve']),checkedPostiz:z.boolean().optional()}).strict().safeParse(await requestBody(req));if(!body.success)throw new ApiError('İşlemi kontrol et.',400);
 if(['preparing','submitting'].includes(row.state)&&Date.now()-row.updated_at<600000)throw new ApiError('Aktarım hâlâ sürüyor. Yeni bir plan oluşturma; biraz sonra durumunu kontrol et.',409);
 if(body.data.action==='resolve'){
  if(!publicJob(row).canResolve||body.data.checkedPostiz!==true)throw new ApiError('Önce Postiz’de bu planın bulunmadığını veya iptal edildiğini kontrol et.',400);
  await db.prepare("UPDATE publish_jobs SET state='resolved',message='Postiz’de plan olmadığı yönetici tarafından kontrol edildi.',missing=0,updated_at=? WHERE id=? AND owner=?").bind(Date.now(),id,owner).run();return json({job:publicJob((await db.prepare('SELECT * FROM publish_jobs WHERE id=? AND owner=?').bind(id,owner).first<JobRow>())!)});
 }
 const time=Date.parse(row.scheduled_at);const call=await invokePostiz('posts',{startDate:new Date(time-86400000).toISOString(),endDate:new Date(time+86400000).toISOString()});
 const parsed=z.object({output:z.object({posts:z.array(z.object({id:z.string(),integrationId:z.string(),publishDate:z.string(),state:z.string(),content:z.string(),error:z.string().nullable().optional()})).max(10000)})}).safeParse(call.value);if(!parsed.success)throw new ApiError('Postiz’deki planlar doğrulanamadı. Mevcut kayıt korunuyor.',502);
 const candidates=parsed.data.output.posts.filter(p=>p.integrationId===row.channel_id&&(row.remote_id?p.id===row.remote_id:Math.abs(Date.parse(/(?:[zZ]|[+-]\d{2}:\d{2})$/.test(p.publishDate)?p.publishDate:p.publishDate+'Z')-time)<60000&&(normalizedCaption(p.content)===normalizedCaption(row.caption)||normalizedCaption(p.content,true)===normalizedCaption(row.caption))));
 if(candidates.length===1){const p=candidates[0];const states:Record<string,string>={QUEUE:'scheduled',PUBLISHED:'published',ERROR:'error',DRAFT:'draft'};const state=states[p.state];if(!state)throw new ApiError('Postiz bilinmeyen bir durum döndürdü. Planı Postiz’de kontrol et.',502);await db.prepare('UPDATE publish_jobs SET state=?,remote_id=?,message=?,missing=0,updated_at=? WHERE id=? AND owner=?').bind(state,p.id,p.error||'',Date.now(),id,owner).run();}
 else{await db.prepare("UPDATE publish_jobs SET state=CASE WHEN state IN ('preparing','submitting') THEN 'uncertain' ELSE state END,missing=?,message=?,updated_at=? WHERE id=? AND owner=?").bind(candidates.length?0:1,candidates.length?'Birden fazla eşleşen plan var. Postiz’de kontrol et; tekrar planlama.':'Bu tarihte eşleşen kayıt bulunamadı. Postiz’de planı kontrol et; taşınmış veya iptal edilmiş olabilir.',Date.now(),id,owner).run();}
 return json({...call.envelope,job:publicJob((await db.prepare('SELECT * FROM publish_jobs WHERE id=? AND owner=?').bind(id,owner).first<JobRow>())!)});
 }catch(error){return postizFailure(error);}}
