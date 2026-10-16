import {env} from 'cloudflare:workers';
import {previewObjectKey} from '@/app/preview-rules';
export function database():D1Database {if(!env.DB)throw new Error('Database binding unavailable');return env.DB;}
export function bucket():R2Bucket {if(!env.BUCKET)throw new Error('File storage unavailable');return env.BUCKET;}
export async function removeStoredFiles(keys:string[]){if(!keys.length)return;const all=[...new Set(keys.flatMap(key=>[key,previewObjectKey(key)]))];try{for(let i=0;i<all.length;i+=100)await bucket().delete(all.slice(i,i+100));}catch(error){console.error('File cleanup failed',error);}}
