import {bucket} from './store';
import {imageDimensions,PREVIEW_EDGE,previewObjectKey} from '@/app/preview-rules';
type ImageBody={body:ReadableStream<Uint8Array>|Uint8Array;size:number;contentType:string;preview:boolean};
let queue:Promise<unknown>=Promise.resolve();
function serial<T>(work:()=>Promise<T>):Promise<T>{const next=queue.then(work,work);queue=next.then(()=>undefined,()=>undefined);return next;}
export async function previewImage(key:string,contentType:string):Promise<ImageBody|null>{
 const cached=await bucket().get(previewObjectKey(key));if(cached)return{body:cached.body,size:cached.size,contentType:'image/webp',preview:true};
 return serial(async()=>{const hit=await bucket().get(previewObjectKey(key));if(hit)return{body:hit.body,size:hit.size,contentType:'image/webp',preview:true};const original=await bucket().get(key);if(!original)return null;
  if(original.size>6*1024*1024||contentType==='image/gif')return{body:original.body,size:original.size,contentType,preview:false};
  const bytes=new Uint8Array(await original.arrayBuffer());const dimensions=imageDimensions(bytes,contentType);if(!dimensions||!dimensions.width||!dimensions.height||dimensions.width*dimensions.height>4_500_000)return{body:bytes,size:bytes.length,contentType,preview:false};
  try{const{PhotonImage,resize,SamplingFilter}=await import('@cf-wasm/photon/workerd');let input:InstanceType<typeof PhotonImage>|undefined,output:InstanceType<typeof PhotonImage>|undefined;let optimized:Uint8Array;
   try{input=PhotonImage.new_from_byteslice(bytes);const scale=Math.min(1,PREVIEW_EDGE/Math.max(input.get_width(),input.get_height()));output=resize(input,Math.max(1,Math.round(input.get_width()*scale)),Math.max(1,Math.round(input.get_height()*scale)),SamplingFilter.Triangle);optimized=output.get_bytes_webp();}finally{output?.free();input?.free();}
   if(optimized.length>=bytes.length)return{body:bytes,size:bytes.length,contentType,preview:false};
   try{await bucket().put(previewObjectKey(key),optimized,{httpMetadata:{contentType:'image/webp'}});}catch(error){console.error('Preview cache write failed',error);}
   return{body:optimized,size:optimized.length,contentType:'image/webp',preview:true};
  }catch(error){console.error('Preview generation failed',error);return{body:bytes,size:bytes.length,contentType,preview:false};}
 });
}
