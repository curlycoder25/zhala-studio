import {z} from 'zod';
import {connectorsForRequest} from './connectors';
import {connectorResponse} from './connector-errors.mjs';
import type {ConnectorResult,Json} from './connectors';
import {context,ApiError,json} from '@/app/api/collaboration-utils';
import {chatGPTSignInPath} from '@/app/chatgpt-auth';
import {postizApiConfigured,invokePostizApi,PostizApiError} from './postiz-http';
import type {PostizHttpOptions} from './postiz-http';
export const POSTIZ_CONNECTOR='asdk_app_6aaaf1a529808191a2a15fde824bb013';
export const POSTIZ_ACTIONS={channels:'integrationList',rules:'integrationSchema',upload:'uploadFromUrlTool',schedule:'integrationSchedulePostTool',posts:'postsListTool'} as const;
export class PostizError extends Error{constructor(public envelope:Exclude<ConnectorResult,{status:'success'}>){super(envelope.message);}}
export async function ownerContext(){const ctx=await context();if(ctx.user.userId!==ctx.owner)throw new ApiError('Postiz bağlantısı ve paylaşım planlama yalnızca Zhala’ya açık.',403);return ctx;}
export function writeOrigin(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)throw new ApiError('İstek doğrulanamadı.',403);}
export async function invokePostiz(action:keyof typeof POSTIZ_ACTIONS,args:{[key:string]:Json},options:PostizHttpOptions={}){
 if(postizApiConfigured()){try{return await invokePostizApi(action,args,options);}catch(error){if(error instanceof PostizApiError&&!error.operation)error.operation=action;throw error;}}
 const raw=await connectorsForRequest().invoke(POSTIZ_CONNECTOR,POSTIZ_ACTIONS[action],args);
 const checked=await connectorResponse(raw).json() as ConnectorResult;
 if(checked.status!=='success')throw new PostizError(checked);
 let value:unknown=checked.result.structuredContent;
 if(value===undefined){for(const block of checked.result.content){if(block.type==='text'&&typeof block.text==='string'){try{value=JSON.parse(block.text);break;}catch{}}}}
 return{envelope:checked,value};
}
export const channelSchema=z.object({id:z.string().min(1).max(200),name:z.string().max(500),platform:z.string().max(100),picture:z.string().optional()});
export async function channels(){const call=await invokePostiz('channels',{});const parsed=z.object({output:z.array(channelSchema).max(1000)}).safeParse(call.value);if(!parsed.success)throw new ApiError('Postiz hesap listesini doğrulayamadık. Yenile ve tekrar kontrol et.',502);return{...call,channels:parsed.data.output};}
export function postizFailure(error:unknown){if(error instanceof PostizApiError){console.error('Postiz API failure',JSON.stringify({operation:error.operation||null,providerStatus:error.providerStatus||null,message:error.message}));return json({error:error.message,setupRequired:error.setupRequired,...(error.retryAfterMs?{retryAfterMs:error.retryAfterMs}:{})},error.httpStatus);}if(error instanceof PostizError){if(error.envelope.status==='binding_unavailable')return json({...error.envelope,error:'Bu Site oturumunda ChatGPT eklenti bağlantısı kullanılamıyor. Paylaşım için Postiz API anahtarını sitenin gizli ayarına tanımla.',setupRequired:true},503);return json({...error.envelope,...(error.envelope.status==='reauthentication_required'?{reconnectHref:chatGPTSignInPath('/?view=publishing')}: {})});}if(error instanceof ApiError)return json({error:error.message},error.status);console.error('Postiz request failed');return json({error:'İşlemin sonucu doğrulanamadı. Tekrar planlamadan önce paylaşım geçmişini kontrol et.'},503);}
export async function requestBody(req:Request){const text=await req.text();if(text.length>15000)throw new ApiError('Gönderilen bilgi çok uzun.',400);try{return JSON.parse(text) as unknown;}catch{throw new ApiError('Alanları kontrol et.',400);}}
