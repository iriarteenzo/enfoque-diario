import {SUPABASE_URL,SUPABASE_ANON_KEY} from './supabase-config.js';
const ROOT=SUPABASE_URL.replace(/\/$/,'');
const SESSION_KEY='enfoque_sb_session_v2';
const configured=()=>/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(ROOT)&&SUPABASE_ANON_KEY.length>30&&!SUPABASE_ANON_KEY.includes('PEGA_AQUI');
const decode=(token)=>{try{const part=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(atob(part.padEnd(Math.ceil(part.length/4)*4,'=')))}catch{return null}};
const persist=s=>{localStorage.setItem(SESSION_KEY,JSON.stringify(s));return s};
async function request(path,options={},token=null){
 if(!configured())throw new Error('Falta configurar SUPABASE_ANON_KEY en js/supabase-config.js');
 const headers={apikey:SUPABASE_ANON_KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(options.headers||{})};
 const response=await fetch(ROOT+path,{...options,headers});
 const raw=await response.text();let body=null;try{body=raw?JSON.parse(raw):null}catch{body=raw}
 if(!response.ok){const message=body?.msg||body?.message||body?.error_description||'Error de Supabase ('+response.status+')';throw new Error(message)}
 return body;
}
export const cloudSync={
 isConfigured:configured,
 getSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}},
 logout(){localStorage.removeItem(SESSION_KEY)},
 captureSessionFromUrl(){
  const params=new URLSearchParams(location.hash.slice(1));
  const accessToken=params.get('access_token');
  if(!accessToken)return this.getSession();
  const claims=decode(accessToken);if(!claims?.sub)return null;
  const session=persist({accessToken,refreshToken:params.get('refresh_token')||'',userId:claims.sub,email:params.get('email')||'',expiresAt:Number(claims.exp||0)*1000});
  history.replaceState(null,'',location.pathname+location.search);
  return session;
 },
 async getValidSession(){
  let session=this.getSession();if(!session)return null;
  if(session.expiresAt>Date.now()+60000)return session;
  if(!session.refreshToken){this.logout();return null}
  try{const result=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refreshToken})});
   const claims=decode(result.access_token);session=persist({accessToken:result.access_token,refreshToken:result.refresh_token||session.refreshToken,userId:result.user?.id||claims?.sub,email:result.user?.email||session.email,expiresAt:Number(result.expires_at||claims?.exp||0)*(Number(result.expires_at)?1000:1000)});
   return session;
  }catch{this.logout();return null}
 },
 async sendMagicLink(email){
  if(!configured())throw new Error('Configura la clave pública en js/supabase-config.js antes de conectar');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email||''))throw new Error('Introduce un correo electrónico válido');
  await request('/auth/v1/otp',{method:'POST',body:JSON.stringify({email,create_user:true,options:{emailRedirectTo:location.href.split('#')[0]}})});
  return true;
 },
 async pullState(){
  const session=await this.getValidSession();if(!session)return null;
  const rows=await request('/rest/v1/user_agendas?select=payload,updated_at&user_id=eq.'+encodeURIComponent(session.userId),{method:'GET'},session.accessToken);
  if(!Array.isArray(rows)||!rows.length)return null;
  const payload=rows[0].payload;
  if(payload&&typeof payload==='object')payload.updatedAt=Date.parse(rows[0].updated_at)||payload.updatedAt;
  return payload;
 },
 async pushState(_session,state){
  const session=await this.getValidSession();if(!session)return false;
  await request('/rest/v1/user_agendas?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:session.userId,payload:state,updated_at:new Date().toISOString()})},session.accessToken);
  return true;
 },
 async sync(state){const session=await this.getValidSession();if(!session)return {synced:false,reason:'signed-out'};await this.pushState(session,state);return {synced:true}},
 async signOut(){const session=await this.getValidSession();if(session)try{await request('/auth/v1/logout',{method:'POST'},session.accessToken)}finally{this.logout()}else this.logout()}
};
