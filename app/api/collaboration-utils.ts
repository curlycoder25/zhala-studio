import {database} from '@/db/store';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {studioOwner} from '@/db/studio';
export class ApiError extends Error{constructor(message:string,public status:number){super(message);}}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export function checkOrigin(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new ApiError('İstek doğrulanamadı.',403);}
export async function context(){const user=await getChatGPTUser();if(!user)throw new ApiError('Devam etmek için ChatGPT hesabınla giriş yap.',401);const db=database();const owner=await studioOwner(db,user);if(!owner)throw new ApiError('Çalışma alanı henüz hazır değil.',409);return{db,user,owner};}
export async function postContext(postId:string){const ctx=await context();if(!postId||postId.length>200)throw new ApiError('İçerik bulunamadı.',404);const post=await ctx.db.prepare('SELECT id FROM posts WHERE id=? AND owner=?').bind(postId,ctx.owner).first();if(!post)throw new ApiError('İçerik bulunamadı.',404);return ctx;}
export function failure(error:unknown,message:string){if(error instanceof ApiError)return json({error:error.message},error.status);console.error(message,error);return json({error:message+' Tekrar deneyebilirsin.'},503);}
