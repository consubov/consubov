import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRouter } from '../../api/src/router';
import { InMemoryLedger } from '../../api/src/ledger/in-memory-ledger';
import { createProductionHandler } from './serve-production-t03';

const root = resolve(import.meta.dir, '../..');
const runId = `t06-admin-${new Date().toISOString().replaceAll(':', '-')}-${process.pid}`;
const owned = resolve(root, '.qa/tmp', `adm-${process.pid}-${crypto.randomUUID().slice(0, 5)}`);
const runDir = resolve(root, '.qa/runs', runId);
const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const output: string[] = [], results: any[] = [], requests: any[] = [];
const log = (message: string) => { output.push(message); console.info(message); };
const headers = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Cache-Control': 'no-store'
};
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
async function inventory(directory: string, prefix = ''): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (['node_modules', 'dist', 'dist-candidate', 'dist-lab', '.qa', '.git'].includes(entry.name)) continue;
    assert(!entry.isSymbolicLink(), `Unexpected source/artifact symlink: ${entry.name}`);
    const name = prefix + entry.name, path = resolve(directory, entry.name);
    if (entry.isDirectory()) Object.assign(hashes, await inventory(path, name + '/'));
    else hashes[name] = digest(await readFile(path));
  }
  return hashes;
}
async function sources() {
  const result: Record<string, unknown> = {};
  for (const target of ['apps/admin-global', 'apps/fazenda/shell', 'apps/fazenda/capataz', 'apps/fazenda/gerente', 'apps/fazenda/escritorio', 'apps/fazenda/fabrica', 'packages', 'api']) result[target] = await inventory(resolve(root, target));
  for (const target of ['qa/scripts/t06-admin-pwa-e2e.ts', 'qa/scripts/persistent-profile-path.mjs', 'qa/scripts/serve-production-t03.ts']) result[target] = digest(await readFile(resolve(root, target)));
  return result;
}
async function gitState() {
  const read = async (args: string[]) => {
    const child = Bun.spawn(['git', '-c', `safe.directory=${resolve(root, '..').replaceAll('\\', '/')}`, ...args], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    assert.equal(code, 0, stderr); return stdout.trim();
  };
  return { commit: await read(['rev-parse', 'HEAD']), dirtyState: await read(['status', '--short', '--untracked-files=all']), diffSha256: digest(await read(['diff', '--binary'])) };
}
async function until(read: () => Promise<any>, accept: (value: any) => boolean, label: string, timeout = 30000): Promise<any> {
  const end = Date.now() + timeout;
  do {
    try { const value = await read(); if (accept(value)) return value; }
    catch (error) { if (!(error instanceof Error) || !error.message.includes('Execution context was destroyed')) throw error; }
    await Bun.sleep(100);
  } while (Date.now() < end);
  throw new Error(`Timed out: ${label}`);
}
async function storage(page: any) {
  return page.evaluate(async () => {
    const cache: Record<string, any[]> = {};
    for (const name of (await caches.keys()).sort()) {
      const store = await caches.open(name); cache[name] = [];
      for (const request of [...await store.keys()].sort((a, b) => a.url.localeCompare(b.url))) {
        const response = (await store.match(request))!;
        const bytes = await response.arrayBuffer();
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
        cache[name]!.push({ url: request.url, bytes: bytes.byteLength, hash });
      }
    }
    const databases: Record<string, any> = {};
    for (const item of await indexedDB.databases()) {
      const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(item.name!); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      databases[item.name!] = {};
      for (const name of Array.from(db.objectStoreNames)) databases[item.name!][name] = await new Promise((resolve, reject) => {
        const tx = db.transaction(name, 'readonly'), request = tx.objectStore(name).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      db.close();
    }
    return { cache, databases, localStorage: { ...localStorage }, workers: (await navigator.serviceWorker.getRegistrations()).map(r => ({ scope: r.scope, active: r.active?.scriptURL })).sort((a, b) => a.scope.localeCompare(b.scope)) };
  });
}
async function pointer(page: any) {
  return page.evaluate(async () => { const response = await (await caches.open('consubov-adm-candidate-state')).match(location.origin + '/__adm_release_state__'); return response ? response.json() : null; });
}
async function message(page: any, target: 'waiting' | 'active', payload: object) {
  return page.evaluate(async ({ target, payload }: any) => {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const worker = registration?.[target as 'waiting' | 'active']; if (!worker) throw new Error('Worker not available: ' + target);
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel(), timer = setTimeout(() => reject(new Error('Worker protocol timed out')), 15000);
      channel.port1.onmessage = event => { clearTimeout(timer); resolve(event.data); };
      worker.postMessage(payload, [channel.port2]);
    });
  }, { target, payload });
}

await mkdir(runDir, { recursive: true }); await mkdir(owned, { recursive: true });
const initial = await sources(), initialGit = await gitState();
let serving = resolve(owned, 'n'), broken: string | null = null, corrupt = false, apiDown = false, deny = 0;
const api = createRouter(new InMemoryLedger());
const adm = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
  const url = new URL(request.url); requests.push({ origin: 'adm', path: url.pathname, method: request.method });
  if (url.pathname.startsWith('/api/')) {
    if (apiDown) return new Response('{}', { status: 503, headers });
    if (deny && url.pathname.endsWith('/audit')) return new Response('{}', { status: deny, headers });
    const response = await api(request); for (const [key, value] of Object.entries(headers)) response.headers.set(key, value); return response;
  }
  const name = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  if (!/^[\w./-]+$/.test(name) || name.split('/').includes('..')) return new Response('Bad path', { status: 400, headers });
  if (broken && url.pathname === broken) return new Response(corrupt ? 'corrupted immutable bytes' : 'Incomplete candidate package', { status: corrupt ? 200 : 404, headers: { ...headers, 'Content-Type': 'text/javascript' } });
  try { const bytes = await readFile(resolve(serving, name)); return new Response(bytes, { headers: { ...headers, 'Content-Type': mime[extname(name)] ?? 'application/octet-stream', ...(name === 'sw.js' ? { 'Service-Worker-Allowed': '/' } : {}) } }); }
  catch { return new Response('Not found', { status: 404, headers }); }
} });
const admOrigin = `http://127.0.0.1:${adm.port}`;
const fazendaRoot = process.env.CONSUBOV_T06_FAZENDA_ROOT ?? resolve(owned, 'fazendas-shell');
const moduleRoot = process.env.CONSUBOV_T06_MODULE_ROOT ?? resolve(owned, 'fazendas-modules');
const fazendaHandler = fazendaRoot ? createProductionHandler({ shellRoot: fazendaRoot, moduleRoot }) : null;
let freezeFazendaApi = false;
const fazenda = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
  if (freezeFazendaApi && new URL(request.url).pathname.startsWith('/api/')) return Response.json({ error: 'QA_BASELINE_NETWORK_FROZEN' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return fazendaHandler ? fazendaHandler(request) : new Response('<!doctype html><title>Fazendas origin storage sentinel</title>', { headers: { 'Content-Type': 'text/html' } });
} });
const fazendaOrigin = `http://127.0.0.1:${fazenda.port}`;
let paths: any, failure: unknown, fazendaArtifactBefore: unknown, fazendaArtifactAfter: unknown;
try {
  for (const args of [[process.execPath, 'test', 'apps/admin-global/src/secure/admin-service.test.ts'], [process.execPath, 'run', 'typecheck']]) {
    const child = Bun.spawn(args, { cwd: root, stdout: 'pipe', stderr: 'pipe' });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    output.push(`$ ${args.join(' ')}\n${stdout}\n${stderr}`); assert.equal(code, 0, stderr);
    results.push({ command: args.slice(1), exitCode: code });
  }
  if (!process.env.CONSUBOV_T06_FAZENDA_ROOT) {
    log('Preparing one isolated Fazendas baseline before the ADM invariance window');
    for (const [args, cwd, env] of [
      [[process.execPath, 'run', 'apps/fazenda/shell/scripts/build-module-artifacts.ts'], root, { CONSUBOV_MODULE_OUTPUT_ROOT: moduleRoot }],
      [[process.execPath, 'run', 'vite', 'build', '--outDir', fazendaRoot], resolve(root, 'apps/fazenda/shell'), {}]
    ] as [string[], string, Record<string, string>][]) {
      const child = Bun.spawn(args, { cwd, env: { ...process.env, ...env }, stdout: 'pipe', stderr: 'pipe' });
      const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
      output.push(`$ ${args.join(' ')}\n${stdout}\n${stderr}`); assert.equal(code, 0, stderr);
    }
  }
  fazendaArtifactBefore = { shell: await inventory(fazendaRoot), modules: await inventory(moduleRoot) };
  const { build } = await import(pathToFileURL(resolve(root, 'apps/admin-global/node_modules/vite/dist/node/index.js')).href);
  const builds: Record<string, any> = {};
  for (const [name, version, mode] of [['n', '0.1.0-qa-n', 'candidate'], ['n1', '0.1.0-qa-n1', 'candidate'], ['n2', '0.1.0-qa-n2', 'candidate'], ['lab', '0.1.0-qa-lab', 'lab']]) {
    process.env.CONSUBOV_ADM_ORIGIN = admOrigin; process.env.CONSUBOV_ADM_VERSION = version;
    const graph: string[] = [];
    await build({ root: resolve(root, 'apps/admin-global'), configFile: resolve(root, 'apps/admin-global/vite.config.ts'), mode,
      build: { outDir: resolve(owned, name!), emptyOutDir: false },
      plugins: [{ name: 't06-actual-module-graph', generateBundle(_options: any, bundle: any) { for (const chunk of Object.values(bundle) as any[]) if (chunk.type === 'chunk') graph.push(...Object.keys(chunk.modules)); } }] });
    const directory = resolve(owned, name!), files = await inventory(directory);
    const markers = ['admin.lab@consubov.local', 'suporte.lab@consubov.local', 'financeiro.lab@consubov.local', 'lab@123456', 'consubov-lab-secret-hmac-sha256-isolated-f23-key-synthetic', 'LAB_MFA_CODE', 'SYNTHETIC_ADMIN_USERS', 'SYNTHETIC_JWT_SECRET_LAB', 'super_admin', 'support_admin', 'financial_admin'];
    const contaminated: any[] = [];
    for (const file of Object.keys(files)) {
      const content = await readFile(resolve(directory, file), 'utf8');
      for (const marker of markers) if (content.includes(marker)) contaminated.push({ file, marker });
    }
    const forbiddenGraph = graph.filter(file => /(?:\/auth\/|\/store\/adminStore|\/App\.tsx|packages\/auth-client|packages\/contracts\/src\/index)/.test(file.replaceAll('\\', '/')));
    if (mode === 'candidate') { assert.deepEqual(contaminated, []); assert.deepEqual(forbiddenGraph, []); }
    else assert(contaminated.length > 0 && forbiddenGraph.length > 0, 'Lab control must expose the excluded legacy graph and markers');
    const selector = JSON.parse(await readFile(resolve(directory, 'admin-release.json'), 'utf8'));
    const release = JSON.parse(await readFile(resolve(directory, selector.manifestUrl.slice(1)), 'utf8'));
    for (const asset of release.assets) { const bytes = await readFile(resolve(directory, asset.url.slice(1))); assert.equal(bytes.length, asset.bytes); assert.equal(digest(bytes), asset.sha256); }
    const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.webmanifest'), 'utf8'));
    assert.equal(manifest.display, 'standalone'); assert.equal(manifest.scope, '/');
    for (const size of [192, 512]) {
      const icon = manifest.icons.find((item: any) => item.sizes === `${size}x${size}`); assert(icon);
      const png = await readFile(resolve(directory, icon.src.replace(/^\//, '')));
      assert.equal(png.subarray(1, 4).toString(), 'PNG'); assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
    }
    builds[name!] = { graph: [...new Set(graph)].map(file => relative(root, file)), files, contaminated, selector, manifest };
  }
  await writeFile(resolve(runDir, 'artifact-inventory.json'), JSON.stringify(builds, null, 2));
  const { chromium, webkit } = await import(pathToFileURL(resolve(root, 'packages/local-data/node_modules/@playwright/test/index.mjs')).href);
  const { createPersistentProfilePaths } = await import(pathToFileURL(resolve(import.meta.dir, 'persistent-profile-path.mjs')).href);
  paths = await createPersistentProfilePaths(owned);
  for (const [engine, browser] of [['chromium', chromium], ['webkit', webkit]] as const) {
    log(`Starting ${engine}: ${admOrigin}, independent Fazendas origin ${fazendaOrigin}`);
    serving = resolve(owned, 'n'); broken = null; apiDown = false; deny = 0; freezeFazendaApi = false;
    const context = await browser.launchPersistentContext(paths.browserPath(resolve(owned, engine)), { headless: true, serviceWorkers: 'allow' });
    try {
      await context.route('**/*', async (route: any) => {
        const url = new URL(route.request().url());
        if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort('blockedbyclient');
        return route.continue();
      });
      const farm = await context.newPage(); let page = await context.newPage();
      const traffic: string[] = [], errors: string[] = [];
      page.on('request', (request: any) => traffic.push(request.url())); page.on('pageerror', (error: Error) => errors.push(error.message));
      await farm.goto(fazendaOrigin + '/#/fazenda/capataz');
      await farm.locator('#login-email').fill('capataz.lab@consubov.local');
      await farm.locator('#login-password').fill('lab@123456');
      await farm.getByRole('button', { name: /Entrar no Sistema/i }).click();
      const farmContext = farm.getByRole('button', { name: /Acessar Este Contexto/i }), farmFrame = farm.frameLocator('iframe');
      await Promise.race([farmContext.waitFor({ state: 'visible', timeout: 45000 }), farmFrame.locator('#cocho-input-notes').waitFor({ state: 'visible', timeout: 45000 })]);
      if (await farmContext.isVisible()) await farmContext.click();
      await farmFrame.locator('#cocho-input-notes').waitFor({ state: 'visible', timeout: 45000 });
      await until(() => farm.evaluate(async () => (await navigator.serviceWorker.getRegistration('/'))?.active?.state), state => state === 'activated', 'Fazendas active worker');
      // Browser routing cannot intercept fetches issued by a service worker.
      // Freeze this owned API server after provisioning and drain pending writes.
      freezeFazendaApi = true;
      await farm.route('**/api/**', (route: any) => route.abort('internetdisconnected'));
      await farm.evaluate(async () => {
        localStorage.setItem('t06-fazendas-sentinel', 'preserve');
        await (await caches.open('t06-fazendas-preserve')).put('/t06-sentinel', new Response('Fazendas durable shell sentinel'));
        const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('t06-fazendas-preserve', 1); r.onupgradeneeded = () => r.result.createObjectStore('records'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
        await new Promise<void>((resolve, reject) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').put({ preserved: true }, 'sentinel'); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
      });
      // This origin sentinel is intentionally separate from operational acceptance.
      let lastFarm = '', stableCount = 0;
      const farmBefore = await until(() => storage(farm), value => {
        const encoded = JSON.stringify(value); stableCount = encoded === lastFarm ? stableCount + 1 : 0; lastFarm = encoded; return stableCount >= 5;
      }, 'Fazendas durable baseline settled after owned API freeze');
      await page.addInitScript(() => { localStorage.setItem('consubov:admin-session', JSON.stringify({ token: 'forged', user: { role: 'super_admin' }, mfa_verified: true })); });
      const response = await page.goto(admOrigin); const responseHeaders = await response.allHeaders();
      for (const [key, value] of Object.entries(headers)) assert.equal(responseHeaders[key.toLowerCase()], value);
      await until(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration('/'))?.active?.state), state => state === 'activated', 'ADM first active worker');
      await page.reload();
      await until(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL), Boolean, 'ADM first controller');
      assert.equal((await pointer(page)).active.generation, builds.n.selector.generation);
      await page.locator('input[type=email]').waitFor();
      assert.equal(await page.locator('input[type=password]').inputValue(), '');
      assert(!/Tenants|Super Administrador|Licenças/.test(await page.locator('body').innerText()));
      if (engine === 'chromium') {
        const cdp = await context.newCDPSession(page);
        const manifestControl = await cdp.send('Page.getAppManifest'), installabilityControl = await cdp.send('Page.getInstallabilityErrors');
        assert.equal(manifestControl.url, admOrigin + '/manifest.webmanifest'); assert.deepEqual(manifestControl.errors, []);
        results.push({ engine, manifestControl, installabilityControl, actualOSInstallation: 'NAO_EXECUTADO' }); await cdp.detach();
      }
      // Real API login, explicit membership, then server-authorized read-only audit.
      await page.locator('input[type=email]').fill('capataz.lab@consubov.local'); await page.locator('input[type=password]').fill('lab@123456');
      await page.locator('form button[type=submit]').click();
      await page.getByRole('alert').filter({ hasText: /não autorizado/i }).waitFor(); assert.equal(await page.locator('[data-testid=admin-audit]').count(), 0);
      await page.locator('input[type=email]').fill('admin.lab@consubov.local'); await page.locator('input[type=password]').fill('lab@123456');
      await page.locator('form button[type=submit]').click();
      const contextButton = page.getByRole('button', { name: /Acessar|Selecionar|Usar/i }).first();
      await contextButton.waitFor(); await contextButton.click();
      await page.getByRole('button', { name: /Atualizar consulta/i }).waitFor();
      const authorized = await storage(page); assert.equal(Object.keys(authorized.databases).length, 0);
      assert(!JSON.stringify(authorized).includes('lab@123456')); assert(!JSON.stringify(authorized.cache).includes('/api/'));
      deny = 403; await page.getByRole('button', { name: /Atualizar consulta/i }).click();
      await page.locator('input[type=password]').waitFor(); deny = 0;
      await context.setOffline(true); await page.reload(); await page.locator('input[type=password]').waitFor();
      assert(!/Tenants|Super Administrador|Licenças/.test(await page.locator('body').innerText())); await context.setOffline(false);
      const n = await pointer(page);
      serving = resolve(owned, 'n1');
      await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration('/'))!.update(); });
      await until(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration('/'))?.waiting)), Boolean, 'N+1 waiting');
      assert.equal((await pointer(page)).active.generation, n.active.generation, 'Waiting update must preserve durable active N');
      const verified: any = await message(page, 'waiting', { type: 'ADM_VERIFY_UPDATE' });
      assert.equal(verified.generation, builds.n1.selector.generation); assert.equal(verified.canActivate, true);
      const rejected: any = await message(page, 'waiting', { type: 'ADM_ACTIVATE_WITH_CONSENT', generation: 'forged', scriptURL: verified.scriptURL, clientDeadline: Date.now() + 30000 });
      assert.equal(rejected.accepted, false); assert.equal((await pointer(page)).active.generation, n.active.generation);
      const expired: any = await message(page, 'waiting', { type: 'ADM_ACTIVATE_WITH_CONSENT', generation: verified.generation, scriptURL: verified.scriptURL, clientDeadline: Date.now() - 1 });
      assert.equal(expired.accepted, false);
      // With no ADM clients the browser activates the installed worker itself.
      // A cold navigation still must serve durable N until a fresh user click.
      await page.close(); await Bun.sleep(300); page = await context.newPage();
      page.on('request', (request: any) => traffic.push(request.url())); page.on('pageerror', (error: Error) => errors.push(error.message));
      await page.goto(admOrigin);
      await until(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration('/'))?.active)), Boolean, 'cold active ADM worker');
      await until(() => message(page, 'active', { type: 'ADM_VERIFY_UPDATE' }), value => value.generation === builds.n1.selector.generation, 'cold browser activated candidate worker');
      assert.equal((await pointer(page)).active.generation, builds.n.selector.generation, 'Cold browser lifecycle is not consent');
      const other = await context.newPage(); await other.goto(admOrigin);
      const blocked: any = await message(page, 'active', { type: 'ADM_ACTIVATE_WITH_CONSENT', generation: verified.generation, scriptURL: verified.scriptURL, clientDeadline: Date.now() + 30000 });
      assert.equal(blocked.accepted, false); await other.close();
      await page.getByRole('button', { name: /Instalar atualização/i }).waitFor();
      await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.getByRole('button', { name: /Instalar atualização/i }).click()]);
      await until(() => pointer(page), p => p.active.generation === builds.n1.selector.generation, 'consented N+1 pointer');
      await page.reload();
      const n1 = await pointer(page); assert.equal(n1.previous.generation, builds.n.selector.generation);
      // A package with one missing immutable resource cannot replace N+1.
      serving = resolve(owned, 'n2');
      const n2 = JSON.parse(await readFile(resolve(serving, builds.n2.selector.manifestUrl.slice(1)), 'utf8'));
      broken = n2.assets.find((item: any) => item.path.endsWith('.js')).url;
      const priorMissingAttempts = requests.filter(item => item.path === broken).length;
      await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration('/'))!.update(); });
      await until(async () => requests.filter(item => item.path === broken).length, count => count > priorMissingAttempts, 'broken candidate asset requested');
      await until(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration('/'))?.installing?.state ?? 'none'), state => state === 'none' || state === 'redundant', 'broken candidate rejected');
      assert.equal((await pointer(page)).active.generation, n1.active.generation);
      const attempts = requests.filter(item => item.path === broken).length; corrupt = true;
      await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration('/'))!.update(); });
      await until(async () => requests.filter(item => item.path === broken).length, count => count > attempts, 'corrupt candidate asset requested');
      await until(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration('/'))?.installing?.state ?? 'none'), state => state === 'none' || state === 'redundant', 'corrupt candidate rejected');
      assert.equal((await pointer(page)).active.generation, n1.active.generation); corrupt = false;
      await context.setOffline(true); await page.reload(); await page.locator('input[type=password]').waitFor(); await context.setOffline(false);
      await page.screenshot({ path: resolve(runDir, `${engine}-adm-safe-shell.png`), fullPage: true });
      const after = await storage(page), farmAfter = await storage(farm);
      results.push({ engine, checkpoint: 'cross-origin-storage', farmBefore, farmAfter, frozenFazendaApi: true });
      assert.deepEqual(farmAfter, farmBefore, 'ADM lifecycle must not change other origin storage');
      assert.deepEqual(after.cache[`consubov-adm-candidate-release-${builds.n.selector.generation}`], authorized.cache[`consubov-adm-candidate-release-${builds.n.selector.generation}`], 'N immutable cached package must survive N+1 and rejected N+2');
      assert(after.cache[`consubov-adm-candidate-release-${builds.n1.selector.generation}`]?.length, 'Consented N+1 package retained');
      assert(Object.keys(after.cache).every(name => name.startsWith('consubov-adm-candidate-')));
      assert(!JSON.stringify(after.cache).includes('/api/')); assert(traffic.every(url => new URL(url).origin === admOrigin));
      assert.deepEqual(errors, []);
      results.push({ engine, status: 'PASS', forgedPersistenceIgnored: true, realRouterAdminAudit: true, online403ClearsSession: true,
        offlineShell: true, consentUpdate: true, coldStartNotConsent: true, expiredOrForgedConsentRejected: true, otherWindowBlocksActivation: true, previousPreserved: true, incompleteUpdateRejected: true, corruptUpdateRejected: true,
        isolatedFazendaOriginUnchanged: true, fazendaScope: fazendaRoot ? 'existing frozen shell plus real browser durable sentinels' : 'origin storage sentinel only; no Fazendas operational acceptance',
        farmBefore, adminAfter: after, requestPaths: traffic.map(url => new URL(url).pathname), physicalInstallation: 'NAO_EXECUTADO' });
      log(`${engine}: browser controls passed`);
    } finally { await context.close(); }
  }
} catch (error) { failure = error; log(error instanceof Error ? error.stack ?? error.message : String(error)); }
finally {
  adm.stop(true); fazenda.stop(true); if (paths) await paths.dispose();
  const final = await sources(), finalGit = await gitState(); const sourceUnchanged = JSON.stringify(initial) === JSON.stringify(final) && initialGit.commit === finalGit.commit;
  if (fazendaArtifactBefore) { fazendaArtifactAfter = { shell: await inventory(fazendaRoot), modules: await inventory(moduleRoot) }; if (JSON.stringify(fazendaArtifactBefore) !== JSON.stringify(fazendaArtifactAfter)) failure ??= new Error('Fazendas artifacts changed during ADM builds/lifecycle'); }
  const report = { runId, initialCommit: initialGit.commit, finalCommit: finalGit.commit, initialGit, finalGit,
    dirty: true, sourceRevision: 'uncommitted worktree; initial/final complete source hash manifests are the tested revision',
    commitScope: 'Read-only Git metadata and complete source hash inventory identify the current dirty/untracked revision. No acceptance.',
    sourceUnchanged, initialSources: initial, finalSources: final, fazendaArtifactBefore, fazendaArtifactAfter, admOrigin, fazendaOrigin, owned, results, requests,
    status: failure || !sourceUnchanged ? 'FAIL' : 'PASS_LOCAL_CONTROLS_ONLY', error: failure instanceof Error ? failure.stack : failure ? String(failure) : null,
    acceptance: false, limitations: ['No production deployment', 'No physical OS installation', 'No MFA endpoint exists', 'Process-local laboratory API and grants; no real backend', ...(fazendaRoot ? [] : ['Fazendas operational shell not supplied; origin sentinel only'])] };
  await writeFile(resolve(runDir, 'result.json'), JSON.stringify(report, null, 2)); await writeFile(resolve(runDir, 'output.log'), output.join('\n') + '\n');
  log(`Evidence: ${runDir}`); if (failure || !sourceUnchanged) process.exitCode = 1;
}
