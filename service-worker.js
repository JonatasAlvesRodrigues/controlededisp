const CACHE_NAME = 'controle-dispositivos-v2';
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(APP_SHELL);
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => {
            if (key !== CACHE_NAME) {
                return caches.delete(key);
            }
            return Promise.resolve();
        }));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') {
        return;
    }

    const requestUrl = new URL(event.request.url);
    const isHtmlNavigation =
        event.request.mode === 'navigate' ||
        requestUrl.pathname.endsWith('.html') ||
        event.request.headers.get('accept')?.includes('text/html');

    if (isHtmlNavigation) {
        event.respondWith((async () => {
            try {
                const networkResponse = await fetch(event.request);
                const cache = await caches.open(CACHE_NAME);
                cache.put(event.request, networkResponse.clone());
                return networkResponse;
            } catch (error) {
                const cachedResponse = await caches.match(event.request);
                return cachedResponse || caches.match('./index.html');
            }
        })());
        return;
    }

    event.respondWith((async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
            return cachedResponse;
        }

        try {
            const networkResponse = await fetch(event.request);
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
        } catch (error) {
            return new Response('Offline', { status: 503, statusText: 'Offline' });
        }
    })());
});
