const SUPABASE_URL=(document.querySelector('meta[name="supabase-url"]')?.content||'').replace(/\/$/,'');
const SUPABASE_ANON_KEY=document.querySelector('meta[name="supabase-anon-key"]')?.content||'';
const SESSION_KEY='enfoque_sb_session';
export const cloudSync={
 isConfigured(){return /^https:\/\//.test(SUPABASE_URL)&&SUPABASE_ANON_KEY.length>20},
 getSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}},
 logout(){localStorage.removeItem(SESSION_KEY)},
 captureSessionFromUrl(){const p=new URLSearchParams(location.hash.slice(1));const token=p.get('access_token');if(!token)return this.getSession();try{const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));const session={accessToken:token,refreshToken:p.get('refresh_token'),userId:payload.sub,email:payload.email};localStorage.setItem(SESSION_KEY,JSON.stringify(session));history.replaceState(null,'',location.pathname+location.search);return session}catch{return null}},
 async sendMagicLink(email){if(!this.isConfigured())throw new Error('Configura la URL y la clave pública de Supabase en el HTML para activar la sincronización');const r=await fetch(SUPABASE_URL+'/auth/v1/otp',{method:'POST',headers:{apikey:SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,create_user:true,options:{emailRedirectTo:location.href.split('#')[0]}})});if(!r.ok)throw new Error('No se pudo enviar el enlace de acceso');return true},
 async pullState(session){if(!this.isConfigured()||!session)return null;const r=await fetch(SUPABASE_URL+'/rest/v1/user_agendas?user_id=eq.'+encodeURIComponent(session.userId)+'&select=payload,updated_at',{headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+session.accessToken}});if(!r.ok)throw new Error('No se pudo descargar la agenda');const rows=await r.json();return rows[0]?.payload||null},
 async pushState(session,state){if(!this.isConfigured()||!session)return;const r=await fetch(SUPABASE_URL+'/rest/v1/user_agendas',{method:'POST',headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},body:JSON.stringify({user_id:session.userId,payload:state,updated_at:new Date().toISOString()})});if(!r.ok)throw new Error('No se pudo sincronizar la agenda')}
};
