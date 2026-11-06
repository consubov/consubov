// Replaced only in generated output by the shell publisher. Never use a fixed cache generation.
const SHELL_RELEASE = null;
const MODULES = ['capataz', 'gerente', 'escritorio', 'fabrica'];
const POINTER_CACHE = 'consubov-release-pointers-v2';
const LEGACY_POINTER_CACHE = 'consubov-module-pointers-v1';
const MAX_BYTES = 32 * 1024 * 1024;
const queues = new Map();
let installedShellRelease = SHELL_RELEASE;
const hex = bytes => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
const hash = async bytes => hex(await crypto.subtle.digest('SHA-256', bytes));
const base64 = bytes => { let s = ''; for (const x of new Uint8Array(bytes)) s += String.fromCharCode(x); return btoa(s); };
const respond = (event, data) => event.ports?.[0]?.postMessage(data);
const canonical = path => new URL(path, self.location.origin).href;
async function readPointer(path) { const r = await (await caches.open(POINTER_CACHE)).match(path); return r ? r.json() : null; }
async function writePointer(path, value) { await (await caches.open(POINTER_CACHE)).put(path, new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })); }
async function boundedFetch(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const r = await fetch(url, { cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: controller.signal });
    if (!r.ok || r.type === 'opaque') throw new Error('Release resource unavailable.');
    const reader = r.body?.getReader();
    if (!reader) throw new Error('Release resource body unavailable.');
    let total = 0; const parts = [];
    while (true) { const next = await reader.read(); if (next.done) break; total += next.value.byteLength; if (total > MAX_BYTES) { await reader.cancel(); throw new Error('Release resource too large.'); } parts.push(next.value); }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    return { bytes, headers: r.headers };
  } finally { clearTimeout(timeout); }
}
function validateManifest(m, id, legacy = false) {
  if (!m || m.moduleId !== id || m.profileId !== id || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(m.version) ||
    m.protocolVersion !== 1 || !Array.isArray(m.apiVersions) || !m.apiVersions.includes('1') || m.entry !== 'index.html' ||
    !Array.isArray(m.assets) || !m.assets.length || m.assets.length > 16 ||
    ((m.localDataSchemaVersion !== undefined || !legacy) && m.localDataSchemaVersion !== 2) ||
    ((m.capabilities !== undefined || !legacy) && (!Array.isArray(m.capabilities) || m.capabilities.some(x => !['local-data.read', 'local-data.write', 'sync.pull', 'sync.push'].includes(x)))) ||
    ((m.dependencies !== undefined || !legacy) && (!Array.isArray(m.dependencies) || m.dependencies.length))) throw new Error('Module compatibility rejected.');
  let total = 0; const names = new Set();
  for (const a of m.assets) {
    if (!a || typeof a.url !== 'string' || !/^[A-Za-z0-9._-]+$/.test(a.url) || ['.', '..'].includes(a.url) || names.has(a.url) || !Number.isSafeInteger(a.bytes) || a.bytes < 0 || !/^[a-f0-9]{64}$/.test(a.sha256) || !/^sha256-[A-Za-z0-9+/]+={0,2}$/.test(a.integrity)) throw new Error('Module asset metadata rejected.');
    names.add(a.url); total += a.bytes;
  }
  if (!names.has('index.html') || total > MAX_BYTES) throw new Error('Module resource list rejected.');
  return m;
}
async function verifyGeneration(d) {
  if (!d || !MODULES.includes(d.moduleId) || !/^[a-f0-9]{64}$/.test(d.generation) || d.manifestDigest !== d.generation || !d.cacheName?.startsWith(`consubov-module-${d.moduleId}-`)) throw new Error('Unrecognized module generation.');
  const root = new URL(d.resourceBase, self.location.origin);
  if (root.origin !== self.location.origin || !root.pathname.startsWith(`/modules/${d.moduleId}/`) || root.search || root.hash) throw new Error('Unrecognized module resource root.');
  const cache = await caches.open(d.cacheName);
  const manifestResponse = await cache.match(new URL('module.json', root));
  if (!manifestResponse) throw new Error('Cached module manifest missing.');
  const manifestBytes = await manifestResponse.arrayBuffer();
  if (await hash(manifestBytes) !== d.manifestDigest) throw new Error('Cached module manifest corrupted.');
  const manifest = validateManifest(JSON.parse(new TextDecoder().decode(manifestBytes)), d.moduleId, d.legacy);
  if (JSON.stringify(manifest) !== JSON.stringify(d.manifest)) throw new Error('Pinned manifest changed.');
  for (const a of manifest.assets) {
    const response = await cache.match(new URL(a.url, root));
    if (!response) throw new Error('Cached module resource missing.');
    const bytes = await response.arrayBuffer(); const digest = await crypto.subtle.digest('SHA-256', bytes);
    if (bytes.byteLength !== a.bytes || hex(digest) !== a.sha256 || `sha256-${base64(digest)}` !== a.integrity) throw new Error('Cached module resource corrupted.');
  }
  return d;
}
async function moduleState(id) {
  let state = await readPointer(`/__modules/${id}`);
  if (state) return state;
  const old = await (await caches.open(LEGACY_POINTER_CACHE)).match(`/__module_cache/${id}`);
  if (!old) return { activeHealthy: null, previousHealthy: null, candidate: null };
  const pointer = await old.json(); const resourceBase = canonical(`/modules/${id}/current/`);
  const manifestResponse = await (await caches.open(pointer.cacheName)).match(new URL('module.json', resourceBase));
  if (!manifestResponse) return { activeHealthy: null, previousHealthy: null, candidate: null };
  const digest = await hash(await manifestResponse.arrayBuffer());
  const activeHealthy = { moduleId: id, generation: digest, manifestDigest: digest, cacheName: pointer.cacheName, resourceBase, manifest: pointer.manifest, legacy: true, health: 'healthy' };
  await verifyGeneration(activeHealthy);
  state = { activeHealthy, previousHealthy: null, candidate: null };
  return state;
}
async function healthyFallback(id, state) {
  for (const d of [state.activeHealthy, state.previousHealthy]) if (d) {
    try {
      await verifyGeneration(d);
      if (d.cacheName !== state.activeHealthy?.cacheName) await writePointer(`/__modules/${id}`, { ...state, activeHealthy: d, previousHealthy: null, candidate: state.candidate });
      return d;
    } catch { /* Try the explicit previous healthy generation only. */ }
  }
  throw new Error('No verified module generation available.');
}
async function prepareModule(id) {
  const state = await moduleState(id); let stagingName;
  try {
    const discovery = await boundedFetch(canonical(`/modules/${id}/current/module.json`));
    let manifestBytes = discovery.bytes; let legacy = true; let resourceBase = canonical(`/modules/${id}/current/`); let generation;
    const selector = JSON.parse(new TextDecoder().decode(discovery.bytes));
    if (selector.schemaVersion === 2) {
      if (selector.moduleId !== id || !/^[a-f0-9]{64}$/.test(selector.generation)) throw new Error('Module selector rejected.');
      const releaseUrl = new URL(selector.releaseUrl, self.location.origin);
      if (releaseUrl.origin !== self.location.origin || releaseUrl.pathname !== `/modules/${id}/releases/${selector.generation}/module.json` || releaseUrl.search || releaseUrl.hash) throw new Error('Immutable module path rejected.');
      manifestBytes = (await boundedFetch(releaseUrl)).bytes;
      if (await hash(manifestBytes) !== selector.generation) throw new Error('Immutable module manifest corrupted.');
      resourceBase = new URL('./', releaseUrl).href; generation = selector.generation; legacy = false;
    } else generation = await hash(manifestBytes);
    if (state.rejectedGenerations?.includes(generation)) throw new Error('Module generation quarantined.');
    const manifest = validateManifest(JSON.parse(new TextDecoder().decode(manifestBytes)), id, legacy);
    for (const existing of [state.activeHealthy, state.candidate, state.previousHealthy]) {
      if (existing?.generation === generation) { try { return await verifyGeneration(existing); } catch { /* Repair by staging separate bytes; never overwrite installed cache. */ } }
    }
    stagingName = `consubov-module-${id}-${generation}-${crypto.randomUUID()}`;
    const staging = await caches.open(stagingName);
    for (const a of manifest.assets) {
      const resource = await boundedFetch(new URL(a.url, resourceBase));
      const digest = await crypto.subtle.digest('SHA-256', resource.bytes);
      if (resource.bytes.byteLength !== a.bytes || hex(digest) !== a.sha256 || `sha256-${base64(digest)}` !== a.integrity) throw new Error('Module asset integrity rejected.');
      const headers = new Headers(resource.headers); headers.set('access-control-allow-origin', '*'); headers.set('cross-origin-resource-policy', 'cross-origin');
      await staging.put(new URL(a.url, resourceBase), new Response(resource.bytes, { headers }));
    }
    await staging.put(new URL('module.json', resourceBase), new Response(manifestBytes, { headers: { 'content-type': 'application/json' } }));
    const descriptor = { moduleId: id, generation, manifestDigest: generation, cacheName: stagingName, resourceBase, manifest, legacy, health: 'candidate' };
    await verifyGeneration(descriptor);
    const latest = await moduleState(id);
    await writePointer(`/__modules/${id}`, { ...latest, candidate: descriptor });
    // Verified generations may still be pinned by another window. Collection
    // requires live-generation accounting; only failed unpublished staging is deleted.
    return descriptor;
  } catch (error) {
    if (stagingName) await caches.delete(stagingName);
    return healthyFallback(id, state);
  }
}
async function promoteModule(id, expected) {
  let state = await moduleState(id);
  if (state.activeHealthy?.generation === expected.generation && state.activeHealthy.cacheName === expected.cacheName) return verifyGeneration(state.activeHealthy);
  if (state.candidate?.generation !== expected.generation || state.candidate.cacheName !== expected.cacheName) throw new Error('Module candidate changed.');
  await verifyGeneration(state.candidate);
  const candidate = state.candidate; state = await moduleState(id);
  if (state.candidate?.cacheName !== candidate.cacheName) throw new Error('Module candidate changed.');
  const activeHealthy = { ...candidate, health: 'healthy' };
  await writePointer(`/__modules/${id}`, { ...state, activeHealthy, previousHealthy: state.activeHealthy, candidate: null });
  return activeHealthy;
}
async function rollbackModule(id, expected, reason = 'runtime') {
  if (!['runtime', 'handshake', 'integrity', 'compatibility'].includes(reason)) throw new Error('Unknown module failure reason.');
  const state = await moduleState(id);
  const rejectedGenerations = ['runtime', 'handshake'].includes(reason) ? [...new Set([expected.generation, ...(state.rejectedGenerations ?? [])])].slice(0, 16) : state.rejectedGenerations ?? [];
  if (state.candidate?.cacheName === expected.cacheName && state.candidate.generation === expected.generation) {
    let fallback;
    try { fallback = await healthyFallback(id, state); }
    catch (error) { await writePointer(`/__modules/${id}`, { ...state, candidate: null, rejectedGenerations }); throw error; }
    await writePointer(`/__modules/${id}`, { ...state, activeHealthy: fallback, previousHealthy: fallback.cacheName === state.activeHealthy?.cacheName ? state.previousHealthy : null, candidate: null, rejectedGenerations });
    return fallback;
  }
  if (state.activeHealthy?.cacheName !== expected.cacheName || state.activeHealthy.generation !== expected.generation) throw new Error('Rollback generation changed or unavailable.');
  if (!state.previousHealthy) { await writePointer(`/__modules/${id}`, { ...state, activeHealthy: null, rejectedGenerations }); throw new Error('No previous healthy generation.'); }
  let fallback;
  try { fallback = await verifyGeneration(state.previousHealthy); }
  catch (error) { await writePointer(`/__modules/${id}`, { ...state, activeHealthy: null, previousHealthy: null, candidate: null, rejectedGenerations }); throw error; }
  await writePointer(`/__modules/${id}`, { ...state, activeHealthy: fallback, previousHealthy: null, candidate: null, rejectedGenerations });
  return fallback;
}
async function compatibleInstalledModules(release) {
  try {
    for (const id of MODULES) {
      const state = await moduleState(id); const d = state.activeHealthy;
      if (!d) continue;
      await verifyGeneration(d);
      if (!release.protocolVersions.includes(d.manifest.protocolVersion) || !d.manifest.apiVersions.some(x => release.apiVersions.includes(x))) return false;
    }
    return true;
  } catch { return false; }
}
// CacheStorage has no compare-and-swap. Every shell read/modify/write shares
// this origin lock across installing, waiting and active worker realms. Without
// the native lock API, fail closed instead of silently regressing installed bytes.
async function withPointerLock(name, operation, deadline) {
  if (!self.navigator?.locks?.request) throw new Error('RELEASE_POINTER_LOCK_UNAVAILABLE');
  if (deadline === undefined) return self.navigator.locks.request(name, { mode: 'exclusive' }, operation);
  assertDeadline(deadline);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(0, deadline - Date.now()));
  try { return await self.navigator.locks.request(name, { mode: 'exclusive', signal: controller.signal }, operation); }
  catch (error) { if (controller.signal.aborted) throw new Error('ACTIVATION_LEASE_EXPIRED'); throw error; }
  finally { clearTimeout(timeout); }
}
function withShellLock(operation, deadline) { return withPointerLock('consubov-shell-pointer-v2', operation, deadline); }
async function shellState() {
  const state = await readPointer('/__shell'); if (state) return state;
  // Explicit legacy adapter: preserve the installed shell without rewriting its bytes.
  const names = await caches.keys();
  for (const name of ['consubov-fazendas-v2', 'consubov-fazendas-v1']) if (names.includes(name) && await (await caches.open(name)).match('/index.html')) {
    const old = { generation: `legacy-${name}`, cacheName: name, legacy: true };
    const migrated = { active: old, previous: null, candidate: null, consentedGeneration: null };
    return migrated;
  }
  return { active: null, previous: null, candidate: null, consentedGeneration: null };
}
async function stageShell() {
  const manifestUrl = SHELL_RELEASE?.manifestUrl ?? '/shell-assets.json';
  const resource = await boundedFetch(canonical(manifestUrl));
  const digest = await hash(resource.bytes);
  if (SHELL_RELEASE && digest !== SHELL_RELEASE.manifestSha256) throw new Error('Shell manifest digest rejected.');
  const manifest = JSON.parse(new TextDecoder().decode(resource.bytes));
  if (!Array.isArray(manifest.assets) || !manifest.assets.length || manifest.assets.length > 200 || !manifest.assets.some(a => a.url === '/index.html') || !manifest.assets.some(a => a.url === '/manifest.webmanifest')) throw new Error('Complete shell manifest required.');
  const release = SHELL_RELEASE ?? { generation: digest, manifestSha256: digest, manifestUrl, resourceBase: '/', protocolVersions: [1], apiVersions: ['1'] };
  const cacheName = `consubov-shell-${release.generation}-${crypto.randomUUID()}`;
  const names = new Set(); let size = 0; const verified = [];
  for (const a of manifest.assets) {
    if (!a || typeof a.url !== 'string' || !/^\/[A-Za-z0-9/_.-]+$/.test(a.url) || a.url.split('/').some(x => x === '..' || x === '.') || names.has(a.url) || !Number.isSafeInteger(a.bytes) || a.bytes < 0 || !/^[a-f0-9]{64}$/.test(a.sha256)) throw new Error('Shell resource metadata rejected.');
    names.add(a.url); size += a.bytes; if (size > MAX_BYTES) throw new Error('Shell too large.');
    const item = await boundedFetch(new URL(a.url.slice(1), canonical(release.resourceBase)));
    if (item.bytes.byteLength !== a.bytes || await hash(item.bytes) !== a.sha256) throw new Error('Shell resource corrupted.');
    verified.push([canonical(a.url), new Response(item.bytes, { headers: item.headers })]);
  }
  // Stage into an unpublished cache: another worker may promote while these
  // writes and verification await. Only pointer publication needs the origin lock.
  const candidate = { ...release, cacheName, legacy: false };
  const cache = await caches.open(cacheName);
  try {
    for (const [url, response] of verified) await cache.put(url, response);
    await cache.put('/shell-assets.json', new Response(resource.bytes, { headers: { 'content-type': 'application/json' } }));
    await verifyShell(candidate);
    await withShellLock(async () => {
      const state = await shellState();
      installedShellRelease = candidate;
      // An identical installed generation must not be resurrected as a candidate.
      if (state.active?.generation !== candidate.generation) {
        await writePointer('/__shell', { ...state, candidate, consentedGeneration: null, consentedClientId: null, consentedDeadline: null });
      }
    });
  } catch (error) { await caches.delete(cacheName); throw error; }
}
async function otherWindows(sourceId) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return clients.filter(client => client.id !== sourceId && new URL(client.url).origin === self.location.origin);
}
function assertDeadline(deadline) {
  if (!Number.isSafeInteger(deadline) || deadline <= Date.now() || deadline > Date.now() + 30000) throw new Error('ACTIVATION_LEASE_EXPIRED');
}
// Caller holds the origin lock through the final deadline check and rollback.
async function promoteShellLocked(state, sourceId, deadline) {
  const pointerCache = await caches.open(POINTER_CACHE);
  if ((await otherWindows(sourceId)).length) throw new Error('OTHER_CLIENTS_OPEN');
  assertDeadline(deadline);
  await pointerCache.put('/__shell', new Response(JSON.stringify({ active: state.candidate, previous: state.active, candidate: null, consentedGeneration: null }), { headers: { 'content-type': 'application/json' } }));
  if (Date.now() >= deadline) {
    await writePointer('/__shell', { ...state, consentedGeneration: null, consentedClientId: null, consentedDeadline: null });
    throw new Error('ACTIVATION_LEASE_EXPIRED');
  }
}
async function applyShellConsent(expected, sourceId, deadline) {
  assertDeadline(deadline);
  const state = await shellState(); const candidate = state.candidate;
  if (!candidate || candidate.generation !== expected || !await compatibleInstalledModules(candidate)) throw new Error('Shell compatibility or identity changed.');
  await verifyShell(candidate);
  const latest = await shellState(); if (latest.candidate?.generation !== expected) throw new Error('Shell candidate changed.');
  const pointerCache = await caches.open(POINTER_CACHE);
  if ((await otherWindows(sourceId)).length) throw new Error('OTHER_CLIENTS_OPEN');
  assertDeadline(deadline);
  await pointerCache.put('/__shell', new Response(JSON.stringify({ ...latest, consentedGeneration: expected, consentedClientId: sourceId, consentedDeadline: deadline }), { headers: { 'content-type': 'application/json' } }));
  assertDeadline(deadline);
}
async function verifyShell(release) {
  const cache = await caches.open(release.cacheName);
  const response = await cache.match('/shell-assets.json');
  if (!response) throw new Error('Shell candidate manifest missing.');
  const bytes = await response.arrayBuffer();
  if (await hash(bytes) !== release.manifestSha256) throw new Error('Shell candidate manifest corrupted.');
  const manifest = JSON.parse(new TextDecoder().decode(bytes));
  for (const asset of manifest.assets) {
    const item = await cache.match(asset.url);
    if (!item) throw new Error('Shell candidate resource missing.');
    const data = await item.arrayBuffer();
    if (data.byteLength !== asset.bytes || await hash(data) !== asset.sha256) throw new Error('Shell candidate resource corrupted.');
  }
}
self.addEventListener('install', event => { event.waitUntil(stageShell()); });
self.addEventListener('activate', event => { event.waitUntil((async () => {
  await withShellLock(async () => {
  const state = await shellState(); const candidate = state.candidate;
  if (candidate && !state.active) {
    await writePointer('/__shell', { active: candidate, previous: null, candidate: null, consentedGeneration: null });
  } else if (candidate && state.consentedGeneration === candidate.generation && await compatibleInstalledModules(candidate)) {
    try { await verifyShell(candidate); await promoteShellLocked(state, state.consentedClientId, state.consentedDeadline); }
    catch { await writePointer('/__shell', { ...state, consentedGeneration: null, consentedClientId: null, consentedDeadline: null }); }
  } else if (state.consentedGeneration) {
    await writePointer('/__shell', { ...state, consentedGeneration: null, consentedClientId: null });
  }
  });
  // Automatic worker lifecycle without consent continues serving the previous shell pointer.
  await self.clients.claim();
})()); });
self.addEventListener('message', event => {
  const type = event.data?.type;
  event.waitUntil((async () => {
    const source = event.source;
    if (!source || typeof source.id !== 'string') { respond(event, { type: 'MODULE_PROVISION_FAILED', complete: false }); return; }
    const client = await self.clients.get(source.id);
    if (!client || new URL(client.url).origin !== self.location.origin) { respond(event, { type: 'MODULE_PROVISION_FAILED', complete: false }); return; }
    if (type === 'VERIFY_WAITING_WORKER') {
      const state = await shellState(); const release = state.candidate ?? installedShellRelease;
      const compatible = Boolean(release && await compatibleInstalledModules(release));
      const peers = await otherWindows(source.id);
      const pending = Boolean(state.candidate && state.candidate.generation !== state.active?.generation);
      respond(event, { type: 'WAITING_WORKER_VERIFIED', version: release?.generation, scriptURL: self.location.href, pending, compatible, canActivate: pending && compatible && !peers.length, clientCount: peers.length + 1, reason: peers.length ? 'OTHER_CLIENTS_OPEN' : compatible ? undefined : 'INCOMPATIBLE_MODULES' }); return;
    }
    if (type === 'ACTIVATE_WITH_CONSENT') {
      if (event.data.scriptURL !== self.location.href) return;
      let promotedFrom;
      try {
        let skipWaitingPromise;
        await withShellLock(async () => {
          await applyShellConsent(event.data.version, source.id, event.data.clientDeadline);
          const state = await shellState();
          if (state.candidate?.generation !== event.data.version || state.consentedGeneration !== event.data.version) throw new Error('Shell candidate changed.');
          // Commit the consented pointer before releasing the lock. Installation
          // may publish another candidate before this worker's activate event.
          await promoteShellLocked(state, source.id, event.data.clientDeadline);
          promotedFrom = state;
          if (!(self.registration.active?.scriptURL === self.location.href && !self.registration.waiting)) {
            assertDeadline(event.data.clientDeadline);
            // Chromium may wait for activate (which acquires the lock) before
            // resolving. Invoke under lock and await after releasing it.
            skipWaitingPromise = self.skipWaiting();
          }
        }, event.data.clientDeadline);
        if (skipWaitingPromise) await skipWaitingPromise;
        await withShellLock(async () => {
          const state = await shellState();
          assertDeadline(event.data.clientDeadline);
          if (state.active?.cacheName !== promotedFrom.candidate.cacheName) throw new Error('Shell active generation changed.');
          respond(event, { type: 'SHELL_ACTIVATION_ACCEPTED', accepted: true, version: event.data.version });
        }, event.data.clientDeadline);
      } catch (error) {
        // Revert only our own promotion. A later staging publication must retain
        // its candidate, and a later consented promotion must never be reverted.
        if (promotedFrom) await withShellLock(async () => {
          const state = await shellState();
          if (state.active?.cacheName === promotedFrom.candidate.cacheName) {
            await writePointer('/__shell', { ...state, active: promotedFrom.active, previous: promotedFrom.previous, candidate: state.candidate ?? promotedFrom.candidate, consentedGeneration: null, consentedClientId: null, consentedDeadline: null });
          }
        }).catch(() => {});
        else await withShellLock(async () => {
          const state = await shellState();
          if (state.consentedGeneration === event.data.version && state.consentedClientId === source.id) await writePointer('/__shell', { ...state, consentedGeneration: null, consentedClientId: null, consentedDeadline: null });
        }, event.data.clientDeadline).catch(() => {});
        respond(event, { type: 'SHELL_ACTIVATION_BLOCKED', accepted: false, reason: ['OTHER_CLIENTS_OPEN', 'ACTIVATION_LEASE_EXPIRED'].includes(error.message) ? error.message : 'COMPATIBILITY_OR_INTEGRITY_FAILED' });
      }
      return;
    }
    const id = event.data.moduleId; if (!MODULES.includes(id)) return;
    const previous = queues.get(id) ?? Promise.resolve();
    const operation = previous.catch(() => {}).then(() => withPointerLock(`consubov-module-pointer-v2-${id}`, async () => {
      // A lock may wait across worker takeover or window closure. Authorize the
      // actual client again before touching a shared module generation.
      const liveClient = await self.clients.get(source.id);
      if (!liveClient || new URL(liveClient.url).origin !== self.location.origin) throw new Error('Module client unavailable.');
      const state = await moduleState(id);
      if (!await readPointer(`/__modules/${id}`) && state.activeHealthy) await writePointer(`/__modules/${id}`, state);
      if (type === 'PROVISION_AUTHORIZED_MODULE') return prepareModule(id);
      if (type === 'MARK_MODULE_HEALTHY') return promoteModule(id, event.data);
      if (type === 'ROLLBACK_MODULE') return rollbackModule(id, event.data, event.data.reason);
      throw new Error('Unknown release operation.');
    }));
    queues.set(id, operation);
    try { const descriptor = await operation; respond(event, { type: type === 'PROVISION_AUTHORIZED_MODULE' ? 'MODULE_PROVISIONED' : 'MODULE_GENERATION_SELECTED', moduleId: id, complete: true, descriptor }); }
    catch { respond(event, { type: 'MODULE_PROVISION_FAILED', moduleId: id, complete: false }); }
    finally { if (queues.get(id) === operation) queues.delete(id); }
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/v1/')) return;
  if (url.pathname.startsWith('/modules/')) {
    event.respondWith((async () => {
      const id = url.pathname.split('/')[2]; if (!MODULES.includes(id)) return new Response('Not found', { status: 404 });
      try {
        const state = await moduleState(id);
        for (const d of [state.activeHealthy, state.previousHealthy, state.candidate]) if (d) {
          // Only exact pinned immutable paths; mutable aliases resolve the active healthy generation.
          const path = url.pathname.startsWith(`/modules/${id}/current/`) ? new URL(url.pathname.split('/').at(-1), d.resourceBase) : new URL(url.origin + url.pathname);
          const response = await (await caches.open(d.cacheName)).match(path);
          if (response) return response;
        }
      } catch { /* No unverified network fallback. */ }
      return new Response('Verified module unavailable.', { status: 503 });
    })()); return;
  }
  event.respondWith((async () => {
    const state = await shellState();
    for (const d of [state.active, state.previous]) if (d) {
      const cache = await caches.open(d.cacheName);
      const cached = await cache.match(url.pathname === '/' ? '/index.html' : event.request);
      if (cached) return cached;
    }
    if (event.request.mode === 'navigate' && state.active) {
      const fallback = await (await caches.open(state.active.cacheName)).match('/index.html'); if (fallback) return fallback;
    }
    if (state.active && url.pathname.startsWith('/assets/')) return new Response('Verified shell resource unavailable.', { status: 503 });
    return fetch(event.request).catch(() => new Response('Resource unavailable.', { status: 503 }));
  })());
});
