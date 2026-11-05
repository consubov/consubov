// Service Worker - CONSUBOV Fazendas Shell PWA
// Autoupdate sem clique, retenção de 2 gerações de cache (N e N-1) e Quiescência
const SW_VERSION = 'v1';
const CURRENT_CACHE = `consubov-fazendas-${SW_VERSION}`;
const PREVIOUS_CACHE = 'consubov-fazendas-v0';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest'
];

// 1. INSTALL: Download silencioso dos assets em segundo plano
// REGRA MANDATÓRIA DE CONFINAMENTO OPERACIONAL: NUNCA chamar self.skipWaiting() aqui!
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CURRENT_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        // Falha tolerada em ambiente offline ou de testes
        console.warn('[SW_INSTALL] Falha tolerada no pré-cache:', err);
      });
    })
  );
  // O Service Worker aguarda no estado "installed" (waiting) até que o cliente atinja quiescência
});

// 2. ESCUTA DE MENSAGENS: Ativação segura solicitada pelo UpdateCoordinator
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Ponto de quiescência confirmado pelo cliente. Executando skipWaiting()...');
    self.skipWaiting();
  }
});

// 3. ACTIVATE: Retenção de 2 gerações (N e N-1), expurgo de caches anteriores e claim imediato
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        // Identifica todos os caches de fazenda
        const appCacheKeys = keys.filter((key) => key.startsWith('consubov-fazendas-'));

        // Extrai as duas versões que devem ser preservadas: a atual e a imediatamente anterior
        // Se houver mais de 2 versões, deleta as anteriores a N-1
        return Promise.all(
          appCacheKeys.map((key) => {
            if (key !== CURRENT_CACHE && key !== PREVIOUS_CACHE) {
              console.log(`[SW_ACTIVATE] Purgando cache legado além de N-1: ${key}`);
              return caches.delete(key);
            }
            return Promise.resolve(false);
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// 4. FETCH: Interceptação resiliente com fallback para versão N-1 em chunks 404
self.addEventListener('fetch', (event) => {
  // Ignora requisições de API central (essas têm fila outbox e persistência IndexedDB própria)
  if (event.request.url.includes('/api/v1/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request, { cacheName: CURRENT_CACHE }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          // Se a rede retornar 404 em um chunk de script, tenta o cache N-1 antes de propagar falha
          if (
            networkResponse.status === 404 &&
            (event.request.url.endsWith('.js') || event.request.url.includes('/modules/'))
          ) {
            console.warn(`[SW_FETCH] Chunk retornou 404 na rede (${event.request.url}). Tentando cache N-1...`);
            return caches.match(event.request, { cacheName: PREVIOUS_CACHE }).then((nMinusOneResponse) => {
              if (nMinusOneResponse) {
                return nMinusOneResponse;
              }
              return networkResponse;
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Em falha total de rede offline, tenta cache N-1 como fallback adicional
          return caches.match(event.request, { cacheName: PREVIOUS_CACHE }).then((nMinusOneResponse) => {
            if (nMinusOneResponse) {
              return nMinusOneResponse;
            }

            // Fallback para index.html em navegações SPA offgrid
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html', { cacheName: CURRENT_CACHE });
            }

            return new Response('Offline', { status: 503, statusText: 'Offline Mode' });
          });
        });
    })
  );
});
