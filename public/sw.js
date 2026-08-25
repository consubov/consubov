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

async function moveClientsToActivatedBuild() {
  // Esta navegação nasce no próprio worker NOVO, depois de clients.claim().
  // Assim ela não depende do bundle/SW antigo entender mensagens novas.
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  await Promise.allSettled(
    clientList.map(async (client) => {
      try {
        const url = new URL(client.url || '/', self.location.origin);
        if (url.searchParams.get('__sw_build') === BUILD_VERSION) {
          console.log('[SW update] cliente já está no build ativado', BUILD_VERSION);
          return;
        }
        url.searchParams.delete('_update');
        url.searchParams.delete('__sw_update');
        url.searchParams.set('__sw_build', BUILD_VERSION);
        url.searchParams.set('__v', Date.now().toString());
        console.log('[SW update] SW novo forçando navegação do cliente', {
          build: BUILD_VERSION,
          url: url.toString(),
        });
        await client.navigate(url.toString());
      } catch (error) {
        console.warn('[SW update] SW novo não conseguiu navegar cliente', error);
      }
    }),
  );
}

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
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !validCaches.has(key)).map((key) => caches.delete(key)));
      await self.clients.claim();
      console.log('[SW update] novo worker assumiu os clientes', BUILD_VERSION);
      await notifyClientsAboutActivatedVersion();
      // Dá ao cliente antigo uma janela curta para reagir ao postMessage, mas
      // garante a navegação mesmo se esse bundle estiver travado ou incompatível.
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await moveClientsToActivatedBuild();
    })(),
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
    event.respondWith(networkFirstWithFallback(request, '/index.html'));
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
  const targetUrl = data.url || '/';

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

      if (isUpdate) {
        const waitingWorker = self.registration.waiting;
        if (waitingWorker) {
          console.log('[SW update] worker waiting encontrado; enviando SKIP_WAITING');
          waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        } else {
          // Isto é esperado quando o auto-update já ativou o worker antes de o
          // usuário tocar na notificação. A navegação direta ainda atualiza o app.
          console.log('[SW update] nenhum worker waiting; seguindo com navegação direta');
        }
      }

      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = clientList[0];
      if (client) {
        if (isUpdate) {
          try {
            console.log('[SW update] avisando cliente para preparar fallback');
            client.postMessage({ type: 'CONSUBOV_APPLY_UPDATE', updateToken });
          } catch (error) {
            console.warn('[SW update] falha ao avisar cliente', error);
          }

          const directUrl = withUpdateToken(client.url || targetUrl);
          console.log('[SW update] navegando cliente com cache-busting', directUrl);
          try {
            await client.navigate(directUrl);
          } catch (error) {
            console.warn('[SW update] client.navigate falhou; cliente fará fallback', error);
          }
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
