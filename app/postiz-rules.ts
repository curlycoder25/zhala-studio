export const STUDIO_TIMEZONE='Asia/Famagusta';
export function wallTimeToUtc(value:string):string{
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Geçerli bir tarih ve saat seç.');
 const [year,month,day,hour,minute]=value.split(/\D/).map(Number);
 const base=Date.UTC(year,month-1,day,hour,minute);
 if(new Date(base).toISOString().slice(0,16)!==value)throw Error('Geçerli bir tarih ve saat seç.');
 const f=new Intl.DateTimeFormat('en-GB',{timeZone:STUDIO_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 function parts(ms:number){const p=Object.fromEntries(f.formatToParts(new Date(ms)).map(v=>[v.type,v.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;}
 const offsets=new Set<number>();
 for(const shift of [-86400000,0,86400000]){const sample=base+shift;const p=parts(sample).split(/\D/).map(Number);offsets.add(Date.UTC(p[0],p[1]-1,p[2],p[3],p[4])-sample);}
 const matches=[...offsets].map(offset=>base-offset).filter(candidate=>parts(candidate)===value);
 if(matches.length!==1)throw Error('Bu saat, yaz/kış saati geçişinde tekrarlanıyor veya mevcut değil. Başka bir saat seç.');
 return new Date(matches[0]).toISOString();
}
export function studioWallTime(date=new Date()):string{const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:STUDIO_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(v=>[v.type,v.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;}
export function displaySchedule(utc:string):string{return new Intl.DateTimeFormat('tr-TR',{timeZone:STUDIO_TIMEZONE,day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'shortOffset'}).format(new Date(utc));}
export function captionHtml(value:string){return value.split(/\r?\n/).map(line=>'<p>'+line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')+'</p>').join('');}
export function normalizedCaption(value:string,html=false){if(!html)return value.replace(/\s+/g,' ').trim();return value.replace(/<[^>]*>/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();}
export function samePlatform(platform:string,channel:string){return platform==='Instagram'?['instagram','instagram-standalone'].includes(channel):platform==='Facebook'&&channel==='facebook';}
