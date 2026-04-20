// Build timestamp is injected at build-time by vite.config.ts.
// In dev it stays as the literal string, which is fine — dev SW is unregistered.
const BUILD_VERSION = '__BUILD_TIMESTAMP__';
const CACHE_NAME = `consubov-v-${BUILD_VERSION}`;
const SHELL_CACHE = `consubov-shell-v-${BUILD_VERSION}`;

const HASHED_ASSET_PATTERN = /\/assets\/.+\.[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|svg|gif|wasm)$/i;
const NEVER_CACHE = new Set(['/index.html', '/manifest.json', '/sw.js']);
const STALE_WHILE_REVALIDATE_PATHS = new Set(['/', '/index.html', '/manifest.json']);

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

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
  // New SW takes over immediately on install.
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => precacheZxingAssets(cache))
      .catch(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
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

// Stale-While-Revalidate: serve cache immediately, refresh in background.
async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone()).catch(() => undefined);
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) {
    // Kick off revalidation but return cached immediately.
    event => event;
    networkPromise;
    return cached;
  }

  const network = await networkPromise;
  if (network) return network;
  return new Response('', { status: 504, statusText: 'Offline' });
}

// Cache-First for hashed static assets.
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

// Network-First for everything else (e.g. Supabase, API).
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

  // sw.js itself is never cached.
  if (url.pathname === '/sw.js') {
    event.respondWith(fetch(request));
    return;
  }

  // Stale-While-Revalidate for app shell (index.html, manifest.json) and navigations.
  if (
    request.mode === 'navigate' ||
    STALE_WHILE_REVALIDATE_PATHS.has(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(new Request('/index.html', { credentials: request.credentials })));
    return;
  }

  // Supabase / API: network-first, no cached fallback page.
  if (url.hostname.includes('supabase') || url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Hashed static assets: cache-first.
  if (url.origin === self.location.origin && isHashedAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Default: network-first with cache fallback.
  event.respondWith(networkFirst(request));
});

self.addEventListener('error', (event) => {
  console.warn('[SW] error event:', event.message);
});
self.addEventListener('unhandledrejection', (event) => {
  console.warn('[SW] unhandledrejection:', event.reason);
  event.preventDefault?.();
});
