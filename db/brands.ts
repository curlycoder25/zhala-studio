import {defaultBrands} from '@/app/data';
import type {Brand} from '@/app/data';
export function brandNameKey(name:string){return name.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('tr-TR');}
export async function ensureBrands(db:D1Database,owner:string){
 const initialized=await db.prepare('SELECT owner FROM brand_catalogs WHERE owner=?').bind(owner).first();if(initialized)return;
 const now=Date.now();await db.batch([
  ...defaultBrands.map((b,i)=>db.prepare('INSERT OR IGNORE INTO brands (id,owner,name,name_key,code,color,light,category,voice,visual,facts,cta,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM brand_catalogs WHERE owner=?)').bind(b.id,owner,b.name,brandNameKey(b.name),b.code,b.color,b.light,b.category,b.voice,b.visual,b.facts,b.cta,now+i,owner)),
  db.prepare('INSERT OR IGNORE INTO brand_catalogs (owner,initialized_at) VALUES (?,?)').bind(owner,now)
 ]);
}
export async function listBrands(db:D1Database,owner:string){const result=await db.prepare('SELECT id,name,code,color,light,category,voice,visual,facts,cta FROM brands WHERE owner=? ORDER BY created_at ASC,id ASC').bind(owner).all<Brand>();return result.results;}
