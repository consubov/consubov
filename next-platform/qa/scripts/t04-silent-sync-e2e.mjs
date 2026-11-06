import assert from 'node:assert/strict';
import { mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPersistentProfilePaths } from './persistent-profile-path.mjs';

const root = resolve(import.meta.dirname, '../..');
const { chromium, webkit } = await import(pathToFileURL(resolve(root, 'packages/local-data/node_modules/@playwright/test/index.mjs')).href);
const origin = `http://127.0.0.1:${process.env.T04_PORT ?? '5187'}`;
const runId = `t04-${new Date().toISOString().replaceAll(':', '-')}-${process.pid}`;
const runRoot = resolve(root, '.qa/tmp', `s-${process.pid}-${crypto.randomUUID().slice(0, 8)}`);
const reportPath = resolve(root, '.qa/runs', `${runId}.json`);
const results = [];
let paths, canonicalRoot;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function within(promise, description) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(description)), 45000); })]); }
  finally { clearTimeout(timer); }
}

async function until(read, accept, description, timeout = 45000) {
  const deadline = Date.now() + timeout;
  let value;
  do {
    value = await read();
    if (accept(value)) return value;
    await new Promise(done => setTimeout(done, 100));
  } while (Date.now() < deadline);
  throw new Error(`Timed out: ${description}`);
}

async function state(page) {
  return page.evaluate(async () => {
    const names = (await indexedDB.databases()).map(item => item.name).filter(name => {
      if (!name?.startsWith('consubov-local-')) return false;
      try { const key = JSON.parse(decodeURIComponent(name.slice('consubov-local-'.length))); return key[0] === 'consubov' && key[1] === 'capataz'; } catch { return false; }
    });
    if (names.length !== 1) throw new Error(`Expected one Capataz partition; found ${names.length}`);
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open(names[0]); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const values = await new Promise((resolve, reject) => {
      const stores = ['snapshots', 'outbox', 'attachments', 'acks', 'cursors', 'conflicts'];
      const tx = db.transaction(stores, 'readonly'), result = {};
      for (const store of stores) { const request = tx.objectStore(store).getAll(); request.onsuccess = () => { result[store] = request.result; }; }
      tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
    db.close();
    values.attachments = await Promise.all(values.attachments.map(async item => {
      const blob = item.bytes instanceof ArrayBuffer ? new Blob([item.bytes], { type: item.ref.mime_type }) : item.blob;
      if (!(blob instanceof Blob)) throw new Error('Missing actual durable photo bytes');
      const bytes = await blob.arrayBuffer();
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
      const url = URL.createObjectURL(blob);
      try {
        const dimensions = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight }); image.onerror = () => reject(new Error('Durable photo cannot decode')); image.src = url; });
        return { ref: item.ref, hash, size: blob.size, mime: blob.type, ...dimensions };
      } finally { URL.revokeObjectURL(url); }
    }));
    return values;
  });
}
const latest = data => data.snapshots.toSorted((a, b) => b.data.localRevision - a.data.localRevision)[0].data;
const countMarker = (data, marker) => latest(data).leiturasCocho.filter(item => item.observacao === marker).length;

async function login(page) {
  await page.goto(`${origin}/#/fazenda/capataz`, { waitUntil: 'load' });
  await page.locator('#login-email').waitFor({ state: 'visible', timeout: 45000 });
  await page.locator('#login-email').fill('capataz.lab@consubov.local');
  await page.locator('#login-password').fill('lab@123456');
  await page.getByRole('button', { name: /Entrar no Sistema/i }).click();
  const frame = page.frameLocator('iframe'), button = page.getByRole('button', { name: /Acessar Este Contexto/i });
  await Promise.race([button.waitFor({ state: 'visible', timeout: 45000 }), frame.locator('#cocho-input-notes').waitFor({ state: 'visible', timeout: 45000 })]);
  if (await button.isVisible()) await button.click();
  await frame.locator('#cocho-input-notes').waitFor({ state: 'visible', timeout: 45000 });
  return frame;
}

async function noSyncCopy(page, frame) {
  const forbidden = /\b(?:online|offline|sincronizando|sincronização|sincronizacao|pendente de sync|pending sync|syncing|synchronizing)\b/i;
  assert(!forbidden.test(await page.locator('body').innerText()), 'Shell must not render network/sync status');
  assert(!forbidden.test(await frame.locator('body').innerText()), 'Module must not render network/sync status');
}

async function exercise(browser) {
  const name = browser.name(), marker = `${runId}-${name}`;
  let stage = 'launch', first, second, releaseRetry, faultPage;
  const log = value => { stage = value; console.info(`[${name}] ${value}`); };
  const failures = [], consoleErrors = [], pageErrors = [], http = [], injectedRequests = new WeakSet();
  const observe = (context, offline) => {
    context.on('page', page => {
      page.on('pageerror', error => pageErrors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push({ text: message.text(), url: message.location().url }); });
      page.on('requestfailed', request => failures.push({ url: request.url(), method: request.method(), type: request.resourceType(), error: request.failure()?.errorText, offline: offline.value, injected: injectedRequests.has(request) }));
      page.on('response', response => {
        const request = response.request(), url = new URL(response.url());
        if (url.pathname.startsWith('/api/v1/') && url.pathname !== '/api/v1/auth/login') http.push({ path: url.pathname, method: request.method(), status: response.status() });
      });
    });
  };
  const launch = async dir => {
    const canonical = resolve(runRoot, name, dir); await mkdir(canonical, { recursive: true });
    return browser.launchPersistentContext(paths.browserPath(canonical), { headless: true, serviceWorkers: 'allow' });
  };
  const mode = { value: false };
  try {
    first = await launch('one'); observe(first, mode);
    const page = await first.newPage();
    log('first device actual authentication / current server baseline');
    const frame = await login(page);
    const baseline = await until(() => state(page), data => data.cursors.length > 0 && data.outbox.length === 0, 'initial authoritative pull');
    assert.equal(countMarker(baseline, marker), 0);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    mode.value = true; await first.setOffline(true);
    log('offline real feed form + real image file / actual canvas compression');
    await frame.locator('#cocho-input-notes').fill(marker);
    await frame.locator('#cocho-input-bags').fill('7');
    await frame.locator('[data-testid="capataz-cocho-tab"] form button[type="submit"]').click();
    await until(() => state(page), data => data.outbox.length === 1, 'offline feed durability');
    const input = await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 1800; canvas.height = 1000;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 1800, 1000); gradient.addColorStop(0, '#345f23'); gradient.addColorStop(1, '#efad35');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff'; ctx.font = '80px sans-serif'; ctx.fillText('CONSUBOV QA PHOTO', 100, 300);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    await frame.locator('#tab-fotos').click();
    await frame.locator('[data-testid="capataz-photo-file"]').setInputFiles({ name: 'qa-photo.png', mimeType: 'image/png', buffer: Buffer.from(input) });
    const queued = await until(() => state(page), data => data.outbox.length === 2, 'offline photo durability');
    assert.equal(countMarker(queued, marker), 1);
    const photoIds = Object.keys(latest(queued).fotos).filter(id => !(id in latest(baseline).fotos));
    assert.equal(photoIds.length, 1);
    const photoId = photoIds[0], photo = queued.attachments.find(item => item.ref.attachment_id === photoId);
    assert(photo); assert.match(photoId, /^[0-9a-f-]{36}$/i);
    assert.equal(photo.hash, photo.ref.hash_sha256); assert.equal(photo.size, photo.ref.size_bytes); assert.equal(photo.mime, 'image/jpeg');
    assert(photo.width <= 1280 && photo.height <= 720 && photo.width > 0 && photo.height > 0);
    await noSyncCopy(page, frame);

    const lost = deferred(), gate = deferred(); releaseRetry = gate.resolve;
    let firstBody, firstAck, repeated = 0, routeError;
    if (name === 'webkit') {
      // Controlled WebKit bypasses Playwright routing for these API requests.
      // Drop delivery at fetch's return boundary after the real server commits;
      // never replace the real request, response, credentials, body or signal.
      faultPage = page;
      await page.evaluate(() => {
        const original = window.fetch;
        const fault = { lost: false, retries: 0, error: null, body: undefined, ack: undefined, release: undefined, restore: undefined };
        const gate = new Promise(resolve => { fault.release = resolve; });
        const wrapped = async function (...args) {
          const [input, init] = args;
          const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
          const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
          if (url.origin !== location.origin || url.pathname !== '/api/v1/commands' || method !== 'POST') return original.apply(this, args);
          const body = init?.body;
          if (fault.body === undefined) {
            fault.body = body;
            const response = await original.apply(this, args);
            const text = await response.clone().text();
            const parsed = JSON.parse(text);
            if (response.status !== 200 || !parsed.success || parsed.ack?.status !== 'COMMITTED') { fault.error = 'First actual API response was not COMMITTED'; return response; }
            fault.ack = text; fault.lost = true;
            throw new TypeError('QA intentionally discarded a real committed ACK at the fetch delivery boundary');
          }
          if (JSON.parse(body).command_id === JSON.parse(fault.body).command_id) {
            await gate;
            if (body !== fault.body) { fault.error = 'Retry envelope bytes changed'; throw new Error(fault.error); }
            const response = await original.apply(this, args);
            if (await response.clone().text() !== fault.ack) { fault.error = 'Actual replay ACK bytes changed'; throw new Error(fault.error); }
            fault.retries++;
            return response;
          }
          return original.apply(this, args);
        };
        fault.restore = () => { fault.release(); if (window.fetch === wrapped) window.fetch = original; };
        window.__t04Fault = fault;
        window.fetch = wrapped;
      });
      releaseRetry = () => { void page.evaluate(() => window.__t04Fault?.release()).catch(() => {}); };
    } else await first.route(`${origin}/api/v1/commands`, async route => {
      try {
        const body = route.request().postData();
        if (firstBody === undefined) {
          firstBody = body;
          const response = await route.fetch();
          assert.equal(response.status(), 200);
          firstAck = await response.body();
          assert.equal(JSON.parse(firstAck.toString()).success, true);
          // The real server has committed. Only delivery to this browser is lost.
          injectedRequests.add(route.request());
          await route.abort('failed'); lost.resolve(); return;
        }
        if (JSON.parse(body).command_id === JSON.parse(firstBody).command_id) {
          await gate.promise;
          assert.equal(body, firstBody, 'Retry must use byte-identical durable envelope/idempotency');
          const response = await route.fetch();
          assert.equal(response.status(), 200);
          assert.deepEqual(await response.body(), firstAck, 'Server must replay the exact original ACK bytes');
          repeated++;
          await route.fulfill({ response }); return;
        }
        await route.continue();
      } catch (error) { routeError = String(error); await route.abort('failed').catch(() => {}); lost.resolve(); }
    });
    log('network restored / lose first real committed ACK / durable queue retained');
    mode.value = false; await first.setOffline(false);
    if (name === 'webkit') {
      await page.waitForFunction(() => window.__t04Fault?.lost || window.__t04Fault?.error, null, { timeout: 45000 });
      assert.equal(await page.evaluate(() => window.__t04Fault.error), null);
    } else await within(lost.promise, 'No command delivery observed by the route fault injector; consult HTTP/durable diagnostics before inferring a dispatch failure');
    assert.equal(routeError, undefined);
    const retained = await state(page);
    assert.equal(retained.outbox.length, 2);
    assert.deepEqual(retained.outbox, queued.outbox);
    log('release exact retry / real ACK / automatic silent pull');
    releaseRetry();
    const synced = await until(() => state(page), data => data.outbox.length === 0 && data.acks.length === baseline.acks.length + 2, 'automatic queue ACK/drain');
    if (name === 'webkit') {
      const fault = await page.evaluate(() => ({ retries: window.__t04Fault.retries, error: window.__t04Fault.error }));
      assert.equal(fault.error, null); repeated = fault.retries;
      await page.evaluate(() => window.__t04Fault.restore()); faultPage = undefined;
    }
    assert.equal(routeError, undefined); assert.equal(repeated, 1);
    assert.equal(countMarker(synced, marker), 1);
    assert.deepEqual(synced.attachments.find(item => item.ref.attachment_id === photoId), photo);
    await noSyncCopy(page, frame);
    await first.unroute(`${origin}/api/v1/commands`);

    log('second independent device / actual seed + binary photo download');
    second = await launch('two'); observe(second, { value: false });
    const deviceTwo = await second.newPage(), secondFrame = await login(deviceTwo);
    const downloaded = await until(() => state(deviceTwo), data => countMarker(data, marker) === 1 && data.attachments.some(item => item.ref.attachment_id === photoId), 'second device server projection');
    assert.equal(downloaded.outbox.length, 0);
    assert.deepEqual(downloaded.attachments.find(item => item.ref.attachment_id === photoId), photo);
    assert.equal(Object.keys(latest(downloaded).fotos).filter(id => id === photoId).length, 1);
    assert(http.some(item => item.path === `/api/v1/attachments/${photoId}` && item.method === 'PUT' && item.status === 200));
    assert(http.some(item => item.path === `/api/v1/attachments/${photoId}` && item.method === 'GET' && item.status === 200));
    await noSyncCopy(deviceTwo, secondFrame);
    await second.close(); second = undefined;
    await first.close(); first = undefined;

    log('first device cold offline restart after ACK / metadata + photo bytes');
    first = await launch('one'); mode.value = true; observe(first, mode); await first.setOffline(true);
    const cold = await first.newPage(), coldFrame = await login(cold), restored = await state(cold);
    assert.equal(restored.outbox.length, 0); assert.equal(countMarker(restored, marker), 1);
    assert.deepEqual(restored.attachments.find(item => item.ref.attachment_id === photoId), photo);
    assert.deepEqual(latest(restored).fotos[photoId], latest(synced).fotos[photoId]);
    await coldFrame.locator('#tab-fotos').click();
    await coldFrame.locator('[data-testid="capataz-fotos-tab"]').waitFor({ state: 'visible' });
    await noSyncCopy(cold, coldFrame);

    const allowedFailure = item => {
      const url = new URL(item.url);
      if (url.origin !== origin) return false;
      if (!['fetch', 'xhr'].includes(item.type)) return false;
      if (!item.offline) return item.injected && url.pathname === '/api/v1/commands' && item.method === 'POST';
      return (url.pathname === '/api/v1/auth/login' && item.method === 'POST') || (url.pathname === '/api/v1/commands' && item.method === 'POST') || (url.pathname === '/api/v1/sync' && item.method === 'GET') || (/^\/api\/v1\/attachments\/[0-9a-f-]{36}$/i.test(url.pathname) && ['GET', 'PUT'].includes(item.method));
    };
    assert.deepEqual(failures.filter(item => !allowedFailure(item)), [], 'Unexpected browser request failure');
    const unexplained = consoleErrors.filter(item => !failures.some(failure => allowedFailure(failure) && (!item.url || item.url === failure.url) && item.text === `Failed to load resource: ${failure.error}`));
    assert.deepEqual(unexplained, [], 'Console errors must correspond exactly to expected failed HTTP requests');
    assert.deepEqual(pageErrors, []);
    log('PASS');
    return { browser: name, passed: true, faultMechanism: name === 'webkit' ? 'fetch-boundary-after-commit' : 'network-route-after-commit', baselineRevision: latest(baseline).localRevision, offlineCommands: 2, lostRealCommittedAck: true, identicalRetryBodyAndAck: true, retryCount: repeated, drainedOutbox: true, secondDeviceUniqueRecord: true, photo: { id: photoId, sha256: photo.hash, bytes: photo.size, width: photo.width, height: photo.height }, coldOfflineAfterAck: true, http, expectedFailureCount: failures.length };
  } catch (error) {
    const pages = first?.pages() ?? [];
    const page = pages.findLast(item => !item.isClosed() && item.url().startsWith(origin));
    let durable, browserState;
    if (page) {
      durable = await state(page).then(data => ({ pending: data.outbox.length, acks: data.acks.length, conflicts: data.conflicts.length, cursors: data.cursors.length, revision: latest(data).localRevision, commandTypes: data.outbox.map(item => item.command.command_type) })).catch(error => ({ error: String(error) }));
      browserState = await page.evaluate(() => ({ online: navigator.onLine, visibility: document.visibilityState, controlled: Boolean(navigator.serviceWorker?.controller) })).catch(() => undefined);
    }
    throw new Error(`${name} stage=${stage}: ${error.stack ?? error}; diagnostics=${JSON.stringify({ durable, browserState, http, failures, pageErrors, consoleErrors })}`);
  }
  finally { releaseRetry?.(); await faultPage?.evaluate(() => window.__t04Fault?.restore()).catch(() => {}); await second?.close(); await first?.close(); }
}

try {
  paths = await createPersistentProfilePaths(runRoot); canonicalRoot = await realpath(runRoot);
  await mkdir(resolve(root, '.qa/runs'), { recursive: true });
  for (const browser of [chromium, webkit]) results.push(await exercise(browser));
  await writeFile(reportPath, JSON.stringify({ runId, origin, results }, null, 2));
  console.info(`T04 silent sync: ${results.length}/2 PASS. Report: ${reportPath}`);
} catch (error) {
  await mkdir(resolve(root, '.qa/runs'), { recursive: true });
  await writeFile(reportPath, JSON.stringify({ runId, origin, results, error: String(error) }, null, 2));
  console.error(`T04 silent sync failed. Report: ${reportPath}`); throw error;
} finally {
  await paths?.dispose();
  if (canonicalRoot) {
    const owned = relative(await realpath(resolve(root, '.qa/tmp')), canonicalRoot);
    assert(owned && !isAbsolute(owned) && !owned.split(/[\\/]/).includes('..'));
    assert.equal(await realpath(runRoot), canonicalRoot); await rm(canonicalRoot, { recursive: true, force: true });
  }
}
