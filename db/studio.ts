import type {ChatGPTUser} from '@/app/chatgpt-auth';
export async function studioOwner(db:D1Database,user:ChatGPTUser){
 const existing=await db.prepare('SELECT owner FROM workspaces ORDER BY initialized_at ASC,owner ASC LIMIT 1').first<{owner:string}>();
 if(existing)return existing.owner;
 return user.email.toLowerCase()==='zhala.azimlee@nodelabs.software'?user.userId:null;
}
export function authorName(user:ChatGPTUser,owner:string){return user.fullName||(user.userId===owner?'Zhala Azimlee':user.email.split('@')[0]);}
