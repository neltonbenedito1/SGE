const SHELL_CACHE = 'sysedu-shell-v2';
const ASSETS_CACHE = 'sysedu-assets-v2';
const MEDIA_CACHE = 'sysedu-media-v2';

const VALID_CACHES = new Set([SHELL_CACHE, ASSETS_CACHE, MEDIA_CACHE]);
const MAX_MEDIA_ENTRIES = 120;
const MAX_ASSET_ENTRIES = 80;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/Logo2.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cache) => {
            if (!VALID_CACHES.has(cache)) {
              return caches.delete(cache);
            }
            return Promise.resolve();
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxEntries) {
      const toDelete = keys.slice(0, keys.length - maxEntries);
      await Promise.all(toDelete.map((k) => cache.delete(k)));
    }
  } catch {
    // Ignorar falhas de quota em WebView
  }
}

function isBypassedRequest(url) {
  const path = url.pathname;
  if (
    path.startsWith('/api') ||
    path.startsWith('/src/') ||
    path.startsWith('/@vite') ||
    path.startsWith('/@react-refresh') ||
    path.startsWith('/node_modules/') ||
    path === '/sw.js'
  ) {
    return true;
  }

  if (
    url.hostname.includes('firestore') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('securetoken') ||
    url.hostname.includes('stripe.com') ||
    url.protocol === 'chrome-extension:'
  ) {
    return true;
  }

  return false;
}

function isImmutableAsset(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    url.hostname === 'unpkg.com' ||
    url.hostname === 'cdnjs.cloudflare.com'
  );
}

function isMediaFile(url) {
  return /\.(png|jpe?g|webp|svg|gif|ico|woff2?|ttf|pdf)(\?|$)/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }

  if (isBypassedRequest(url)) {
    return;
  }

  // 1. Assets imutáveis (bundles Vite com hash, fontes e bibliotecas CDN): Cache-First
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.open(ASSETS_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;

        const networkResponse = await fetch(event.request);
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          cache.put(event.request, networkResponse.clone()).then(() => trimCache(ASSETS_CACHE, MAX_ASSET_ENTRIES));
        }
        return networkResponse;
      })
    );
    return;
  }

  // 2. Ficheiros de media estáticos (imagens, ícones, PDFs locais): Stale-While-Revalidate
  if (isMediaFile(url)) {
    event.respondWith(
      caches.open(MEDIA_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        const networkPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone()).then(() => trimCache(MEDIA_CACHE, MAX_MEDIA_ENTRIES));
            }
            return networkResponse;
          })
          .catch(() => cached);

        return cached || networkPromise;
      })
    );
    return;
  }

  // 3. Navegação HTML / App Shell: Network-First com fallback offline para '/'
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic' && event.request.mode === 'navigate') {
          const responseToCache = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, responseToCache));
        }
        return response;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
        return undefined;
      })
  );
});
