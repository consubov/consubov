import assert from 'node:assert/strict';
import { mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPersistentProfilePaths } from './persistent-profile-path.mjs';
import { syncPullResponseSchema } from '@consubov/contracts';

const root = resolve(import.meta.dirname, '../..');
const { chromium, webkit } = await import(pathToFileURL(resolve(root, 'packages/local-data/node_modules/@playwright/test/index.mjs')).href);
const origin = `http://127.0.0.1:${process.env.T03_PORT ?? '5187'}`;
const runId = `t03-rpc-stale-${new Date().toISOString().replaceAll(':', '-')}-${process.pid}`;
const runRoot = resolve(root, '.qa/tmp', `r-${process.pid}-${crypto.randomUUID().slice(0, 8)}`);
const reportPath = resolve(root, '.qa/runs', `${runId}.json`);
const results = [];
let paths;
let canonicalRunRoot;

// Observe the real transport without changing its payloads, delivery or error handling.
function observeRpc() {
  window.__t03Rpc = [];
  const send = MessagePort.prototype.postMessage;
  MessagePort.prototype.postMessage = function (message, ...rest) {
    if (message?.protocolVersion === 1 && message.moduleId === 'gerente') {
      window.__t03Rpc.push({
        kind: message.kind, requestId: message.requestId, method: message.method,
        expectedRevision: message.payload?.expectedModuleRevision,
        aggregateId: message.payload?.command?.aggregate_id,
        commandId: message.payload?.command?.command_id,
        revisions: Array.isArray(message.result) ? message.result.map(item => item.data?.localRevision).filter(value => value !== undefined) : undefined,
        ok: message.ok, error: message.error
      });
    }
    return send.call(this, message, ...rest);
  };
}

async function localState(page) {
  return page.evaluate(async () => {
    const names = (await indexedDB.databases()).map(item => item.name).filter(name => {
      if (!name?.startsWith('consubov-local-')) return false;
      try { const key = JSON.parse(decodeURIComponent(name.slice('consubov-local-'.length))); return key[0] === 'consubov' && key[1] === 'gerente'; }
      catch { return false; }
    });
    if (names.length !== 1) throw new Error(`Expected one Gerente partition; found ${names.length}`);
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(names[0]);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(['snapshots', 'outbox', 'meta'], 'readonly');
        const state = { database: names[0] };
        for (const store of ['snapshots', 'outbox', 'meta']) {
          const request = tx.objectStore(store).getAll();
          request.onsuccess = () => { state[store] = request.result; };
        }
        tx.oncomplete = () => resolve(state);
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
}

const latest = state => state.snapshots.toSorted((a, b) => (b.data.localRevision ?? 0) - (a.data.localRevision ?? 0))[0].data;
const trace = page => page.evaluate(() => window.__t03Rpc);

async function login(page) {
  await page.goto(`${origin}/#/fazenda/gerente`, { waitUntil: 'load' });
  await page.locator('#login-email').waitFor({ state: 'visible', timeout: 45000 });
  await page.locator('#login-email').fill('gerente.lab@consubov.local');
  await page.locator('#login-password').fill('lab@123456');
  await page.getByRole('button', { name: /Entrar no Sistema/i }).click();
  const frame = page.frameLocator('iframe');
  const selectContext = page.getByRole('button', { name: /Acessar Este Contexto/i });
  // Cached offline authentication may restore the authorized context directly.
  // Wait for one concrete rendered outcome before inspecting either branch.
  await Promise.race([
    selectContext.waitFor({ state: 'visible', timeout: 45000 }),
    frame.locator('[data-testid="gerente-dashboard-tab"]').waitFor({ state: 'visible', timeout: 45000 })
  ]);
  if (await selectContext.isVisible()) await selectContext.click();
  await frame.locator('[data-testid="gerente-dashboard-tab"] tbody tr').first().waitFor({ state: 'visible', timeout: 45000 });
  assert.equal(await page.locator('iframe').getAttribute('srcdoc') !== null, true);
  assert.equal((await page.locator('iframe').getAttribute('sandbox')).includes('allow-same-origin'), false);
  return frame;
}

async function exercise(browserType) {
  const name = browserType.name();
  let stage = 'launch';
  const log = value => { stage = value; console.info(`[${name}] ${stage}`); };
  const profile = resolve(runRoot, name);
  await mkdir(profile, { recursive: true });
  let context;
  const errors = [], failedRequests = [], resourceErrors = [], warnings = [];
  let offlinePhase = false;
  const syncResponses = [], responseReads = new Set();
  let responseOrder = 0;
  const drainResponses = async () => { while (responseReads.size) await Promise.all([...responseReads]); };
  const observe = page => {
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.origin !== origin || url.pathname !== '/api/v1/sync' || response.request().method() !== 'GET') return;
      const record = { page, url, status: response.status(), order: responseOrder++, offline: offlinePhase, authorization: response.request().headers().authorization };
      syncResponses.push(record);
      const pending = response.json().then(body => { record.body = body; }).catch(() => { record.bodyUnreadable = true; });
      responseReads.add(pending);
      void pending.finally(() => responseReads.delete(pending));
    });
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => failedRequests.push({ url: request.url(), method: request.method(), type: request.resourceType(), error: request.failure()?.errorText, offline: offlinePhase }));
    page.on('console', message => {
      if (message.type() === 'error') {
        if (message.text().startsWith('Failed to load resource:')) resourceErrors.push({ text: message.text(), url: message.location().url, offline: offlinePhase });
        else errors.push(message.text());
      }
      if (message.type() === 'warning' && message.text().startsWith('[MODULE_LOCAL_DATA_FAILURE]')) warnings.push(message.text());
    });
  };
  try {
    context = await browserType.launchPersistentContext(paths.browserPath(profile), { headless: true, serviceWorkers: 'allow' });
    await context.addInitScript(observeRpc);
    const a = context.pages()[0] ?? await context.newPage();
    observe(a);
    log('login A / hydrate revision zero');
    const frameA = await login(a);
    await a.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    const b = await context.newPage();
    observe(b);
    log('login B / hydrate revision zero');
    const frameB = await login(b);
    const initial = await localState(a);
    assert.equal(latest(initial).localRevision ?? 0, 0);
    assert.equal(initial.outbox.length, 0);
    for (const page of [a, b]) assert((await trace(page)).some(item => item.revisions?.includes(0)), 'Both independent RPC clients must hydrate revision zero');
    const lotes = latest(initial).lotes;
    assert(lotes.length >= 2, 'Cross-aggregate test needs two seeded lots');
    const destination = `pasto-rpc-${process.pid}`;
    await frameB.locator('#tab-lotes').click();
    await frameB.locator('[data-testid="gerente-lotes-tab"] select').selectOption(lotes[1].lote_id);
    await frameB.getByLabel('Pasto de Destino').fill(destination);

    log('A commits first-lot GMD through opaque iframe RPC');
    await frameA.locator('#tab-metas').click();
    await frameA.getByLabel('GMD Alvo (kg/dia)').fill('1.65');
    await frameA.locator('[data-testid="gerente-gmd-tab"] form').first().locator('button[type="submit"]').click();
    await frameA.getByText('Metas zootécnicas atualizadas com sucesso!', { exact: true }).waitFor();
    const afterA = await localState(a);
    assert.equal(afterA.outbox.length, 1);
    assert.equal(latest(afterA).localRevision, 1);

    log('B stale different-aggregate write rejects and rehydrates');
    await frameB.getByRole('button', { name: 'Movimentar para Pasto', exact: true }).click();
    await frameB.getByRole('alert').filter({ hasText: /^MODULE_FAILURE: Estado local desatualizado/ }).waitFor();
    assert.equal(await frameB.getByText('Movimentação de lote confirmada com sucesso!', { exact: true }).count(), 0);
    const rejected = await localState(b);
    assert.deepEqual(rejected, afterA, 'Rejected CAS must leave every durable store unchanged');
    const responsesB = await trace(b);
    const failureIndex = responsesB.findIndex(item => item.ok === false && item.error?.code === 'MODULE_FAILURE' && item.error.message.startsWith('Estado local desatualizado'));
    assert(failureIndex >= 0, 'Host must send the controlled error on the real MessagePort');
    assert(responsesB.slice(failureIndex + 1).some(item => item.revisions?.includes(1)), 'B must rehydrate via RPC after the failure');
    await frameB.locator('#tab-overview').click();
    await frameB.getByText('1.65', { exact: true }).waitFor();

    log('explicit B retry preserves A and adds exactly one command');
    await frameB.locator('#tab-lotes').click();
    await frameB.locator('[data-testid="gerente-lotes-tab"] select').selectOption(lotes[1].lote_id);
    await frameB.getByLabel('Pasto de Destino').fill(destination);
    await frameB.getByRole('button', { name: 'Movimentar para Pasto', exact: true }).click();
    await frameB.getByText('Movimentação de lote confirmada com sucesso!', { exact: true }).waitFor();
    const before = await localState(b);
    assert.equal(before.outbox.length, 2);
    assert.equal(new Set(before.outbox.map(item => item.command.command_id)).size, 2);
    assert.equal(new Set(before.outbox.map(item => item.command.aggregate_id)).size, 2);
    assert.equal(latest(before).localRevision, 2);
    assert.equal(latest(before).lotes.find(item => item.lote_id === lotes[0].lote_id).meta_gmd_kg_dia, 1.65);
    assert.equal(latest(before).lotes.find(item => item.lote_id === lotes[1].lote_id).pasto_id, destination);
    const childB = await (await b.locator('iframe').elementHandle()).contentFrame();
    assert(childB);
    const requestsB = await childB.evaluate(() => window.__t03Rpc.filter(item => item.method === 'commitMutation'));
    assert.deepEqual(requestsB.map(item => item.expectedRevision), [0, 1]);
    assert(requestsB.every(item => item.aggregateId === lotes[1].lote_id));
    await drainResponses();
    const cursorRecoveries = syncResponses.filter(item => item.status === 400).map(rejected => {
      assert(!rejected.offline && rejected.url.searchParams.get('since_cursor')?.trim() && rejected.body?.error === 'INVALID_CURSOR', 'Only documented nonempty invalid sync cursors can recover');
      assert(rejected.authorization, 'Cursor recovery must retain authorized context');
      const query = new URLSearchParams(rejected.url.searchParams);
      query.delete('since_cursor');
      const recovered = syncResponses.find(item => item.order > rejected.order && item.page === rejected.page && item.authorization === rejected.authorization && !item.offline && item.status === 200 && item.url.search === `?${query}`);
      assert(recovered, 'Invalid cursor must be followed by a real authorized full projection');
      const body = syncPullResponseSchema.parse(recovered.body);
      assert.equal(body.tenant_id, query.get('tenant_id'));
      assert.equal(body.fazenda_id, query.get('fazenda_id'));
      assert.equal(query.get('profile_id'), 'gerente');
      return { rejected, recovered };
    });
    await context.close();
    context = undefined;

    log('new browser process / offline login / durable records');
    context = await browserType.launchPersistentContext(paths.browserPath(profile), { headless: true, serviceWorkers: 'allow' });
    await context.addInitScript(observeRpc);
    await context.setOffline(true);
    offlinePhase = true;
    const reopened = context.pages()[0] ?? await context.newPage();
    observe(reopened);
    const reopenedFrame = await login(reopened);
    await reopenedFrame.getByText('1.65', { exact: true }).waitFor();
    await reopenedFrame.getByText(destination, { exact: true }).waitFor();
    assert.deepEqual(await localState(reopened), before, 'Cold offline reopen must preserve exact snapshots, outbox and metadata');
    const expectedError = name === 'chromium' ? 'net::ERR_INTERNET_DISCONNECTED' : 'WebKit encountered an internal error';
    const offlineApiFailures = failedRequests.filter(item => item.offline && [`${origin}/api/v1/auth/login`, `${origin}/api/v1/commands`].includes(item.url) && item.method === 'POST' && ['fetch', 'xhr'].includes(item.type) && item.error === expectedError);
    const fallbacks = offlineApiFailures.filter(item => item.url === `${origin}/api/v1/auth/login`);
    assert(fallbacks.length > 0, 'Cold offline login must exercise the auth network fallback');
    assert.equal(failedRequests.length, offlineApiFailures.length, `Unexpected failed requests: ${JSON.stringify(failedRequests)}`);
    const unexplained = resourceErrors.filter(item => {
      const recoveredCursor = !item.offline && cursorRecoveries.some(({ rejected }) => item.url === rejected.url.href && item.text === 'Failed to load resource: the server responded with a status of 400 (Bad Request)');
      const offlineFailure = item.offline && offlineApiFailures.some(request => (!item.url || item.url === request.url) && item.text === `Failed to load resource: ${request.error}`);
      return !recoveredCursor && !offlineFailure;
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(unexplained, []);
    assert.equal(warnings.length, 1);
    assert(warnings[0].includes('commitMutation StaleModuleStateError'));
    log('PASS');
    return { browser: name, passed: true, opaqueIframeRpc: true, initialRevision: 0, rejectedStaleRevision: 0, retryRevision: 1, finalRevision: 2, differentAggregates: true, outboxCount: 2, durableColdOfflineReopen: true, offlineAuthFallbackCount: fallbacks.length, cursorRecoveries: cursorRecoveries.map(({ recovered }) => ({ error: 'INVALID_CURSOR', retryWithoutCursor: true, sameAuthorizedContext: true, validatedSyncPullDto: true, tenantId: recovered.body.tenant_id, fazendaId: recovered.body.fazenda_id, profileId: 'gerente' })), controlledFailure: responsesB[failureIndex].error };
  } catch (error) { throw new Error(`${name} stage=${stage}: ${error.stack ?? error}`); }
  finally { await context?.close(); }
}

try {
  paths = await createPersistentProfilePaths(runRoot);
  canonicalRunRoot = await realpath(runRoot);
  await mkdir(resolve(root, '.qa/runs'), { recursive: true });
  for (const browser of [chromium, webkit]) results.push(await exercise(browser));
  await writeFile(reportPath, JSON.stringify({ runId, origin, results }, null, 2));
  console.info(`T03 production RPC stale recovery: ${results.length}/2 PASS. Report: ${reportPath}`);
} catch (error) {
  await mkdir(resolve(root, '.qa/runs'), { recursive: true });
  await writeFile(reportPath, JSON.stringify({ runId, origin, results, error: String(error) }, null, 2));
  console.error(`T03 production RPC stale recovery failed. Report: ${reportPath}`);
  throw error;
} finally {
  await paths?.dispose();
  if (canonicalRunRoot) {
    const owned = relative(await realpath(resolve(root, '.qa/tmp')), canonicalRunRoot);
    assert(owned && !isAbsolute(owned) && !owned.split(/[\\/]/).includes('..'), 'Refusing cleanup outside owned QA directory');
    assert.equal(await realpath(runRoot), canonicalRunRoot);
    await rm(canonicalRunRoot, { recursive: true, force: true });
  }
}
