import {ownerContext,channels,postizFailure} from '@/lib/postiz';
import {json} from '@/app/api/collaboration-utils';
export const dynamic='force-dynamic';
export async function GET(){try{await ownerContext();const call=await channels();return json({...call.envelope,channels:call.channels});}catch(error){return postizFailure(error);}}
