// Build timestamp is injected at build-time by vite.config.ts.
// In dev it stays as the literal string, which is fine — dev SW is unregistered.
const BUILD_VERSION = '__BUILD_TIMESTAMP__';
const CACHE_VERSION = `v-${BUILD_VERSION}`;
const CACHE_NAME = `consubov-${CACHE_VERSION}`;
const SHELL_CACHE = `consubov-shell-${CACHE_VERSION}`;
const SW_VERSION_RESPONSE = new Response(CACHE_VERSION, {
  headers: {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  },
});

const HASHED_ASSET_PATTERN = /\/assets\/.+\.[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|svg|gif|wasm)$/i;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function precacheZxingAssets(cache) {
  try {
    const res = await fetch('/', { cache: 'no-store' });
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
  console.log('[SW] install', CACHE_VERSION);
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => precacheZxingAssets(cache))
      .catch(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] activate', CACHE_VERSION);
  const validCaches = new Set([CACHE_NAME, SHELL_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !validCaches.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function safeCacheMatch(request, cacheName) {
  try {
    if (cacheName) {
      const cache = await caches.open(cacheName);
      return await cache.match(request);
    }
    return await caches.match(request);
  } catch {
    return undefined;
  }
}

function isHashedAsset(url) {
  return HASHED_ASSET_PATTERN.test(url.pathname);
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request, { cache: 'no-store' })
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone()).catch(() => undefined);
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) return cached;

  const network = await networkPromise;
  if (network) return network;
  return new Response('', { status: 504, statusText: 'Offline' });
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

async function networkFirst(request, fallbackUrl) {
  try {
    return await fetch(request);
  } catch {
    const cached = await safeCacheMatch(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await safeCacheMatch(fallbackUrl, SHELL_CACHE);
      if (fallback) return fallback;
    }
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

// Network-first com timeout curto: tenta sempre buscar a versão mais recente,
// mas cai no cache do shell se a rede estiver lenta/indisponível. Essencial
// para garantir que o capataz veja novas versões ao abrir o app, sem perder
// o modo offline.
async function networkFirstWithFallback(request, fallbackUrl, timeoutMs = 2500) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const networkPromise = fetch(request, { cache: 'no-store' });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('network-timeout')), timeoutMs),
    );
    const response = await Promise.race([networkPromise, timeoutPromise]);
    if (response && response.status === 200) {
      cache.put(fallbackUrl || request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch {
    const cached = await cache.match(fallbackUrl || request);
    if (cached) return cached;
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const rawUrl = request.url || '';

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

  if (request.method !== 'GET') return;

  if (url.pathname === '/sw.js') {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  if (url.pathname === '/sw-version') {
    event.respondWith(SW_VERSION_RESPONSE.clone());
    return;
  }

  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(staleWhileRevalidate('/index.html'));
    return;
  }

  if (url.pathname === '/manifest.json') {
    event.respondWith(staleWhileRevalidate('/manifest.json'));
    return;
  }

  if (url.pathname === '/version.json') {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  if (url.hostname.includes('supabase') || url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.origin === self.location.origin && isHashedAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

self.addEventListener('error', (event) => {
  console.warn('[SW] error event:', event.message);
});
self.addEventListener('unhandledrejection', (event) => {
  console.warn('[SW] unhandledrejection:', event.reason);
  event.preventDefault?.();
});
