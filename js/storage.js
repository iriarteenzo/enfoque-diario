const DB_NAME='EnfoqueDiarioDB';
const DB_VERSION=3;
const STORE='appState';
const KEY='root_state';
const LEGACY_KEYS=['enfoque_diario_v9','enfoque_diario_v8','enfoque_diario_v7'];
const text=(v,max=160)=>typeof v==='string'?v.replace(/[<>\u0000-\u001f\u007f]/g,'').trim().slice(0,max):'';
const dateOk=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);
const timeOk=v=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const colorOk=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
const clone=v=>structuredClone(v);
export const DEFAULT_STATE={
 version:4,updatedAt:Date.now(),
 user:{name:'Usuario',hearts:2,theme:'dark',avatar:''},
 categories:[
  {id:'cat_gestiones',name:'Gestiones / Sapos',color:'#b42332',icon:'🐸',sort:1},
  {id:'cat_estudios',name:'Estudios',color:'#2459a6',icon:'📘',sort:2},
  {id:'cat_casa',name:'Casa y Limpieza',color:'#23734d',icon:'🏡',sort:3},
  {id:'cat_salud',name:'Salud, Deporte y Lupita',color:'#bd641e',icon:'🐕',sort:4},
  {id:'cat_fiera',name:'Fiera Dog',color:'#795334',icon:'🪢',sort:5}
 ],
 tasks:[],routines:[],storyViews:{},habits:[
  {id:'h1',emoji:'💧',text:'Beber un vaso de agua'},
  {id:'h2',emoji:'🧘',text:'Estirar columna y hombros durante 2 minutos'},
  {id:'h3',emoji:'🌬️',text:'Hacer 3 ciclos de respiración consciente'},
  {id:'h4',emoji:'🪢',text:'Hacer 3 nudos rápidos de paracord'},
  {id:'h5',emoji:'🚶',text:'Caminar 2 minutos por casa'}
 ]
};
export class StorageService{
 constructor(){this.db=null;this.fallback=false}
 async init(){
  if(this.db||this.fallback)return this.db;
  if(!('indexedDB'in globalThis)){this.fallback=true;return null}
  this.db=await new Promise((resolve,reject)=>{
   const req=indexedDB.open(DB_NAME,DB_VERSION);
   req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};
   req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(req.result)};
   req.onerror=()=>reject(req.error||new Error('No se pudo abrir IndexedDB'));
   req.onblocked=()=>reject(new Error('Cierra otras pestañas de Enfoque Diario y vuelve a intentarlo'));
  });
  return this.db;
 }
 sanitize(src){
  if(!src||typeof src!=='object'||Array.isArray(src))throw new Error('La estructura de datos no es válida');
  const out=clone(DEFAULT_STATE);
  const u=src.user&&typeof src.user==='object'?src.user:src;
  out.user.name=text(u.name??src.name,40)||'Usuario';
  out.user.hearts=Math.max(0,Math.min(999999,Number.isFinite(Number(u.hearts))?Math.floor(Number(u.hearts)):2));
  out.user.theme=u.theme==='light'?'light':'dark';
  out.user.avatar=typeof (u.avatar??src.avatarUrl)==='string'&&String(u.avatar??src.avatarUrl).startsWith('data:image/')&&String(u.avatar??src.avatarUrl).length<=1800000?String(u.avatar??src.avatarUrl):'';
  if(Array.isArray(src.categories)&&src.categories.length){
   out.categories=src.categories.slice(0,40).map((c,i)=>({id:text(c?.id,48)||'cat_'+i,name:text(c?.name,60)||'Categoría',color:colorOk(c?.color)?c.color:'#53657a',icon:text(c?.icon??c?.emoji,12)||'📌',sort:Number.isFinite(c?.sort)?c.sort:i}));
  }
  const ids=new Set(out.categories.map(c=>c.id));
  if(Array.isArray(src.tasks)){
   const expanded=[];
   const baseDay=new Date();baseDay.setHours(12,0,0,0);
   src.tasks.slice(0,1500).forEach((t,i)=>{
    const catId=ids.has(t?.categoryId)?t.categoryId:out.categories[0].id;
    const isFrog=catId==='cat_gestiones'||Boolean(t?.isFrog??t?.sapo);
    const start=timeOk(t?.startTime??t?.start)?(t.startTime??t.start):'09:00';
    const end=timeOk(t?.endTime??t?.end)?(t.endTime??t.end):'10:00';
    const repeat=['none','daily','weekly'].includes(t?.repeat)?t.repeat:(Array.isArray(t?.days)&&t.days.length?'weekly':'none');
    const dates=[];
    if(dateOk(t?.date))dates.push(t.date);
    else if(Array.isArray(t?.days)&&t.days.length){
     for(let offset=0;offset<14;offset++){const d=new Date(baseDay);d.setDate(d.getDate()+offset);const weekday=(d.getDay()+6)%7;if(t.days.includes(weekday))dates.push([d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'))}
    }else dates.push(new Date().toLocaleDateString('en-CA'));
    dates.slice(0,14).forEach((date,j)=>{
     const steps=Array.isArray(t?.steps)?t.steps.slice(0,60).map((step,k)=>({id:text(step?.id,64)||'step_'+i+'_'+k,text:text(step?.text,140),done:Boolean(step?.done)||Boolean(step?.doneDates?.includes?.(date))})).filter(step=>step.text):[];
     const completed=Boolean(t?.completed)||Boolean(t?.completedDates?.includes?.(date))||(steps.length>0&&steps.every(step=>step.done));
     expanded.push({id:dates.length>1?(text(t?.id,64)||'task_'+i)+'_'+date:text(t?.id,64)||'task_'+i,title:text(t?.title,120)||'Tarea sin título',categoryId:catId,date,startTime:start,endTime:end,completed,isFrog,repeat,steps,createdAt:Number(t?.createdAt)||Date.now(),deferredTo:''});
    });
   });
   out.tasks=expanded.slice(0,1500);
  }
  if(Array.isArray(src.routines))out.routines=src.routines.slice(0,100).map((r,i)=>({id:text(r?.id,64)||'routine_'+i,title:text(r?.title,100)||'Rutina',days:Array.isArray(r?.days)&&r.days.length===7?r.days.map(Boolean):Array(7).fill(false)}));
  if(Array.isArray(src.habits))out.habits=src.habits.slice(0,60).map((h,i)=>typeof h==='string'?{id:'habit_'+i,emoji:'✨',text:text(h,140)}:{id:text(h?.id,64)||'habit_'+i,emoji:text(h?.emoji,8)||'✨',text:text(h?.text??h?.title,140)}).filter(h=>h.text);
  const views=src.storyViews??src.seen;if(views&&typeof views==='object'&&!Array.isArray(views))out.storyViews=Object.fromEntries(Object.entries(views).slice(0,2000).filter(([k,v])=>k.length<160&&(typeof v==='boolean'||typeof v==='number')));
  out.updatedAt=Number.isFinite(Number(src.updatedAt))?Number(src.updatedAt):Date.now();
  out.version=4;
  return out;
 }
 async readDb(){const db=await this.init();if(!db)return JSON.parse(localStorage.getItem(KEY)||'null');return new Promise((resolve,reject)=>{const req=db.transaction(STORE,'readonly').objectStore(STORE).get(KEY);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)})}
 async writeDb(value){const db=await this.init();if(!db){localStorage.setItem(KEY,JSON.stringify(value));return value}return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,KEY);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('No se pudieron guardar los datos'))})}
 async getState(){
  let raw=await this.readDb();
  if(!raw){for(const key of LEGACY_KEYS){try{const old=JSON.parse(localStorage.getItem(key)||'null');if(old){raw=old;break}}catch{}}}
  const safe=this.sanitize(raw||DEFAULT_STATE);
  if(!raw||safe.version!==raw.version)await this.writeDb(safe);
  return safe;
 }
 async saveState(input){const safe=this.sanitize({...input,updatedAt:Date.now()});await this.writeDb(safe);return safe}
 async importJSON(file){if(!file||file.size>8*1024*1024)throw new Error('El archivo debe ser un JSON de hasta 8 MB');let data;try{data=JSON.parse(await file.text())}catch{throw new Error('El archivo JSON no es válido')};const safe=this.sanitize(data);await this.writeDb(safe);return safe}
 async exportJSON(){return JSON.stringify(await this.getState(),null,2)}
}
export const storage=new StorageService();
