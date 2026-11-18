const CACHE_NAME='enfoque-diario-v4';
const BASE=new URL('./',self.location.href);
const ASSETS=['./','./index.html','./styles.css','./manifest.json','./icon.svg','./js/app.js','./js/storage.js','./js/cloud-sync.js','./js/supabase-config.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url);if(url.origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cached=await caches.match(request);if(cached)return cached;
  try{const response=await fetch(request);if(response.ok&&url.origin===self.location.origin){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy))}return response}
  catch(error){if(request.mode==='navigate')return (await caches.match('./index.html'))||Response.error();return Response.error()}
 })());
});
