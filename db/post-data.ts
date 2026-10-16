import {database} from './store';
import {studioOwner} from './studio';
import {ensureBrands,listBrands} from './brands';
import {seeds} from '@/app/data';
import type {Post,StudioData} from '@/app/data';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
export type PostRow=Post&{coverId:string|null;coverName:string|null;coverKind:'reference'|'design'|null};
export const postQuery=`SELECT p.id,p.brand,p.title,p.format,p.platform,p.caption,p.visual,p.status,p.date,p.created_at AS createdAt,a.id AS coverId,a.name AS coverName,a.kind AS coverKind
 FROM posts p LEFT JOIN post_assets a ON a.id=(SELECT cover.id FROM post_assets cover WHERE cover.post_id=p.id AND cover.owner=p.owner AND cover.kind IN ('design','reference') ORDER BY CASE WHEN cover.kind='design' THEN 0 ELSE 1 END,cover.created_at DESC,cover.id DESC LIMIT 1)`;
export function postResult({coverId,coverName,coverKind,...post}:PostRow):Post{return {...post,calendarCover:coverId&&coverKind?{id:coverId,name:coverName||'İçerik görseli',kind:coverKind,url:'/api/attachments/'+encodeURIComponent(coverId)+'?preview=1'}:null};}

export async function loadStudioData(user:ChatGPTUser):Promise<StudioData|null>{
 const db=database();const workspace=await db.prepare('SELECT w.owner,c.owner AS catalogOwner FROM workspaces w LEFT JOIN brand_catalogs c ON c.owner=w.owner ORDER BY w.initialized_at ASC,w.owner ASC LIMIT 1').first<{owner:string;catalogOwner:string|null}>();
 const owner=workspace?.owner||await studioOwner(db,user);if(!owner)return null;
 if(!workspace?.catalogOwner)await ensureBrands(db,owner);
 if(!workspace){const now=Date.now();await db.batch([db.prepare('INSERT OR IGNORE INTO workspaces (owner,initialized_at) VALUES (?,?)').bind(owner,now),...seeds.map(p=>db.prepare('INSERT OR IGNORE INTO posts (id,owner,brand,title,format,platform,caption,visual,status,date,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM brands WHERE owner=? AND id=?)').bind(owner+':'+p.id,owner,p.brand,p.title,p.format,p.platform,p.caption,p.visual,p.status,p.date,now,owner,p.brand))]);}
 const[result,brands]=await Promise.all([db.prepare(postQuery+' WHERE p.owner=? ORDER BY p.created_at DESC,p.id ASC').bind(owner).all<PostRow>(),listBrands(db,owner)]);
 const canDelete=user.userId===owner;return{posts:result.results.map(postResult),brands,canDelete,currentUser:{name:user.fullName||(canDelete?'Zhala Azimlee':user.email.split('@')[0]),role:canDelete?'Yönetici':'Ekip üyesi'}};
}
