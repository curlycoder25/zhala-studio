import {ownerContext,invokePostiz,postizFailure,channels} from '@/lib/postiz';
import {json,ApiError} from '@/app/api/collaboration-utils';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{await ownerContext();const platform=new URL(req.url).searchParams.get('platform');if(!platform||!['instagram','instagram-standalone','facebook'].includes(platform))throw new ApiError('Bu platform için planlama henüz desteklenmiyor.',400);const channelId=new URL(req.url).searchParams.get('channelId');const account=channelId?(await channels()).channels.find(c=>c.id===channelId&&c.platform===platform):undefined;const call=await invokePostiz('rules',{platform,isPremium:false},{channelId:account?.id});return json(call.envelope);}catch(error){return postizFailure(error);}}
