const CACHE_NAME = 'fsma-calculator-v14';
const NETWORK_TIMEOUT_MS = 4000;

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './fonts.css',
  './calc.js',
  './app.js',
  './thresholds.json',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // Self-hosted fonts. We precache the 'latin' subset (normal English text) so
  // the app renders correctly offline immediately. The 'latin-ext' subset
  // (accented names) is cached on demand by the fetch handler below.
  './fonts/Inter-300-latin.woff2',
  './fonts/Inter-400-latin.woff2',
  './fonts/Inter-500-latin.woff2',
  './fonts/Inter-600-latin.woff2',
  './fonts/Inter-700-latin.woff2',
  './fonts/Outfit-400-latin.woff2',
  './fonts/Outfit-500-latin.woff2',
  './fonts/Outfit-600-latin.woff2',
  './fonts/Outfit-700-latin.woff2',
  './fonts/Outfit-800-latin.woff2',
  // Farmer walkthrough — available offline after first install
  './user-guide/index.html',
  './user-guide/FSMA-Calculator-Walkthrough.pdf',
  './user-guide/images/guide-01-farm-info.png',
  './user-guide/images/guide-02-sales-records.png',
  './user-guide/images/guide-04-planner.png',
  './user-guide/images/guide-05-letter-preview.png',
  './user-guide/images/guide-06-letter-signature.png',
  './user-guide/images/guide-07-status-qualified.png'
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isThresholds(url) {
  return url.pathname.endsWith('/thresholds.json');
}

function isNavigation(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

function cacheableResponse(res) {
  return res && (res.status === 200 || res.type === 'opaque');
}

async function putInCache(request, response) {
  if (!cacheableResponse(response)) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
}

// Always try the network for thresholds so online users get the latest FDA figures.
async function networkFirst(request) {
  try {
    const res = await fetch(request);
    await putInCache(request, res.clone());
    return res;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error('Network error and no cache match');
  }
}

async function matchCached(request) {
  const cache = await caches.open(CACHE_NAME);
  const direct = await cache.match(request);
  if (direct) return direct;

  const url = new URL(request.url);
  if (url.pathname.includes('user-guide')) {
    return cache.match('./user-guide/index.html');
  }
  return cache.match('./index.html') || cache.match('./');
}

// Return cached shell immediately; refresh in the background when online.
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await matchCached(request);

  const networkUpdate = fetch(request)
    .then((res) => {
      if (cacheableResponse(res)) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);

  if (cached) {
    networkUpdate;
    return cached;
  }

  const res = await networkUpdate;
  if (res) return res;

  const fallback = await matchCached(request);
  if (fallback) return fallback;
  throw new Error('No cached navigation response');
}

// Try the network briefly, then fall back to cache on slow rural connections.
async function networkFirstWithTimeout(request, timeoutMs) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
    ]);
    await putInCache(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return fetch(request);
  }
}

// Install Event - cache assets. We intentionally do NOT skipWaiting here:
// the new worker waits until the user accepts the in-app update prompt.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching files...');
      return cache.addAll(ASSETS);
    })
  );
});

// Activate immediately when the page asks us to (via the update prompt)
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate Event - clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  if (!isSameOrigin(url)) return;

  if (isThresholds(url)) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  if (isNavigation(e.request)) {
    e.respondWith(staleWhileRevalidate(e.request));
    return;
  }

  e.respondWith(networkFirstWithTimeout(e.request, NETWORK_TIMEOUT_MS));
});
