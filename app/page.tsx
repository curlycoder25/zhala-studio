import Studio from './studio';
import {loadStudioData} from '@/db/post-data';
import SignInPanel from './sign-in-panel';
import {getChatGPTUser,chatGPTSignInPath} from './chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Home(){const user=await getChatGPTUser();const signInUrl=chatGPTSignInPath('/');if(!user)return <SignInPanel signInUrl={signInUrl}/>;let initialData;try{initialData=await loadStudioData(user)||undefined;}catch(error){console.error('Initial studio data unavailable',error);}return <Studio signInUrl={signInUrl} initialName={user.fullName||user.displayName} initialData={initialData}/>;}
