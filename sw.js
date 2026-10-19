/* Service worker: rende l'app installabile e la apre anche con rete scarsa.
   Strategia "prima la rete": i file aggiornati arrivano subito,
   la copia salvata si usa solo se la rete non risponde.
   Le chiamate /api/ non vengono mai salvate in cache. */
const CACHE = 'gdc-v2';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/api.js', 'js/app.js', 'js/vendor/jspdf.umd.min.js', 'js/vendor/jspdf.plugin.autotable.min.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.includes('/api/')) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && (url.origin === location.origin || url.hostname === 'cdnjs.cloudflare.com')) {
        const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
