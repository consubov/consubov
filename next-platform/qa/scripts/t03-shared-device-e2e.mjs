import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPersistentProfilePaths } from './persistent-profile-path.mjs';

const root = resolve(import.meta.dirname, '../..');
const playwrightEntry = resolve(root, 'packages/local-data/node_modules/@playwright/test/index.mjs');
const { chromium, webkit } = await import(pathToFileURL(playwrightEntry).href);
const origin = `http://127.0.0.1:${process.env.T03_PORT ?? '5187'}`;
const runId = `t03-shared-${new Date().toISOString().replaceAll(':', '-')}-${process.pid}-${crypto.randomUUID()}`;
const runRoot = resolve(root, '.qa/tmp', runId);
const reportPath = resolve(root, '.qa/runs', `${runId}.json`);
const credentials = {
  capataz: { email: 'capataz.lab@consubov.local', userId: '10000000-0000-4000-8000-000000000002', marker: `shared-device-capataz-${runId}` },
  gerente: { email: 'gerente.lab@consubov.local', userId: '10000000-0000-4000-8000-000000000001', marker: '1.84' }
};
const results = [];
let profilePaths;
const progress = (browser, stage) => console.info(`[T03_SHARED ${browser}] ${stage}`);

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try { const response = await fetch(origin); if (response.ok) return; } catch {}
    await new Promise(resolveDelay => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Production QA server was not ready at ${origin}.`);
}

async function ensureShellControlled(page, browserName) {
  const waitForControl = () => page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { ready: false, controlled: false };
    const ready = await Promise.race([
      navigator.serviceWorker.ready.then(() => true),
      new Promise(resolve => setTimeout(() => resolve(false), 20000))
    ]);
    if (!ready) return { ready: false, controlled: Boolean(navigator.serviceWorker.controller) };
    if (navigator.serviceWorker.controller) return { ready: true, controlled: true };
    const controlled = await new Promise(resolve => {
      const timeout = setTimeout(() => { navigator.serviceWorker.removeEventListener('controllerchange', changed); resolve(false); }, 10000);
      const changed = () => { clearTimeout(timeout); navigator.serviceWorker.removeEventListener('controllerchange', changed); resolve(Boolean(navigator.serviceWorker.controller)); };
      navigator.serviceWorker.addEventListener('controllerchange', changed);
    });
    return { ready: true, controlled };
  });
  let workerState = await waitForControl();
  if (workerState.controlled) return;
  progress(browserName, `service worker control missing before reload: ${JSON.stringify(workerState)}`);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  workerState = await waitForControl();
  if (!workerState.controlled) throw new Error(`Shell did not gain service-worker control after reload: ${JSON.stringify(workerState)}.`);
}

async function moduleAssets(page) {
  return page.evaluate(async () => {
    const names = await caches.keys();
    const result = {};
    for (const name of names.filter(key => key.startsWith('consubov-module-') && key !== 'consubov-module-pointers-v1')) {
      const cache = await caches.open(name);
      const urls = await cache.keys();
      for (const request of urls) {
        const url = new URL(request.url);
        if (url.pathname.startsWith('/modules/') && url.origin !== location.origin) throw new Error(`Foreign module cache artifact: ${url.href}`);
        const match = url.pathname.match(/^\/modules\/(capataz|gerente|escritorio|fabrica)\/(?:current|releases\/[a-f0-9]{64})\//);
        if (match) (result[match[1]] ??= []).push(url.pathname);
      }
    }
    for (const profile of Object.keys(result)) result[profile] = [...new Set(result[profile])].sort();
    return result;
  });
}

async function capatazCacheProof(page) {
  return page.evaluate(async () => {
    const proof = [];
    for (const name of (await caches.keys()).filter(name => name.startsWith('consubov-module-capataz-'))) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
        proof.push({ cache: name, url: request.url, sha256: [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('') });
      }
    }
    return proof.sort((a, b) => `${a.cache}:${a.url}`.localeCompare(`${b.cache}:${b.url}`));
  });
}

async function localPartitionState(page, profile) {
  const expectedUser = credentials[profile].userId;
  return page.evaluate(async ({ profileId, expectedUserId }) => {
    const databases = await indexedDB.databases();
    const matches = (databases.map(item => item.name).filter(name => name?.startsWith('consubov-local-'))).filter(name => {
      try {
        const parts = JSON.parse(decodeURIComponent(name.slice('consubov-local-'.length)));
        return parts[0] === 'consubov' && parts[1] === profileId && parts[2] === expectedUserId;
      } catch { return false; }
    });
    if (matches.length !== 1) throw new Error(`Expected one ${profileId}/${expectedUserId} database, found ${matches.length}.`);
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(matches[0]);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const state = await new Promise((resolve, reject) => {
      const tx = db.transaction(['snapshots', 'outbox'], 'readonly');
      const value = { snapshots: null, outbox: null };
      tx.objectStore('snapshots').getAll().onsuccess = event => { value.snapshots = event.target.result; };
      tx.objectStore('outbox').getAll().onsuccess = event => { value.outbox = event.target.result; };
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    const serialized = JSON.stringify(state);
    return { database: matches[0], userId: expectedUserId, snapshots: state.snapshots.length, outbox: state.outbox.length, serialized };
  }, { profileId: profile, expectedUserId: expectedUser });
}

async function waitForPersistedMarker(page, profile) {
  const marker = credentials[profile].marker;
  const expectedUserId = credentials[profile].userId;
  await page.waitForFunction(async ({ profileId, userId, expectedMarker }) => {
    const names = (await indexedDB.databases()).map(item => item.name).filter(name => name?.startsWith('consubov-local-'));
    const databaseName = names.find(name => {
      try {
        const parts = JSON.parse(decodeURIComponent(name.slice('consubov-local-'.length)));
        return parts[1] === profileId && parts[2] === userId;
      } catch { return false; }
    });
    if (!databaseName) return false;
    const db = await new Promise(resolve => {
      const request = indexedDB.open(databaseName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
    if (!db) return false;
    const contents = await new Promise(resolve => {
      const tx = db.transaction(['snapshots', 'outbox'], 'readonly');
      const values = { snapshots: null, outbox: null };
      tx.objectStore('snapshots').getAll().onsuccess = event => { values.snapshots = event.target.result; };
      tx.objectStore('outbox').getAll().onsuccess = event => { values.outbox = event.target.result; };
      tx.oncomplete = () => resolve(JSON.stringify(values));
      tx.onerror = tx.onabort = () => resolve('');
    });
    db.close();
    return contents.includes(expectedMarker);
  }, { profileId: profile, userId: expectedUserId, expectedMarker: marker }, { timeout: 15000 });
}

async function authStorageState(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('consubov-auth-local-v1');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const state = await new Promise((resolve, reject) => {
      const tx = db.transaction(['metadata', 'credentials'], 'readonly');
      const value = { deviceId: null, credentials: [] };
      const device = tx.objectStore('metadata').get('device-id');
      const accounts = tx.objectStore('credentials').getAll();
      device.onsuccess = () => { value.deviceId = device.result?.value ?? null; };
      accounts.onsuccess = () => { value.credentials = accounts.result.map(record => record.email); };
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    return state;
  });
}

async function login(page, profile, offline, diagnostics) {
  progress(diagnostics.browser, `${offline ? 'offline' : 'online'} login start: ${profile}`);
  await page.goto(`${origin}/#/fazenda/${profile}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#login-email').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#login-email').fill(credentials[profile].email);
  await page.locator('#login-password').fill('lab@123456');
  await page.getByRole('button', { name: /Entrar no Sistema/i }).click();
  const moduleView = page.frameLocator('iframe').locator(`[data-testid="${profile}-module-view"]`);
  const contextButton = page.getByRole('button', { name: /Acessar Este Contexto/i });
  const next = await Promise.race([
    contextButton.waitFor({ state: 'visible', timeout: 20000 }).then(() => 'context'),
    moduleView.waitFor({ state: 'visible', timeout: 45000 }).then(() => 'module')
  ]);
  if (next === 'context') await contextButton.click();
  try { await moduleView.waitFor({ state: 'visible', timeout: 45000 }); }
  catch (error) {
    const caches = await moduleAssets(page).catch(cacheError => ({ error: String(cacheError) }));
    const worker = await page.evaluate(() => ({ controlled: Boolean(navigator.serviceWorker?.controller), state: navigator.serviceWorker?.controller?.state, script: navigator.serviceWorker?.controller?.scriptURL })).catch(() => null);
    throw new Error(`${offline ? 'Offline' : 'Online'} login for ${profile} failed; url=${page.url()} alerts=${JSON.stringify(await page.getByRole('alert').allTextContents())}; frames=${JSON.stringify(page.frames().map(frame => frame.url()))}; moduleCaches=${JSON.stringify(caches)}; worker=${JSON.stringify(worker)}; logs=${JSON.stringify(diagnostics)}; error=${String(error)}`);
  }
  const otherProfile = profile === 'capataz' ? 'gerente' : 'capataz';
  if (await page.frameLocator('iframe').locator(`[data-testid="${otherProfile}-module-view"]`).count()) {
    throw new Error(`${profile} login rendered the ${otherProfile} module.`);
  }
  progress(diagnostics.browser, `${offline ? 'offline' : 'online'} module ready: ${profile}`);
}

async function mutate(page, profile) {
  const frame = page.frameLocator('iframe');
  if (profile === 'capataz') {
    await frame.locator('#cocho-input-notes').fill(credentials.capataz.marker);
    await frame.locator('#cocho-input-bags').fill('7');
    await frame.locator('[data-testid="capataz-cocho-tab"] form button[type="submit"]').click();
    await waitForPersistedMarker(page, 'capataz');
  } else {
    await frame.getByRole('tab', { name: /Metas e Curvas de GMD/i }).click();
    await frame.getByLabel('GMD Alvo (kg/dia)').fill(credentials.gerente.marker);
    await frame.locator('[data-testid="gerente-gmd-tab"] form').first().locator('button[type="submit"]').click();
    await frame.getByRole('tab', { name: /Visão Geral da Produção/i }).click();
    await frame.getByText(credentials.gerente.marker, { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
  }
}

async function logout(page) {
  await page.getByRole('button', { name: /^Sair$/i }).click();
  await page.getByRole('button', { name: /Sim, Sair/i }).click();
  await page.locator('#login-email').waitFor({ state: 'visible', timeout: 15000 });
}

function attachObservers(context, page, requestLog, consoleErrors, offlineAuthFailures, offlineApiFailures, resourceErrors, browserName, offlinePhase = false, authorizedScopes = []) {
  context.on('request', request => {
    try {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/modules/')) requestLog.push({ event: 'request', origin: url.origin, path: url.pathname, query: url.search, method: request.method() });
    } catch {}
  });
  context.on('response', response => {
    try {
      const url = new URL(response.url());
      if (url.pathname.startsWith('/modules/')) requestLog.push({ event: 'response', origin: url.origin, path: url.pathname, query: url.search, method: response.request().method(), status: response.status() });
    } catch {}
  });
  page.on('pageerror', error => consoleErrors.push(`${error.name}: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') {
      if (message.text().startsWith('Failed to load resource:')) resourceErrors.push({ text: message.text(), url: message.location().url, offline: offlinePhase });
      else consoleErrors.push(message.text());
    }
  });
  page.on('requestfailed', request => {
    const url = new URL(request.url());
    const failure = { url: request.url(), error: request.failure()?.errorText, offline: offlinePhase, method: request.method(), type: request.resourceType() };
    const expectedError = browserName === 'chromium' ? 'net::ERR_INTERNET_DISCONNECTED' : 'WebKit encountered an internal error';
    const expectedPost = !url.search && ['/api/v1/auth/login', '/api/v1/commands'].includes(url.pathname) && failure.method === 'POST';
    const query = url.searchParams;
    const queryKeys = ['tenant_id', 'fazenda_id', 'profile_id', 'limit', 'since_cursor'];
    const cursor = query.get('since_cursor');
    const scope = authorizedScopes.find(scope => scope.tenantId === query.get('tenant_id') && scope.farmId === query.get('fazenda_id') && scope.profileId === query.get('profile_id'));
    const expectedPull = failure.method === 'GET' && url.pathname === '/api/v1/sync' && scope &&
      [...query.keys()].every(key => queryKeys.includes(key) && query.getAll(key).length === 1) &&
      ['tenant_id', 'fazenda_id', 'profile_id', 'limit'].every(key => query.getAll(key).length === 1) &&
      query.get('limit') === '500' && (cursor === null || (cursor.trim().length >= 1 && cursor.trim().length <= 512));
    if (offlinePhase && url.origin === origin && !url.hash && (expectedPost || expectedPull) && ['fetch', 'xhr'].includes(failure.type) && failure.error === expectedError) {
      if (expectedPull) failure.pullScope = scope;
      offlineApiFailures.push(failure);
      if (url.pathname === '/api/v1/auth/login') offlineAuthFailures.push(failure);
    } else consoleErrors.push(`Request failed: ${request.url()} (${failure.error}; offline=${offlinePhase}; method=${failure.method}; type=${failure.type})`);
  });
}

async function exercise(browserType) {
  const browserName = browserType.name();
  progress(browserName, 'launching shared persistent browser context');
  const userDir = resolve(runRoot, browserType.name());
  await mkdir(userDir, { recursive: true });
  const context = await browserType.launchPersistentContext(profilePaths.browserPath(userDir), { headless: true, serviceWorkers: 'allow' });
  const page = context.pages()[0] ?? await context.newPage();
  const requestLog = [];
  const consoleErrors = [];
  const offlineAuthFailures = [];
  const offlineApiFailures = [], resourceErrors = [];
  attachObservers(context, page, requestLog, consoleErrors, offlineAuthFailures, offlineApiFailures, resourceErrors, browserName);
  try {
    await page.goto(origin, { waitUntil: 'networkidle' });
    progress(browserName, 'initial shell navigation complete');
    await ensureShellControlled(page, browserName);
    progress(browserName, 'shell service worker controls page');
    await login(page, 'capataz', false, { consoleErrors, requestLog, browser: browserName });
    progress(browserName, 'Capataz online module loaded');
    await mutate(page, 'capataz');
    const capatazState = await localPartitionState(page, 'capataz');
    if (!capatazState.serialized.includes(credentials.capataz.marker)) throw new Error('Capataz marker was not persisted in its account partition.');
    const firstAssets = await moduleAssets(page);
    if (!firstAssets.capataz?.length || Object.keys(firstAssets).some(profile => profile !== 'capataz')) throw new Error(`Initial provisioning cached unrelated module assets: ${JSON.stringify(firstAssets)}.`);
    const firstModuleRequests = requestLog.splice(0);
    if (firstModuleRequests.some(request => request.origin !== origin || !request.path.startsWith('/modules/capataz/'))) throw new Error(`Capataz first access fetched another profile's assets: ${JSON.stringify(firstModuleRequests)}.`);
    const capatazBytesBefore = await capatazCacheProof(page);
    const knownCapatazMetadata = new Set(['/modules/capataz/current/module.json', ...firstAssets.capataz.filter(path => /^\/modules\/capataz\/releases\/[a-f0-9]{64}\/module\.json$/.test(path))]);

    await logout(page);
    progress(browserName, 'Capataz logged out');
    await login(page, 'gerente', false, { consoleErrors, requestLog, browser: browserName });
    progress(browserName, 'Gerente online module loaded');
    await mutate(page, 'gerente');
    const gerenteState = await localPartitionState(page, 'gerente');
    const authorizedScopes = [capatazState, gerenteState].map(state => {
      const parts = JSON.parse(decodeURIComponent(state.database.slice('consubov-local-'.length)));
      if (parts.length !== 6 || parts[0] !== 'consubov' || !['capataz', 'gerente'].includes(parts[1]) || parts[2] !== state.userId || !parts[3] || !parts[4]) throw new Error('Invalid provisioned account partition identity.');
      return { profileId: parts[1], tenantId: parts[3], farmId: parts[4] };
    });
    if (!gerenteState.serialized.includes(credentials.gerente.marker)) throw new Error('Gerente marker was not persisted in its account partition.');
    if (capatazState.userId === gerenteState.userId || capatazState.database === gerenteState.database) throw new Error('Different users shared the same local-data partition.');
    if (capatazState.serialized.includes(credentials.gerente.marker) || gerenteState.serialized.includes(credentials.capataz.marker)) throw new Error('Persisted local account data crossed profile/user partitions.');
    const secondAssets = await moduleAssets(page);
    if (!secondAssets.capataz?.length || !secondAssets.gerente?.length || Object.keys(secondAssets).some(profile => !['capataz', 'gerente'].includes(profile))) throw new Error(`Second provisioning has unexpected module caches: ${JSON.stringify(secondAssets)}.`);
    const secondModuleRequests = requestLog.splice(0);
    const lateMetadata = secondModuleRequests.filter(request => knownCapatazMetadata.has(request.path) && request.origin === origin && request.method === 'GET' && !request.query && (request.event === 'request' || request.status === 200));
    if (lateMetadata.some(request => lateMetadata.filter(other => other.path === request.path && other.event === request.event).length > 1)) throw new Error('Repeated Capataz metadata check during Gerente selection.');
    if (secondModuleRequests.some(request => !lateMetadata.includes(request) && (request.origin !== origin || !request.path.startsWith('/modules/gerente/')))) throw new Error(`Gerente selection downloaded unrelated module resources: ${JSON.stringify(secondModuleRequests)}.`);
    const capatazBytesAfter = await capatazCacheProof(page);
    if (!capatazBytesBefore.length || JSON.stringify(capatazBytesBefore) !== JSON.stringify(capatazBytesAfter)) throw new Error('Gerente selection changed previously provisioned Capataz resource bytes.');

    const authStateBeforeRestart = await authStorageState(page);
    const expectedCredentials = [credentials.capataz.email, credentials.gerente.email].sort();
    if (JSON.stringify([...authStateBeforeRestart.credentials].sort()) !== JSON.stringify(expectedCredentials)) throw new Error(`Expected exactly both provisioned accounts in auth storage; got ${JSON.stringify(authStateBeforeRestart.credentials)}.`);
    await context.close();

    const reopened = await browserType.launchPersistentContext(profilePaths.browserPath(userDir), { headless: true, serviceWorkers: 'allow' });
    try {
      const offlinePage = reopened.pages()[0] ?? await reopened.newPage();
      const offlineRequests = [];
      await reopened.setOffline(true);
      attachObservers(reopened, offlinePage, offlineRequests, consoleErrors, offlineAuthFailures, offlineApiFailures, resourceErrors, browserName, true, authorizedScopes);
      await offlinePage.goto(origin, { waitUntil: 'networkidle' });
      progress(browserName, 'reopened persistent profile offline');
      await ensureShellControlled(offlinePage, browserName);
      progress(browserName, 'reopened shell service worker controls page');
      await login(offlinePage, 'capataz', true, { consoleErrors, offlineAuthFailures, browser: browserName });
      progress(browserName, 'Capataz offline module loaded');
      const offlineCapataz = await localPartitionState(offlinePage, 'capataz');
      if (!offlineCapataz.serialized.includes(credentials.capataz.marker) || offlineCapataz.serialized.includes(credentials.gerente.marker)) throw new Error('Offline Capataz session exposed incorrect account data.');
      await logout(offlinePage);
      await login(offlinePage, 'gerente', true, { consoleErrors, offlineAuthFailures, browser: browserName });
      progress(browserName, 'Gerente offline module loaded');
      const offlineGerente = await localPartitionState(offlinePage, 'gerente');
      if (!offlineGerente.serialized.includes(credentials.gerente.marker) || offlineGerente.serialized.includes(credentials.capataz.marker)) throw new Error('Offline Gerente session exposed incorrect account data.');
      if (!offlineAuthFailures.length) throw new Error('Offline re-login did not exercise API network failure fallback.');
      const unexpectedErrors = [...consoleErrors, ...resourceErrors.filter(message => !message.offline || !offlineApiFailures.some(failure => (!message.url || message.url === failure.url) && message.text === `Failed to load resource: ${failure.error}`)).map(message => `${message.text} (${message.url})`)];
      if (unexpectedErrors.length) throw new Error(`Unexpected browser errors: ${unexpectedErrors.join(' | ')}`);
      const authStateAfterRestart = await authStorageState(offlinePage);
      if (authStateAfterRestart.deviceId !== authStateBeforeRestart.deviceId) throw new Error('Device identity changed across accounts or browser restart.');
      return {
        browser: browserType.name(), sharedPersistentUserDir: true,
        initialModuleProfiles: Object.keys(firstAssets), secondProvisionedModuleProfiles: Object.keys(secondAssets),
        initialCapatazAssetCount: firstAssets.capataz.length,
        gerenteAssetCount: secondAssets.gerente.length,
        capatazUserId: capatazState.userId, gerenteUserId: gerenteState.userId,
        sharedDeviceId: authStateAfterRestart.deviceId, credentialsPersisted: authStateAfterRestart.credentials.sort(),
        offlineReloginProfiles: ['capataz', 'gerente'], offlineAuthFallbackCount: offlineAuthFailures.length,
        offlinePullFailureCount: offlineApiFailures.filter(failure => failure.pullScope).length,
        offlinePullFailureScopes: offlineApiFailures.filter(failure => failure.pullScope).map(failure => failure.pullScope),
        localDataPartitionsDistinct: true, dataCrossContamination: false,
        lateMetadata, capatazCachedResourcesUnchanged: true, capatazCacheProof: capatazBytesAfter,
        observedInitialModuleRequests: firstModuleRequests, observedGerenteModuleRequests: secondModuleRequests
      };
    } finally { await reopened.close(); }
  } finally { await context.close(); }
}

try {
  await waitForServer();
  profilePaths = await createPersistentProfilePaths(runRoot);
  await mkdir(resolve(root, '.qa/runs'), { recursive: true });
  const selected = process.env.T03_BROWSER === 'chromium' ? [chromium] : process.env.T03_BROWSER === 'webkit' ? [webkit] : [chromium, webkit];
  for (const browserType of selected) results.push(await exercise(browserType));
  await writeFile(reportPath, JSON.stringify({ runId, origin, results }, null, 2));
  console.info(`T03 shared-device auth/profile isolation verified: ${results.length} browsers. Report: ${reportPath}`);
} catch (error) {
  await mkdir(resolve(root, '.qa/runs'), { recursive: true });
  await writeFile(reportPath, JSON.stringify({ runId, origin, results, error: String(error) }, null, 2));
  console.error(`T03 shared-device E2E failed. Report: ${reportPath}`);
  throw error;
} finally {
  await profilePaths?.dispose();
  const expectedPrefix = resolve(root, '.qa/tmp');
  const ownedRelativePath = relative(expectedPrefix, runRoot);
  if (ownedRelativePath && ownedRelativePath !== '..' && !ownedRelativePath.startsWith('..\\') && !ownedRelativePath.startsWith('../') && !isAbsolute(ownedRelativePath)) {
    await rm(runRoot, { recursive: true, force: true });
  }
}
