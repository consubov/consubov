/* ADM-only static shell. No administrative API response or session enters CacheStorage. */
const ADM_RELEASE = null;
const PREFIX = `consubov-adm-${ADM_RELEASE?.mode}-`;
const STATE = `${PREFIX}state`;
const STATE_KEY = '/__adm_release_state__';
const COMPLETE_KEY = '/__adm_release_complete__';
const cacheName = release => `${PREFIX}release-${release.generation}`;
const hex = bytes => Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
const sha = async bytes => hex(await crypto.subtle.digest('SHA-256', bytes));
const origin = () => ADM_RELEASE && self.location.origin === ADM_RELEASE.origin && self.registration.scope === `${ADM_RELEASE.origin}/`;
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const state = async () => (await (await caches.open(STATE)).match(STATE_KEY))?.json() ?? {};
const save = async value => (await caches.open(STATE)).put(STATE_KEY, json(value));
// A CacheStorage read followed by put is not a transaction. Serialize every pointer mutation across worker generations.
const mutate = async (operation, deadline) => {
  if (!self.navigator?.locks) throw new Error('ADM safe release coordination is unavailable.');
  const controller = new AbortController();
  const timer = deadline ? setTimeout(() => controller.abort(), Math.max(0, deadline - Date.now())) : undefined;
  try { return await self.navigator.locks.request(`${PREFIX}release-state`, { mode: 'exclusive', signal: controller.signal }, operation); }
  finally { if (timer !== undefined) clearTimeout(timer); }
};

function validRelease(release) {
  return origin() && release && release.schemaVersion === 1 && release.mode === ADM_RELEASE.mode && release.origin === ADM_RELEASE.origin && /^[a-f0-9]{64}$/.test(release.generation)
    && release.resourceBase === `/admin-releases/${release.mode}/${release.generation}/` && Array.isArray(release.assets) && release.assets.length > 0
    && release.assets.some(asset => asset.path === '/index.html') && release.assets.some(asset => asset.path === '/manifest.webmanifest')
    && release.assets.every(asset => /^(\/index\.html|\/manifest\.webmanifest|\/assets\/[\w.-]+\.(js|css|woff2?|png|svg)|\/icons\/adm-(192|512|maskable-512)\.png)$/.test(asset.path)
      && asset.url === release.resourceBase + asset.path.slice(1) && /^[a-f0-9]{64}$/.test(asset.sha256) && Number.isSafeInteger(asset.bytes) && asset.bytes > 0);
}
async function matches(response, asset) {
  if (!response || !response.ok || response.type === 'opaque' || response.redirected) return false;
  const bytes = await response.clone().arrayBuffer();
  return bytes.byteLength === asset.bytes && await sha(bytes) === asset.sha256;
}
async function complete(release) {
  if (!validRelease(release)) return false;
  const cache = await caches.open(cacheName(release));
  if (!(await cache.match(COMPLETE_KEY))) return false;
  for (const asset of release.assets) if (!await matches(await cache.match(asset.url), asset)) return false;
  return true;
}

self.addEventListener('install', event => event.waitUntil((async () => {
  if (!validRelease(ADM_RELEASE)) throw new Error('Invalid ADM origin, scope or release.');
  const name = cacheName(ADM_RELEASE);
  if (!await complete(ADM_RELEASE)) {
    const cache = await caches.open(name);
    // A marker is committed only after every required byte is verified. No existing complete generation is deleted.
    await cache.delete(COMPLETE_KEY);
    for (const asset of ADM_RELEASE.assets) {
      const response = await fetch(new Request(asset.url, { cache: 'no-store', credentials: 'omit', redirect: 'error' }));
      if (!await matches(response, asset)) throw new Error(`Incomplete ADM static package: ${asset.path}`);
      await cache.put(asset.url, response);
    }
    await cache.put(COMPLETE_KEY, json({ generation: ADM_RELEASE.generation }));
  }
  await mutate(async () => {
    const current = await state();
    await save({ ...current, candidate: ADM_RELEASE });
  });
  // No skipWaiting here: installation and a cold browser start are not consent.
})()));

self.addEventListener('activate', event => event.waitUntil((async () => {
  if (!origin()) return;
  await mutate(async () => {
    const current = await state();
    if (!current.active && await complete(ADM_RELEASE)) await save({ ...current, active: ADM_RELEASE, candidate: ADM_RELEASE });
  });
  // A cold autoactivation retains the durable active pointer. Never clear caches or claim an existing page here.
})()));

async function soleWindow(event) {
  if (!origin() || !event.source || event.source.type !== 'window') return false;
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return windows.length === 1 && windows[0].id === event.source.id && windows[0].frameType === 'top-level' && new URL(windows[0].url).origin === ADM_RELEASE.origin;
}
const fresh = message => Number.isSafeInteger(message.clientDeadline) && message.clientDeadline > Date.now() && message.clientDeadline - Date.now() <= 30000;
self.addEventListener('message', event => {
  if (!event.ports?.[0]) return;
  event.waitUntil((async () => {
    const message = event.data ?? {};
    const port = event.ports[0];
    if (message.type === 'ADM_VERIFY_UPDATE') {
      const current = await state();
      const ready = await complete(ADM_RELEASE);
      const solo = await soleWindow(event);
      const pending = current.active?.generation !== ADM_RELEASE.generation;
      port.postMessage({ type: 'ADM_UPDATE_VERIFIED', generation: ADM_RELEASE?.generation, activeGeneration: current.active?.generation ?? null, mode: ADM_RELEASE?.mode, version: ADM_RELEASE?.version, scriptURL: self.location.href, pending, complete: ready, canActivate: ready && solo && pending && current.candidate?.generation === ADM_RELEASE.generation, reason: !ready ? 'PACKAGE_INCOMPLETE' : !solo ? 'OTHER_CLIENTS_OPEN' : undefined });
      return;
    }
    if (message.type !== 'ADM_ACTIVATE_WITH_CONSENT') return;
    if (!fresh(message)) {
      port.postMessage({ type: 'ADM_ACTIVATION_ACCEPTED', accepted: false, generation: ADM_RELEASE?.generation, scriptURL: self.location.href });
      return;
    }
    let previous;
    let promoted = false;
    let activation;
    const acknowledge = (accepted, current) => port.postMessage({ type: 'ADM_ACTIVATION_ACCEPTED', accepted, generation: ADM_RELEASE?.generation, activeGeneration: current.active?.generation ?? null, scriptURL: self.location.href });
    try {
      await mutate(async () => {
      if (!fresh(message) || message.generation !== ADM_RELEASE.generation || message.scriptURL !== self.location.href || !await soleWindow(event) || !await complete(ADM_RELEASE)) throw new Error('Invalid or expired consent.');
      previous = await state();
      if (!fresh(message) || previous.candidate?.generation !== ADM_RELEASE.generation || previous.active?.generation === ADM_RELEASE.generation || !await soleWindow(event)) throw new Error('ADM release changed before activation.');
      if (!fresh(message)) throw new Error('Expired consent.');
      await save({ active: ADM_RELEASE, previous: previous.active ?? previous.previous, candidate: ADM_RELEASE });
      promoted = true;
      // An asynchronous CacheStorage commit can cross the deadline. Restore the complete working pointer before any lifecycle side effect.
      if (!fresh(message) || !await soleWindow(event)) throw new Error('Consent expired at promotion boundary.');
      if (!fresh(message)) throw new Error('Expired consent.');
      // Invoke at the validated side-effect boundary, then release the lock before awaiting:
      // Chromium may resolve skipWaiting only after activate, whose pointer initialization uses this same lock.
      activation = self.skipWaiting();
      }, message.clientDeadline);
      await activation;
      await mutate(async () => {
        const current = await state();
        if (!fresh(message) || current.active?.generation !== ADM_RELEASE.generation || !await soleWindow(event) || !fresh(message)) throw new Error('Consent expired during worker activation.');
        acknowledge(true, current);
      }, message.clientDeadline);
    } catch {
      if (!promoted) {
        // A queued lock request may expire behind a long operation. Rejection must not wait for that same lock again.
        acknowledge(false, await state());
        return;
      }
      await mutate(async () => {
        let current = await state();
        if (promoted && previous && current.active?.generation === ADM_RELEASE.generation) {
          // A later installer may already have staged B. Restore only our promotion, never its candidate pointer.
          current = { ...current, active: previous.active, previous: previous.previous };
          await save(current);
        }
        acknowledge(false, current);
      }).catch(() => acknowledge(false, {}));
    }
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (!origin() || event.request.method !== 'GET' || url.origin !== ADM_RELEASE.origin || url.search || event.request.headers.has('authorization')) return;
  if (!(url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/manifest.webmanifest' || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/admin-releases/'))) return;
  event.respondWith((async () => {
    const current = await state();
    for (const release of [current.active, current.previous]) {
      if (!validRelease(release)) continue;
      const path = url.pathname === '/' ? '/index.html' : url.pathname;
      const asset = release.assets.find(asset => asset.path === path || asset.url === path);
      if (!asset) continue;
      const response = await (await caches.open(cacheName(release))).match(asset.url);
      if (await matches(response, asset)) return response;
      // Never silently replace an active package with unverified network bytes.
      return new Response('Não foi possível abrir o aplicativo. Tente novamente.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
    }
    return fetch(event.request);
  })());
});
