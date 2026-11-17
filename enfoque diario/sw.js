const CACHE_NAME = 'enfoque-diario-v1';
const ASSETS = ['./', './index.html', './styles.css', './manifest.json', './js/app.js', './js/storage.js', './js/cloud-sync.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request)));
});
