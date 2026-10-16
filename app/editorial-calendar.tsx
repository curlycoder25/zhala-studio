'use client';
import {useState} from 'react';
import type {CSSProperties} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,Plus,Sparkles,BookOpen} from 'lucide-react';
import {findBrand} from './data';
import type {Brand,Post} from './data';
import {specialDays,matchesBrand,previousDate} from './special-days';
import type {SpecialDay} from './special-days';
function display(date:string,year=false){return new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',...(year?{year:'numeric'}:{})}).format(new Date(date+'T12:00:00Z'));}
function monday(date:string){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d;}
function CalendarPost({post,brands,priority,openPost}:{post:Post;brands:Brand[];priority:boolean;openPost:(post:Post)=>void}){
 const[failedImage,setFailedImage]=useState('');const b=findBrand(brands,post.brand);
 const cover=post.calendarCover,showCover=cover&&failedImage!==cover.url;
 return <button className={`calendar-post ${showCover?'has-preview':''}`} style={{'--brand':b.color} as CSSProperties} onClick={()=>openPost(post)} aria-label={`${b.name}: ${post.title} · ${post.status}. Briefi ve yorumları aç`}>
  {showCover&&<span className="calendar-design"><img src={cover.url} alt={`${post.title} — ${cover.name}`} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} decoding="async" onError={()=>setFailedImage(cover.url)}/>{cover.kind==='reference'&&<span className="calendar-reference-label">Referans</span>}</span>}
  <span className="calendar-post-details"><small>{b.name} · {post.format}</small><strong>{post.title}</strong><span className={`status-pill status-${post.status}`}>{post.status}</span>{cover&&!showCover&&<span className="calendar-design-error">Görsel için briefi aç</span>}</span>
 </button>;
}
type Props={brands:Brand[];today:string;brand:string;posts:Post[];openPost:(post:Post)=>void;onCreate:(post:Post)=>void};
export default function EditorialCalendar({brands,today,brand,posts,openPost,onCreate}:Props){
 const [week,setWeek]=useState(0),[year,setYear]=useState('upcoming'),[expanded,setExpanded]=useState(false);
 const start=monday(today);start.setUTCDate(start.getUTCDate()+week*7);
 const days=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10);});
 const relevant=specialDays.filter(day=>matchesBrand(day,brand));
 const filtered=relevant.filter(day=>year==='upcoming'?day.date>=today:day.date.startsWith(year));
 const shown=expanded?filtered:filtered.slice(0,6);
 function jump(date:string){if(!date)return;setWeek(Math.round((monday(date).getTime()-monday(today).getTime())/604800000));}
 function create(date:string,event?:SpecialDay){const selected=brand==='all'?(event?.brands.find(id=>brands.some(b=>b.id===id))||brands[0]?.id):brand;const b=brands.find(b=>b.id===selected);if(!b)return;onCreate({id:'',brand:b.id,title:event?event.title:'',format:event?'Story':'Gönderi',platform:'Instagram',caption:'',visual:event?`Özel gün: ${event.title} (${display(date,true)}).\nHazırlık: ${display(previousDate(date),true)}.\n\n${event.note}\n\n${b.visual}`:'',status:'Fikir',date});}
 return <section aria-label="Paylaşım takvimi ve özel günler">
  <div className="calendar-toolbar"><div><h2>{display(days[0])} – {display(days[6],true)}</h2><p className="calendar-caption">Son tasarımların, paylaşım planın ve özel günlerin.</p></div><div className="calendar-navigation"><label className="calendar-picker"><CalendarDays size={17}/><input aria-label="Takvimde tarihe git" type="date" value={days[0]} onChange={e=>jump(e.target.value)}/></label><button className="icon-button" aria-label="Önceki hafta" onClick={()=>setWeek(w=>w-1)}><ChevronLeft size={18}/></button><button className="quiet-button" onClick={()=>setWeek(0)}>Bu hafta</button><button className="icon-button" aria-label="Sonraki hafta" onClick={()=>setWeek(w=>w+1)}><ChevronRight size={18}/></button></div></div>
  {!brands.length&&<p className="brand-management-note">İçerik planlamak için önce Marka rehberinden bir marka ekle.</p>}
  <div className="calendar-grid">{days.map(date=><section key={date} className={`calendar-day ${date===today?'today':''}`}><header><span>{new Intl.DateTimeFormat('tr-TR',{weekday:'short'}).format(new Date(date+'T12:00:00Z'))}</span><strong>{Number(date.slice(-2))}</strong><button className="icon-button" aria-label={`${display(date)} için içerik ekle`} disabled={!brands.length} onClick={()=>create(date)}><Plus size={15}/></button></header><div className="day-content">{relevant.filter(day=>day.date===date).map(day=><button key={day.id} className="special-day-tile" disabled={!brands.length} onClick={()=>create(date,day)} aria-label={`${day.title} için içerik oluştur`}><span><Sparkles size={12}/>{day.category}</span><strong>{day.title}</strong><small>İçerik oluştur</small></button>)}{posts.filter(p=>p.date===date&&(brand==='all'||p.brand===brand)).map((p,i)=><CalendarPost priority={i===0} key={p.id} post={p} brands={brands} openPost={openPost}/>)}</div></section>)}</div>
  <div className="special-days-heading"><div><p className="eyebrow">SENİN İÇERİK TAKVİMİN</p><h2>Özel günler <em>önceden hazır.</em><span>{filtered.length}</span></h2></div><label>Günleri göster<select aria-label="Özel günlerin yılı" value={year} onChange={e=>{setYear(e.target.value);setExpanded(false);}}><option value="upcoming">Yaklaşan günler</option><option value="2026">2026 · tüm günler</option><option value="2027">2027 · tüm günler</option></select></label></div>
  <p className="special-days-intro">2026–2027 için kayıtlı günler. Markanı seçtiğinde sana uygun tarihler görünür.</p>
  <div className="special-days-list">{shown.map(day=><article key={day.id} className="special-day-row"><button className="event-date" onClick={()=>jump(day.date)} aria-label={`${day.title} gününü takvimde göster`}><strong>{Number(day.date.slice(-2))}</strong><span>{new Intl.DateTimeFormat('tr-TR',{month:'short'}).format(new Date(day.date+'T12:00:00Z'))}</span><small>{day.date.slice(0,4)}</small></button><div className="event-info"><div className="event-title"><h3>{day.title}</h3><span>{day.category}</span></div><p>{day.note}</p><div className="event-meta"><span>Hazırlık: {display(previousDate(day.date),true)}</span><span>{day.brands.length?day.brands.map(id=>brands.find(b=>b.id===id)?.name).filter(Boolean).join(' · ')||'Mevcut markalarından birini seç':'Tüm markalar'}</span></div>{day.source&&<a className="event-source" href={day.source} target="_blank" rel="noreferrer"><BookOpen size={12}/>{day.sourceName}</a>}</div><div className="event-actions"><button className="quiet-button" onClick={()=>jump(day.date)}>Takvimde gör</button><button className="event-create" disabled={!brands.length} onClick={()=>create(day.date,day)}><Plus size={15}/>İçerik oluştur</button></div></article>)}</div>
  {filtered.length>6&&<button className="show-days-button" onClick={()=>setExpanded(!expanded)}>{expanded?'Daha az göster':`Tüm özel günleri göster (${filtered.length})`}</button>}
  {filtered.length===0&&<div className="empty"><CalendarDays size={26}/><h3>Bu seçim için kayıtlı gün yok.</h3><p>Başka bir yıl veya marka seçebilirsin.</p></div>}
  <div className="plan-note"><CalendarDays size={23}/><div><strong>Bir gün önceden hazırlanmaya yer aç.</strong><p>Her özel günün hazırlık tarihi ve marka önerisi var. “İçerik oluştur” ile o güne ait briefi açıp kaydedebilirsin. Sosyal medyada yayımlamak için hazır içeriğin briefindeki “Paylaşımı planla” adımını tamamla. Yalnızca takvime tarih eklemek Postiz’de plan oluşturmaz.</p></div></div>
 </section>;
}
