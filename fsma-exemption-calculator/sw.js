const CACHE_NAME = 'fsma-calculator-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './thresholds.json',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install Event - cache assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching files...');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
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

// Fetch Event - network first, fallback to cache
self.addEventListener('fetch', (e) => {
  // Only handle GET requests to avoid TyperError on caching POST/PUT/DELETE
  if (e.request.method !== 'GET') {
    return;
  }

  e.respondWith(
    fetch(e.request).then((res) => {
      // Clone response to put it in cache
      const resClone = res.clone();
      caches.open(CACHE_NAME).then((cache) => {
        // Only cache HTTP/HTTPS successful responses (avoid chrome-extension issues)
        if (e.request.url.startsWith('http') && res.status === 200) {
          cache.put(e.request, resClone);
        }
      });
      return res;
    }).catch(() => {
      // If network fails, serve from cache
      return caches.match(e.request);
    })
  );
});
