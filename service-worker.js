self.addEventListener('install', (e) => {
    console.log('[Service Worker] Instalado');
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    console.log('[Service Worker] Ativado');
});

// Cache básico para arquivos essenciais
const CACHE_NAME = 'controle-dispositivos-v1';
const urlsToCache = [
    './',
    './index.html'
];

self.addEventListener('install', async (e) => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(urlsToCache);
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});
