self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

const CACHE_NAME = 'consubov-v7';
const HASHED_ASSET_PATTERN = /\/assets\/.+\.[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|svg|gif|wasm)$/i;

// ZXing wasm/worker assets are loaded lazily by the QR scanner. Pre-warm
// the runtime cache so the camera works after long offline periods.
async function precacheZxingAssets(cache) {
  try {
    const res = await fetch('/');
    if (!res.ok) return;
    const html = await res.text();
    const matches = html.match(/\/assets\/[^"'\s]+\.(?:js|wasm)/g) || [];
    const zxing = matches.filter((p) => /zxing|qr|barcode/i.test(p));
    await Promise.all(
      zxing.map((path) =>
        fetch(path)
          .then((r) => (r && r.ok ? cache.put(path, r.clone()) : null))
          .catch(() => null),
      ),
    );
  } catch {
    /* ignore — best-effort warmup */
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => precacheZxingAssets(cache))
      .catch(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function safeCacheMatch(request) {
  try {
    return await caches.match(request);
  } catch {
    return undefined;
  }
}

async function safeCachePut(request, response) {
  try {
    if (!shouldCacheRequest(request)) return;
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response);
  } catch {
    /* ignore quota / opaque errors */
  }
}

function shouldCacheRequest(request) {
  if (request.method !== 'GET') return false;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/manifest.json' || url.pathname === '/sw.js') {
    return false;
  }

  return HASHED_ASSET_PATTERN.test(url.pathname);
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);

    if (response && response.status === 200 && shouldCacheRequest(request)) {
      void safeCachePut(request, response.clone());
    }

    return response;
  } catch {
    const cached = await safeCacheMatch(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await safeCacheMatch(fallbackUrl);
      if (fallback) return fallback;
    }
    // Last-resort empty response so the SW never throws to the page
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

async function cacheFirst(request) {
  return networkFirst(request);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const rawUrl = request.url || '';

  // Hard passthrough for camera / extensions / inline data — never intercept
  if (
    rawUrl.startsWith('blob:') ||
    rawUrl.startsWith('mediastream:') ||
    rawUrl.startsWith('chrome-extension:') ||
    rawUrl.startsWith('moz-extension:') ||
    rawUrl.startsWith('data:') ||
    rawUrl.includes('mediastream')
  ) {
    return;
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (request.method !== 'GET') {
    // Let non-GET requests go straight to the network without SW handling
    return;
  }

  if (url.pathname === '/sw.js' || url.pathname === '/index.html' || url.pathname === '/manifest.json') {
    event.respondWith(fetch(request));
    return;
  }

  // Navigation: always try network, fall back to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await networkFirst(request, '/index.html');
        } catch {
          const fallback = await safeCacheMatch('/index.html');
          return fallback || new Response('', { status: 504, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  // Supabase / API: network-first, no fallback page
  if (url.hostname.includes('supabase') || url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/')) {
    event.respondWith(
      (async () => {
        try {
          return await networkFirst(request);
        } catch {
          return new Response('', { status: 504, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  // Same-origin hashed assets: network-first, falling back to cache when offline
  event.respondWith(
    (async () => {
      try {
        return await networkFirst(request);
      } catch {
        const cached = await safeCacheMatch(request);
        return cached || new Response('', { status: 504, statusText: 'Offline' });
      }
    })()
  );
});

// Global safety net so a rejected promise never tears down the SW
self.addEventListener('error', (event) => {
  console.warn('[SW] error event:', event.message);
});
self.addEventListener('unhandledrejection', (event) => {
  console.warn('[SW] unhandledrejection:', event.reason);
  event.preventDefault?.();
});
