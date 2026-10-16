import {database,removeStoredFiles} from '@/db/store';
import {studioOwner} from '@/db/studio';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {statuses} from '@/app/data';
import {ensureBrands} from '@/db/brands';
import {loadStudioData,postQuery,postResult} from '@/db/post-data';
import type {PostRow} from '@/db/post-data';
import {z} from 'zod';
export const dynamic='force-dynamic';
const schema=z.object({brand:z.string().min(1,'Bir marka seç.').max(200),title:z.string().trim().min(1).max(200),format:z.enum(['Gönderi','Karusel','Reels','Story']),platform:z.enum(['Instagram','Facebook','TikTok']),caption:z.string().max(6000),visual:z.string().max(6000),status:z.enum(statuses),date:z.string().refine(v=>!v||/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v,'Geçerli bir tarih seç.')});
const idSchema=z.string().min(1).max(200);
const deletionSchema=z.union([z.object({id:idSchema}).strict(),z.object({ids:z.array(idSchema).min(1).max(500)}).strict()]);
function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
function safeOrigin(req:Request){const o=req.headers.get('origin');return !o||o===new URL(req.url).origin;}
export async function GET(){const user=await getChatGPTUser();if(!user)return json({error:'İçerikleri görmek için ChatGPT hesabınla giriş yap.'},401);try{const data=await loadStudioData(user);return data?json(data):json({error:'Çalışma alanını önce Zhala’nın açması gerekiyor.'},409);}catch(e){console.error('Loading posts failed',e);return json({error:'İçerikler yüklenemedi. Tekrar deneyebilirsin.'},503);}}
export async function POST(req:Request){return write(req,false);}export async function PATCH(req:Request){return write(req,true);}
async function write(req:Request,update:boolean){
 const user=await getChatGPTUser();if(!user)return json({error:'Kaydetmek için giriş yapmalısın.'},401);if(!safeOrigin(req))return json({error:'İstek doğrulanamadı.'},403);
 let body:Record<string,unknown>;try{body=await req.json() as Record<string,unknown>;}catch{return json({error:'Geçerli bir içerik gönder.'},400);}
 const parsed=schema.safeParse(body);if(!parsed.success)return json({error:parsed.error.issues[0]?.message||'Alanları kontrol et.'},400);
 try{const p=parsed.data,db=database(),owner=await studioOwner(db,user);if(!owner)return json({error:'Çalışma alanı henüz hazır değil.'},409);
 await ensureBrands(db,owner);if(!await db.prepare('SELECT id FROM brands WHERE owner=? AND id=?').bind(owner,p.brand).first())return json({error:'Bu marka artık yok. Güncel marka listesinden bir marka seç.'},409);
 const id=update?body.id:crypto.randomUUID();if(typeof id!=='string')return json({error:'İçerik bulunamadı.'},400);
 if(update){const r=await db.prepare('UPDATE posts SET brand=?,title=?,format=?,platform=?,caption=?,visual=?,status=?,date=? WHERE id=? AND owner=?').bind(p.brand,p.title,p.format,p.platform,p.caption,p.visual,p.status,p.date,id,owner).run();if(!r.meta.changes)return json({error:'İçerik bulunamadı.'},404);}
 else await db.prepare('INSERT INTO posts (id,owner,brand,title,format,platform,caption,visual,status,date,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id,owner,p.brand,p.title,p.format,p.platform,p.caption,p.visual,p.status,p.date,Date.now()).run();
 const saved=await db.prepare(postQuery+' WHERE p.id=? AND p.owner=?').bind(id,owner).first<PostRow>();
 if(!saved)return json({error:'İçerik bulunamadı.'},404);
 return json({post:postResult(saved)},update?200:201);
 }catch(e){if(String(e).includes('brand_not_found'))return json({error:'Bu marka artık yok. Güncel marka listesinden bir marka seç.'},409);console.error('Saving post failed',e);return json({error:'Kaydedilemedi. Yazdıkların bu pencerede duruyor; tekrar deneyebilirsin.'},503);}
}
export async function DELETE(req:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'Giriş yapmalısın.'},401);if(!safeOrigin(req))return json({error:'İstek doğrulanamadı.'},403);
 let body:unknown;try{body=await req.json();}catch{return json({error:'Silinecek içerikleri seç.'},400);}
 const parsed=deletionSchema.safeParse(body);if(!parsed.success)return json({error:'1–500 içerik seçebilirsin.'},400);
 try{const db=database(),owner=await studioOwner(db,user);if(!owner||user.userId!==owner)return json({error:'Silme işlemi yalnızca yöneticiye açık.'},403);
 const ids=[...new Set('ids' in parsed.data?parsed.data.ids:[parsed.data.id])];
 const statements=[];const fileKeys:string[]=[];for(let i=0;i<ids.length;i+=80){const chunk=ids.slice(i,i+80);const marks=chunk.map(()=>'?').join(',');const assets=await db.prepare(`SELECT object_key AS objectKey FROM post_assets WHERE owner=? AND post_id IN (${marks})`).bind(owner,...chunk).all<{objectKey:string}>();fileKeys.push(...assets.results.map(a=>a.objectKey));statements.push(db.prepare(`DELETE FROM posts WHERE owner=? AND id IN (${marks})`).bind(owner,...chunk));}
 const result=await db.batch(statements);const deletedCount=result.reduce((total,item)=>total+(item.meta.changes||0),0);await removeStoredFiles(fileKeys);
 return json({ok:true,deletedCount,deletedIds:ids});
 }catch(e){console.error('Deleting posts failed',e);return json({error:'Silinemedi. Seçimin korunuyor; tekrar deneyebilirsin.'},503);}
}
