export const PREVIEW_EDGE=480;
export const previewObjectKey=(key:string)=>key+'.preview-480-v1.webp';
export function imageDimensions(bytes:Uint8Array,type:string):{width:number;height:number}|null{
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),size=bytes.length;
 if(type==='image/png'&&size>=24)return{width:view.getUint32(16),height:view.getUint32(20)};
 if(type==='image/webp'&&size>=30){const chunk=String.fromCharCode(...bytes.slice(12,16));if(chunk==='VP8X')return{width:1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),height:1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)};if(chunk==='VP8L'&&bytes[20]===47){const bits=view.getUint32(21,true);return{width:1+(bits&16383),height:1+((bits>>>14)&16383)};}if(chunk==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42)return{width:view.getUint16(26,true)&16383,height:view.getUint16(28,true)&16383};}
 if(type==='image/jpeg'&&size>4){let offset=2;while(offset+8<size){if(bytes[offset++]!==255)return null;while(offset<size&&bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===218||marker===217)return null;const length=view.getUint16(offset);if(length<2||offset+length>size)return null;
  // Keep camera images with orientation metadata on the original browser decoding path.
  if(marker===225&&String.fromCharCode(...bytes.slice(offset+2,offset+6))==='Exif')return null;
  if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return{width:view.getUint16(offset+5),height:view.getUint16(offset+3)};offset+=length;
 }}return null;
}
