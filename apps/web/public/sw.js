// Build timestamp is injected at build-time by vite.config.ts.
// In dev it stays as the literal string, which is fine — dev SW is unregistered.
const BUILD_VERSION = '__BUILD_TIMESTAMP__';
const CACHE_VERSION = `v-${BUILD_VERSION}`;
const CACHE_NAME = `consubov-${CACHE_VERSION}`;
const SHELL_CACHE = `consubov-shell-${CACHE_VERSION}`;
// Vite injects all build assets; the source placeholder keeps dev/tests valid.
const PRECACHE_ASSETS = '__PRECACHE_ASSETS__';
const SW_VERSION_RESPONSE = new Response(CACHE_VERSION, {
  headers: {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  },
});

async function notifyClientsAboutActivatedVersion() {
  try {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(
      clientList.map(async (client) => {
        try {
          client.postMessage({ type: 'CONSUBOV_SW_ACTIVATED', version: BUILD_VERSION, cacheVersion: CACHE_VERSION });
        } catch {
          /* ignore */
        }

        // A navegação é coordenada exclusivamente pelo cliente. Fazer também
        // client.navigate() aqui disputava com controllerchange/activation e
        // podia causar duas ou mais recargas antes do React montar.
      }),
    );
  } catch {
    /* ignore — best-effort */
  }
}

const HASHED_ASSET_PATTERN = /\/assets\/.+\.[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|svg|gif|wasm)$/i;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// The install promise fails on missing critical assets. The existing worker then
// stays active and no partial app shell can replace a working offline version.
async function precacheAppShell() {
  const shell = await caches.open(SHELL_CACHE);
  const assets = await caches.open(CACHE_NAME);
  try {
    const response = await fetch('/index.html', { cache: 'no-store' });
    if (!response.ok) throw new Error('app-shell-unavailable');
    const html = await response.clone().text();
    const entries = [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+\.(?:js|css))["']/g)]
      .map((match) => match[1]);
    const bundledAssets = Array.isArray(PRECACHE_ASSETS) ? PRECACHE_ASSETS : [];
    const critical = [...new Set([...entries, ...bundledAssets])];
    if (!entries.some((asset) => asset.endsWith('.js'))) {
      throw new Error('missing-entrypoint-js');
    }
    let nextAsset = 0;
    let failureDetected = false;
    let firstThrownValue;
    // Bound the full fetch/put pipeline and drain every worker before cleanup.
    await Promise.all(Array.from({ length: Math.min(4, critical.length) }, async () => {
      while (!failureDetected && nextAsset < critical.length) {
        const asset = critical[nextAsset++];
        try {
          const result = await fetch(asset, { cache: 'no-store' });
          if (!result.ok) throw new Error('critical-asset-unavailable: ' + asset);
          await assets.put(asset, result.clone());
        } catch (error) {
          if (!failureDetected) {
            failureDetected = true;
            firstThrownValue = error;
          }
        }
      }
    }));
    if (failureDetected) throw firstThrownValue;
    await shell.put('/index.html', response.clone());
    await shell.put('/', response.clone());
  } catch (error) {
    // Never leave a partial generation that future cleanup might trust.
    await Promise.all([caches.delete(CACHE_NAME), caches.delete(SHELL_CACHE)]);
    throw error;
  }
}

function knownGeneration(name) {
  if (name.startsWith('consubov-shell-v-')) return name.slice('consubov-shell-'.length);
  if (name.startsWith('consubov-v-')) return name.slice('consubov-'.length);
  return null;
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell());
  // Do not call skipWaiting here. Updates require explicit user action.
  // First install activates naturally when there is no previous controller.
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const generations = [...new Set(keys.map(knownGeneration).filter(Boolean))];
    const previous = generations.filter((value) => value !== CACHE_VERSION).at(-1);
    const retained = new Set([CACHE_VERSION, previous].filter(Boolean));
    await Promise.all(keys.filter((name) => {
      const generation = knownGeneration(name);
      return generation !== null && !retained.has(generation);
    }).map((name) => caches.delete(name)));
    // Do not touch unrelated caches or any IndexedDB/localStorage data.
    await self.clients.claim();
    await notifyClientsAboutActivatedVersion();
    // A client decides whether it is safe to reload; never navigate it here.
  })());
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
  const cached = await cache.match(request) || await safeCacheMatch(request);
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

// Keep the installed HTML bound to its fully precached JS/CSS generation.
// Serving network HTML under the old controller would mix builds before consent.
async function pinnedShellNavigation(request) {
  const installed = await safeCacheMatch('/index.html', SHELL_CACHE);
  if (installed) return installed;
  return networkFirstWithFallback(request, '/index.html');
}

async function networkOnlyNoStore(request) {
  try {
    return await fetch(request, { cache: 'no-store' });
  } catch {
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
    // The installed HTML is an atomic snapshot of its JS/CSS. Do not overwrite
    // it with a newer HTML that may reference uncached assets from another build.
    if (response && response.status === 200 && fallbackUrl !== '/index.html') {
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
    event.respondWith(pinnedShellNavigation(request));
    return;
  }

  if (url.pathname === '/manifest.json') {
    event.respondWith(networkFirstWithFallback(request, '/manifest.json'));
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

// ----- Web Push -----
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'CONSUBOV', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'CONSUBOV';
  // Tag ÚNICO por notificação para evitar deduplicação acidental:
  // a versão anterior usava sempre o mesmo tag e suprimia notificações
  // subsequentes — por isso "só caía a primeira".
  const uniqueTag = data.tag || `consubov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-96.png',
    image: data.image,
    tag: uniqueTag,
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const isUpdate = data.type === 'update' || event.notification.tag === 'consubov-update';
  // Push payloads are untrusted: never use them to navigate outside this PWA.
  let targetUrl = `${self.location.origin}/`;
  try {
    const candidate = new URL(data.url || '/', self.location.origin);
    if (candidate.origin === self.location.origin) targetUrl = candidate.toString();
  } catch {
    // Keep the safe same-origin fallback.
  }

  event.waitUntil(
    (async () => {
      console.log('[SW update] clique recebido', { isUpdate, targetUrl });

      const updateToken = Date.now().toString();
      const withUpdateToken = (rawUrl) => {
        try {
          const url = new URL(rawUrl, self.location.origin);
          url.searchParams.set('_update', updateToken);
          return url.toString();
        } catch {
          return `/?_update=${updateToken}`;
        }
      };

      // The client checks critical operations before issuing SKIP_WAITING.
      // Never activate a waiting worker directly from notificationclick.

      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = clientList[0];
      if (client) {
        if (isUpdate) {
          client.postMessage({ type: 'CONSUBOV_APPLY_UPDATE', updateToken });
          // The client decides when it may reload. Navigating it here could
          // interrupt a field operation before the critical-work guard runs.
        } else {
          await client.navigate(targetUrl).catch(() => undefined);
        }
        await client.focus().catch(() => undefined);
        return;
      }

      if (self.clients.openWindow) {
        const openUrl = isUpdate
          ? withUpdateToken(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}__sw_update=1`)
          : targetUrl;
        console.log('[SW update] nenhuma aba aberta; abrindo', openUrl);
        await self.clients.openWindow(openUrl);
      }
    })(),
  );
});


self.addEventListener('error', (event) => {
  console.warn('[SW] error event:', event.message);
});
self.addEventListener('unhandledrejection', (event) => {
  console.warn('[SW] unhandledrejection:', event.reason);
  event.preventDefault?.();
});
