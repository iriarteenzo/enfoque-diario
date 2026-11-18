const DB_NAME='EnfoqueDiarioDB', DB_VERSION=2, STORE='appState', KEY='root_state';
export const DEFAULT_STATE={
 version:3, updatedAt:Date.now(),
 user:{name:'Usuario',hearts:2,theme:'dark',avatar:''},
 categories:[
  {id:'cat_gestiones',name:'Gestiones / Sapos',color:'#b42332',icon:'🐸'},
  {id:'cat_estudios',name:'Estudios',color:'#2459a6',icon:'📘'},
  {id:'cat_casa',name:'Casa y Limpieza',color:'#23734d',icon:'🏡'},
  {id:'cat_salud',name:'Salud, Deporte y Lupita',color:'#bd641e',icon:'🐕'},
  {id:'cat_fiera',name:'Fiera Dog',color:'#795334',icon:'🪢'}
 ],
 tasks:[],routines:[],storyViews:{},habits:[
  {id:'h1',text:'Bebe un vaso de agua'},
  {id:'h2',text:'Estira espalda y hombros durante 2 minutos'},
  {id:'h3',text:'Haz 3 ciclos de respiración consciente'},
  {id:'h4',text:'Haz 3 nudos rápidos de paracord'},
  {id:'h5',text:'Camina 2 minutos por casa'}
 ]
};
const cleanText=(v,max=160)=>typeof v==='string'?v.replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,max):'';
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'');
const validTime=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v||'');
export class StorageService{
 db=null;
 async init(){if(this.db)return this.db;this.db=await new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});return this.db}
 sanitize(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Copia de seguridad inválida');
  const base=structuredClone(DEFAULT_STATE), src=input;
  if(src.user&&typeof src.user==='object'){base.user.name=cleanText(src.user.name,40)||'Usuario';base.user.hearts=Math.max(0,Math.min(99999,Number(src.user.hearts)||0));base.user.theme=src.user.theme==='light'?'light':'dark';base.user.avatar=typeof src.user.avatar==='string'&&src.user.avatar.startsWith('data:image/')&&src.user.avatar.length<1500000?src.user.avatar:''}
  if(Array.isArray(src.categories)&&src.categories.length){base.categories=src.categories.slice(0,30).map((c,i)=>({id:cleanText(c.id,40)||'cat_'+i,name:cleanText(c.name,50)||'Categoría',color:/^#[0-9a-f]{6}$/i.test(c.color||'')?c.color:'#53657a',icon:cleanText(c.icon,8)||'📌'}))}
  const catIds=new Set(base.categories.map(c=>c.id));
  if(Array.isArray(src.tasks))base.tasks=src.tasks.slice(0,1000).map((t,i)=>({id:cleanText(t.id,48)||'t_'+i,title:cleanText(t.title,120)||'Tarea sin título',categoryId:catIds.has(t.categoryId)?t.categoryId:base.categories[0].id,date:validDate(t.date)?t.date:new Date().toISOString().slice(0,10),startTime:validTime(t.startTime)?t.startTime:'09:00',endTime:validTime(t.endTime)?t.endTime:'10:00',completed:Boolean(t.completed),isFrog:catIds.has(t.categoryId)&&t.categoryId==='cat_gestiones'||Boolean(t.isFrog),repeat:['none','daily','weekly'].includes(t.repeat)?t.repeat:'none',steps:Array.isArray(t.steps)?t.steps.slice(0,40).map((s,j)=>({id:cleanText(s.id,48)||'s_'+j,text:cleanText(s.text,120),done:Boolean(s.done)})):[] })); 
  if(Array.isArray(src.routines))base.routines=src.routines.slice(0,80).map((r,i)=>({id:cleanText(r.id,48)||'r_'+i,title:cleanText(r.title,80)||'Rutina',days:Array.isArray(r.days)&&r.days.length===7?r.days.map(Boolean):Array(7).fill(false)}));
  if(src.storyViews&&typeof src.storyViews==='object')base.storyViews=src.storyViews;
  if(Array.isArray(src.habits))base.habits=src.habits.slice(0,30).map((h,i)=>({id:cleanText(h.id,40)||'h_'+i,text:cleanText(h.text,100)}));
  base.updatedAt=Number(src.updatedAt)||Date.now();return base
 }
 async getState(){await this.init();return new Promise((resolve,reject)=>{const req=this.db.transaction(STORE).objectStore(STORE).get(KEY);req.onsuccess=()=>{try{resolve(this.sanitize(req.result||DEFAULT_STATE))}catch{resolve(structuredClone(DEFAULT_STATE))}};req.onerror=()=>reject(req.error)})}
 async saveState(state){await this.init();const safe=this.sanitize({...state,updatedAt:Date.now()});return new Promise((resolve,reject)=>{const tx=this.db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(safe,KEY);tx.oncomplete=()=>resolve(safe);tx.onerror=()=>reject(tx.error)})}
 async importJSON(file){if(!file||file.size>5*1024*1024)throw new Error('El JSON debe pesar menos de 5 MB');let parsed;try{parsed=JSON.parse(await file.text())}catch{throw new Error('El archivo JSON no es válido')}return this.saveState(parsed)}
}
export const storage=new StorageService();
