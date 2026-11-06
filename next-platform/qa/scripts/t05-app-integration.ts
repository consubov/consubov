import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createProductionHandler } from './serve-production-t03';

const root = resolve(import.meta.dir, '../..');
const { chromium, webkit } = await import(pathToFileURL(resolve(root, 'packages/local-data/node_modules/@playwright/test/index.mjs')).href);
const { createPersistentProfilePaths } = await import(pathToFileURL(resolve(import.meta.dir, 'persistent-profile-path.mjs')).href);
type Page = any;
type BrowserContext = any;
const runId = `t05-app-${new Date().toISOString().replaceAll(':', '-')}-${process.pid}`;
const owned = resolve(root, '.qa/tmp', `a-${process.pid}-${crypto.randomUUID().slice(0, 6)}`);
const shellRoot = resolve(owned, 'shell'), moduleRoot = resolve(owned, 'modules');
const runDir = resolve(root, '.qa/runs', runId);
const results: unknown[] = [], output: string[] = [];
let fault = false;
const apiFaults: { path: string; status: number }[] = [];
const moduleDownloads: { engine: string; path: string }[] = [];
let activeEngine = '';
const log = (message: string) => { output.push(message); console.info(message); };
async function command(args: string[], cwd = root, env: Record<string, string> = {}) {
  const child = Bun.spawn(args, { cwd, env: { ...process.env, ...env }, stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  output.push(`$ ${args.join(' ')}\n${stdout}\n${stderr}`);
  if (code !== 0) throw new Error(`Command failed (${code}): ${args.join(' ')}\n${stderr}`);
  return stdout.trim();
}
async function source() {
  const inventory: Record<string, string> = {};
  const names = (await command(['rg', '--files', 'apps', 'packages', 'api'])).split(/\r?\n/).filter(Boolean).sort();
  names.push('qa/scripts/t05-app-integration.ts', 'qa/scripts/serve-production-t03.ts', 'qa/scripts/persistent-profile-path.mjs');
  for (const name of names) inventory[name.replaceAll('\\', '/')] = createHash('sha256').update(await readFile(resolve(root, name))).digest('hex');
  return { commit: await command(['git', 'rev-parse', 'HEAD']), dirty: await command(['git', 'status', '--short']),
    diffSha256: createHash('sha256').update(await command(['git', 'diff', '--binary', '--', '.'])).digest('hex'),
    productionSourceHashes: inventory };
}
async function files(path: string): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const item of await readdir(path, { withFileTypes: true })) {
    const child = resolve(path, item.name);
    assert(!item.isSymbolicLink(), 'Unexpected symlink in owned artifacts');
    if (item.isDirectory()) for (const [name, hash] of Object.entries(await files(child))) hashes[`${item.name}/${name}`] = hash;
    else hashes[item.name] = createHash('sha256').update(await readFile(child)).digest('hex');
  }
  return hashes;
}
async function publish(profile?: string, version?: string) {
  await command([process.execPath, 'run', 'apps/fazenda/shell/scripts/build-module-artifacts.ts', ...(profile ? [profile] : [])], root,
    { CONSUBOV_MODULE_OUTPUT_ROOT: moduleRoot, ...(version ? { CONSUBOV_MODULE_VERSION: version } : {}) });
}
async function until<T>(read: () => Promise<T>, accepts: (value: T) => boolean, label: string, timeout = 50000): Promise<T> {
  const deadline = Date.now() + timeout;
  do { const value = await read(); if (accepts(value)) return value; await new Promise(done => setTimeout(done, 150)); } while (Date.now() < deadline);
  throw new Error(`Timed out: ${label}`);
}
async function pointer(page: Page): Promise<any> {
  return page.evaluate(async () => { const response = await (await caches.open('consubov-release-pointers-v2')).match('/__modules/capataz'); return response ? response.json() : null; });
}
async function durable(page: Page): Promise<any> {
  return page.evaluate(async () => {
    const names = (await indexedDB.databases()).map(item => item.name).filter(name => {
      if (!name?.startsWith('consubov-local-')) return false;
      try { const key = JSON.parse(decodeURIComponent(name.slice('consubov-local-'.length))); return key[0] === 'consubov' && key[1] === 'capataz'; } catch { return false; }
    });
    if (names.length !== 1) throw new Error(`Expected one Capataz DB, found ${names.length}`);
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(names[0]!); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const data: any = await new Promise((resolve, reject) => {
      const stores = ['snapshots', 'outbox', 'attachments']; const tx = db.transaction(stores, 'readonly'); const result: any = {};
      for (const name of stores) { const request = tx.objectStore(name).getAll(); request.onsuccess = () => { result[name] = request.result; }; }
      tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error);
    });
    db.close();
    data.attachments = await Promise.all(data.attachments.map(async (item: any) => {
      const blob = item.bytes instanceof ArrayBuffer ? new Blob([item.bytes], { type: item.ref.mime_type }) : item.blob;
      if (!(blob instanceof Blob)) throw new Error('Missing durable photo bytes');
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('');
      return { ref: item.ref, hash, size: blob.size, mime: blob.type };
    }));
    return data;
  });
}
async function nonce(page: Page) { return page.frameLocator('iframe').locator('meta[name="consubov-module-nonce"]').getAttribute('content'); }
async function login(page: Page, origin: string) {
  await page.goto(`${origin}/#/fazenda/capataz`, { waitUntil: 'load' });
  await page.locator('#login-email').fill('capataz.lab@consubov.local');
  await page.locator('#login-password').fill('lab@123456');
  await page.getByRole('button', { name: /Entrar no Sistema/i }).click();
  const frame = page.frameLocator('iframe'), button = page.getByRole('button', { name: /Acessar Este Contexto/i });
  await Promise.race([button.waitFor({ state: 'visible', timeout: 45000 }), frame.locator('#cocho-input-notes').waitFor({ state: 'visible', timeout: 45000 })]);
  if (await button.isVisible()) await button.click();
  await frame.locator('#cocho-input-notes').waitFor({ state: 'visible', timeout: 45000 });
  return frame;
}

await mkdir(runDir, { recursive: true }); await mkdir(owned, { recursive: true });
const initial = await source(); const canonicalOwned = await realpath(owned), canonicalRoot = await realpath(root);
const paths = await createPersistentProfilePaths(owned);
let server: ReturnType<typeof Bun.serve> | undefined;
let passed = false;
try {
  log('Building all real module artifacts and actual production shell into this run only');
  await publish();
  await command([process.execPath, 'run', 'vite', 'build', '--outDir', shellRoot], resolve(root, 'apps/fazenda/shell'));
  const handler = createProductionHandler({ shellRoot, moduleRoot });
  server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/modules/')) moduleDownloads.push({ engine: activeEngine, path });
    if (fault && path.startsWith('/api/v1/') && path !== '/api/v1/auth/login') {
      apiFaults.push({ path, status: 503 });
      return Response.json({ error: 'QA controlled API availability fault' }, { status: 503, headers: { 'X-QA-Fault': 'availability' } });
    }
    return handler(request);
  } });
  const origin = `http://127.0.0.1:${server.port}`;
  for (const [index, browser] of [chromium, webkit].entries()) {
    const engine = browser.name(), requests: string[] = [], errors: string[] = [];
    const consoleErrors: { text: string; url: string }[] = [];
    const failedRequests: { url: string; method: string; failure: { errorText: string }; offline: boolean }[] = [];
    activeEngine = engine; let offline = false;
    const observe = (page: Page) => {
      page.on('pageerror', (error: Error) => errors.push(error.message));
      page.on('console', (message: any) => { if (message.type() === 'error') consoleErrors.push({ text: message.text(), url: message.location().url }); });
      page.on('requestfailed', (request: any) => failedRequests.push({ url: request.url(), method: request.method(), failure: request.failure(), offline }));
    };
    let context: BrowserContext | undefined; let stage = 'initial login';
    const progress = (value: string) => { stage = value; log(`[${engine}] ${value}`); };
    try {
      fault = false; if (index) await publish('capataz', '0.1.0');
      const profile = resolve(owned, engine); await mkdir(profile);
      context = await browser.launchPersistentContext(paths.browserPath(profile), { headless: true, serviceWorkers: 'allow' });
      context.on('request', (request: { url(): string }) => requests.push(new URL(request.url()).pathname));
      const page = await context.newPage(); observe(page);
      const frame = await login(page, origin);
      const base = await until(() => pointer(page), p => Boolean(p?.activeHealthy && !p.candidate), 'actual iframe health promotion');
      await until(() => durable(page), d => d.outbox.length === 0, 'baseline outbox');
      const oldNonce = await nonce(page), marker = `${runId}-${engine}`;
      progress('Offline real feed command and photo');
      offline = true; await context.setOffline(true);
      await frame.locator('#cocho-input-notes').fill(marker); await frame.locator('#cocho-input-bags').fill('7');
      await frame.locator('[data-testid="capataz-cocho-tab"] form button[type="submit"]').click();
      await until(() => durable(page), d => d.outbox.length === 1, 'real feed persisted');
      const png = await page.evaluate(async () => {
        const canvas = document.createElement('canvas'); canvas.width = 1800; canvas.height = 1000;
        const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#346b23'; ctx.fillRect(0, 0, 1800, 1000); ctx.fillStyle = '#fff'; ctx.font = '80px sans-serif'; ctx.fillText('CONSUBOV QA PHOTO', 100, 300);
        const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'));
        return Array.from(new Uint8Array(await blob.arrayBuffer()));
      });
      await frame.locator('#tab-fotos').click();
      await frame.locator('[data-testid="capataz-photo-file"]').setInputFiles({ name: 't05-photo.png', mimeType: 'image/png', buffer: Buffer.from(png) });
      const durableBefore = await until(() => durable(page), d => d.outbox.length === 2 && d.attachments.length === 1, 'real photo persisted');
      assert.equal(durableBefore.attachments[0].hash, durableBefore.attachments[0].ref.hash_sha256);
      assert.equal(durableBefore.attachments[0].mime, 'image/jpeg');
      await frame.locator('#tab-cocho').click();
      const field = frame.locator('#cocho-input-notes'), fieldBaseline = await field.inputValue();
      await field.fill(`unsaved-${marker}`);
      await frame.locator('body').evaluate((body: HTMLElement) => { (body as any).__t05Document = crypto.randomUUID(); });
      const docIdentity = await frame.locator('body').evaluate((body: HTMLElement) => (body as any).__t05Document);
      fault = true; offline = false; await context.setOffline(false);
      progress('Publishing only Capataz while actual form is dirty');
      const beforeFiles = { shell: await files(shellRoot), gerente: await files(resolve(moduleRoot, 'gerente')), escritorio: await files(resolve(moduleRoot, 'escritorio')), fabrica: await files(resolve(moduleRoot, 'fabrica')) };
      const newVersion = `0.1.${101 + index}`; await publish('capataz', newVersion);
      const afterFiles = { shell: await files(shellRoot), gerente: await files(resolve(moduleRoot, 'gerente')), escritorio: await files(resolve(moduleRoot, 'escritorio')), fabrica: await files(resolve(moduleRoot, 'fabrica')) };
      assert.deepEqual(afterFiles, beforeFiles, 'Other modules, shell, and worker bytes must stay identical');
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      const staged = await until(() => pointer(page), p => p?.candidate?.manifest.version === newVersion, 'candidate staged while dirty');
      assert.equal(staged.activeHealthy.generation, base.activeHealthy.generation);
      assert.equal(await nonce(page), oldNonce); assert.equal(await field.inputValue(), `unsaved-${marker}`);
      assert.equal(await frame.locator('body').evaluate((body: HTMLElement) => (body as any).__t05Document), docIdentity);
      assert.deepEqual(await durable(page), durableBefore);
      progress('Reverting form permits real iframe activation and health promotion');
      await field.fill(fieldBaseline); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      const promoted = await until(() => pointer(page), p => p?.activeHealthy?.manifest.version === newVersion && !p.candidate, 'new actual iframe healthy');
      assert.notEqual(await nonce(page), oldNonce); assert.equal(promoted.previousHealthy.generation, base.activeHealthy.generation);
      assert.deepEqual(await durable(page), durableBefore);
      progress('Real runtime error triggers N-1 rollback');
      await frame.locator('body').evaluate(() => window.dispatchEvent(new ErrorEvent('error', { message: 'QA controlled runtime failure', error: new Error('QA controlled runtime failure') })));
      const rolled = await until(() => pointer(page), p => p?.activeHealthy?.generation === base.activeHealthy.generation && !p.previousHealthy, 'N-1 actual rollback');
      await frame.locator('#cocho-input-notes').waitFor({ state: 'visible' }); assert.deepEqual(await durable(page), durableBefore);
      const offlineNonce = await nonce(page);
      progress('Offline cold reopen of persisted browser profile');
      await context.close(); context = undefined;
      offline = true;
      context = await browser.launchPersistentContext(paths.browserPath(profile), { headless: true, serviceWorkers: 'allow', offline: true });
      const cold = await context.newPage(); observe(cold); await login(cold, origin);
      assert.deepEqual(await durable(cold), durableBefore);
      assert.equal((await pointer(cold)).activeHealthy.generation, rolled.activeHealthy.generation);
      assert.notEqual(await nonce(cold), offlineNonce);
      assert.equal(requests.filter(path => /^\/modules\/(gerente|escritorio|fabrica)\//.test(path)).length, 0);
      assert.equal(moduleDownloads.filter(item => item.engine === engine && /^\/modules\/(gerente|escritorio|fabrica)\//.test(item.path)).length, 0, 'Server must receive no other-profile download, including worker fetches');
      assert.deepEqual(errors, [], 'Unexpected uncaught browser errors');
      const expectedFailure = (item: typeof failedRequests[number]) => {
        const url = new URL(item.url);
        if (!item.offline || url.origin !== origin) return false;
        return (['/api/v1/auth/login', '/api/v1/commands'].includes(url.pathname) && item.method === 'POST') ||
          (url.pathname === '/api/v1/sync' && item.method === 'GET') ||
          (/^\/api\/v1\/attachments\/[0-9a-f-]{36}$/i.test(url.pathname) && ['GET', 'PUT'].includes(item.method));
      };
      assert.deepEqual(failedRequests.filter(item => !expectedFailure(item)), [], 'Unexpected failed request');
      const expectedConsole = (item: typeof consoleErrors[number]) => {
        if (failedRequests.some(failure => expectedFailure(failure) && item.url === failure.url && item.text === `Failed to load resource: ${failure.failure.errorText}`)) return true;
        if (item.text !== 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)') return false;
        const url = new URL(item.url);
        return url.origin === origin && apiFaults.some(fault => fault.path === url.pathname);
      };
      assert.deepEqual(consoleErrors.filter(item => !expectedConsole(item)), [], 'Unexpected console error');
      results.push({ engine, pass: true, initialGeneration: base.activeHealthy.generation, candidateGeneration: staged.candidate.generation,
        promotedGeneration: promoted.activeHealthy.generation, rollbackGeneration: rolled.activeHealthy.generation,
        oldNonce, offlineNonce, outboxCount: durableBefore.outbox.length, photo: durableBefore.attachments[0],
        unchangedArtifactHashes: beforeFiles, otherModuleDownloads: 0, serverModuleRequests: moduleDownloads.filter(item => item.engine === engine), pageErrors: errors, consoleErrors, failedRequests,
        injectedRuntimeFault: 'ErrorEvent QA controlled runtime failure inside actual iframe', injectedAvailabilityFault: '503 API requests except auth' });
    } catch (error) { results.push({ engine, pass: false, stage, error: String(error), pageErrors: errors, consoleErrors, failedRequests }); throw error; }
    finally { await context?.close(); }
  }
  passed = true;
} catch (error) { log(String(error)); process.exitCode = 1; }
finally {
  server?.stop(true); await paths.dispose();
  const final = await source();
  const productionSourceUnchanged = JSON.stringify(initial.productionSourceHashes) === JSON.stringify(final.productionSourceHashes);
  const trackedDiffUnchanged = initial.commit === final.commit && initial.diffSha256 === final.diffSha256;
  const changedSourcePaths = [...new Set([...Object.keys(initial.productionSourceHashes), ...Object.keys(final.productionSourceHashes)])]
    .filter(path => initial.productionSourceHashes[path] !== final.productionSourceHashes[path]);
  const testOnly = (path: string) => /^packages\/.*\/test\//.test(path) || /\.test\.[^/]+$/.test(path);
  const report = { runId, initial, final, sourceUnchanged: trackedDiffUnchanged && productionSourceUnchanged,
    trackedDiffUnchanged, productionSourceUnchanged, sourceScope: 'next-platform tracked diff plus full apps/packages/api inventory and E2E/server/profile helper scripts, including untracked files',
    runtimeSourceUnchanged: changedSourcePaths.every(testOnly), changedSourcePaths,
    sourceChangeClassification: changedSourcePaths.map(path => ({ path, testOnly: testOnly(path), includedInActualBuild: !testOnly(path) })),
    pass: passed, acceptanceClaim: false, isolatedBuild: true, controlledApiAvailabilityFault: { status: 503, requests: apiFaults }, results };
  await writeFile(resolve(runDir, 'result.json'), JSON.stringify(report, null, 2));
  await writeFile(resolve(runDir, 'output.log'), output.join('\n'));
  const child = relative(canonicalRoot, canonicalOwned);
  assert(!isAbsolute(child) && child.startsWith(`.qa${sep}tmp${sep}`) && !child.split(sep).includes('..'));
  assert.equal(await realpath(owned), canonicalOwned); await rm(canonicalOwned, { recursive: true, force: true });
  log(`Report: ${resolve(runDir, 'result.json')}`);
}
