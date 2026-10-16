export const MAX_IMAGE_SIZE=15*1024*1024;
export const IMAGE_ACCEPT='image/jpeg,image/png,image/webp,image/gif';
export function imageContentType(bytes:Uint8Array):string|null{
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))return'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return'image/jpeg';
 const ascii=new TextDecoder().decode(bytes);
 if(ascii.startsWith('GIF87a')||ascii.startsWith('GIF89a'))return'image/gif';
 if(ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WEBP')return'image/webp';
 return null;
}
