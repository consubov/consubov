import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { connect } from 'node:net';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, symlink, unlink, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = fileURLToPath(new URL('../../', import.meta.url));
const helperURL = new URL('../qa/run-lighthouse-local.mjs', import.meta.url);
const requireWeb = createRequire(join(root, 'apps/web/package.json'));
const { chromium } = requireWeb('@playwright/test');
async function helper() {
  assert.ok(existsSync(helperURL), 'contained local Lighthouse runner must exist');
  return import(helperURL);
}
async function output() {
  const parent = join(root, '.qa/fixtures/lighthouse');
  await mkdir(parent, { recursive: true });
  return mkdtemp(join(parent, 'run-'));
}
async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return `http://127.0.0.1:${server.address().port}`;
}
async function close(server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }

test('unsafe targets are refused before browser/proxy/profile creation', async () => {
  const { launchLocalAuditBrowser } = await helper();
  for (const baseURL of ['https://example.invalid', 'http://user:pass@127.0.0.1:8080', 'http://127.0.0.1:8080/path']) {
    const outputDir = join(await output(), 'not-created');
    await assert.rejects(launchLocalAuditBrowser({ baseURL, outputDir }), /local HTTP origin/i);
    assert.equal(existsSync(outputDir), false);
  }
});

for (const entrypoint of ['launchLocalAuditBrowser', 'runLocalLighthouse']) {
  test(`output junction escape causes no outside writes: ${entrypoint}`, async t => {
    const outside = await mkdtemp(join(tmpdir(), 'consubov-lighthouse-boundary-'));
    const alias = join(await output(), 'outside-alias');
    await symlink(outside, alias, process.platform === 'win32' ? 'junction' : 'dir');
    t.after(async () => {
      await unlink(alias);
      assert.equal(dirname(resolve(outside)), resolve(tmpdir()), 'recursive cleanup is restricted to the own directly-created TEMP fixture');
      await rm(outside, { recursive: true, force: true });
    });
    const api = await helper();
    await assert.rejects(api[entrypoint]({ baseURL: 'http://127.0.0.1:1', outputDir: join(alias, 'new-dir'), runs: 1 }), /output|symlink|outside/i);
    assert.deepEqual(await readdir(outside), [], 'reject escaping ancestors BEFORE mkdir, profile or session creation');
  });
}

test('owned Chrome proxy contains HTTP/image/redirect/worker/HTTPS to one app origin', async t => {
  const { launchLocalAuditBrowser } = await helper();
  let sentinelHits = 0;
  const sentinel = createServer((_req, res) => { sentinelHits++; res.end('must never be contacted'); });
  const other = await listen(sentinel);
  const html = `<!doctype html><html lang="en"><head><title>Proxy fixture</title></head><body><main><h1>Proxy fixture</h1><p>Allowed local page.</p></main><script>
  const image = new Promise(resolve=>{const img=new Image();img.onload=img.onerror=resolve;img.src=${JSON.stringify(other + '/image')};document.body.append(img);});
  const worker = new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('worker fixture timeout')),8000);navigator.serviceWorker.addEventListener('message',()=>{clearTimeout(timer);resolve();},{once:true});navigator.serviceWorker.register('/worker.js').catch(reject);});
  Promise.allSettled([image,worker,fetch(${JSON.stringify(other + '/fetch')}).catch(()=>{}),fetch('/redirect').catch(()=>{}),fetch(${JSON.stringify(other.replace('http:', 'https:') + '/connect')}).catch(()=>{})]).then(results=>{window.fixtureResults=results.map(r=>r.status);window.fixtureDone=true;});
  </script></body></html>`;
  const app = createServer((req, res) => {
    if (req.url === '/redirect') { res.writeHead(302, { location: other + '/redirected' }); res.end(); }
    else if (req.url === '/worker.js') {
      res.setHeader('content-type', 'application/javascript');
      res.end(`self.addEventListener('install',event=>event.waitUntil(fetch(${JSON.stringify(other + '/worker')}).catch(()=>{}).then(async()=>{for(const client of await clients.matchAll({includeUncontrolled:true}))client.postMessage('worker-done');await self.skipWaiting();})));`);
    } else { res.setHeader('content-type', 'text/html'); res.end(html); }
  });
  const baseURL = await listen(app);
  t.after(async () => { await close(app); await close(sentinel); });
  const owned = await launchLocalAuditBrowser({ baseURL, outputDir: await output() });
  t.after(() => owned.close());
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${owned.chrome.port}`);
  const page = await browser.contexts()[0].newPage();
  assert.equal((await page.goto(baseURL)).status(), 200);
  await page.waitForFunction(() => window.fixtureDone, { timeout: 15_000 });
  assert.deepEqual(await page.evaluate(() => window.fixtureResults), ['fulfilled', 'fulfilled', 'fulfilled', 'fulfilled', 'fulfilled']);
  assert.equal(sentinelHits, 0, 'no denied origin can receive HTTP/TLS from Chrome');
  assert.ok(owned.proxy.counts.allowed >= 3);
  assert.ok(owned.proxy.counts.deniedHttp >= 4);
  assert.ok(owned.proxy.counts.deniedConnect > 0);
  await owned.close();
  assert.throws(() => process.kill(owned.chrome.pid, 0), { code: 'ESRCH' });
  assert.equal(existsSync(owned.profile), false, 'only fresh owned profile is removed after Chrome stops');
  assert.equal(app.listening, true);
  assert.equal(sentinel.listening, true);
});

test('real installed Lighthouse keeps genuine reports with contained network and provenance', async t => {
  const { runLocalLighthouse, validateLighthouseReport } = await helper();
  let sentinelHits = 0;
  const sentinel = createServer((_req, res) => { sentinelHits++; res.end('denied'); });
  const other = await listen(sentinel);
  const app = createServer((_req, res) => { res.setHeader('content-type', 'text/html'); res.end(`<!doctype html><html lang="en"><head><title>Local Lighthouse fixture</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main><h1>Local fixture</h1><p>This is a synthetic network fixture.</p><button>Continue</button></main><script>fetch(${JSON.stringify(other + '/request')}).catch(()=>{});</script></body></html>`); });
  const baseURL = await listen(app);
  t.after(async () => { await close(app); await close(sentinel); });
  const outputDir = await output();
  const measured = await runLocalLighthouse({ baseURL, outputDir, runs: 1 });
  assert.equal(measured.status, 'MEASURED');
  assert.equal(measured.applicationAcceptance, false);
  assert.equal(measured.runs.length, 2);
  assert.equal(sentinelHits, 0);
  for (const run of measured.runs) {
    const raw = JSON.parse(await readFile(join(outputDir, run.report), 'utf8'));
    assert.equal(raw.lighthouseVersion, '13.5.0');
    assert.equal(raw.requestedUrl, baseURL + (run.page === 'home' ? '/' : '/login'));
    assert.equal(raw.runtimeError, undefined);
    assert.match(run.browserVersion, /Chrome\/\d+\.\d+\.\d+\.\d+/);
    assert.equal(run.profileMarkerVerified, true);
    assert.ok(run.network.deniedHttp > 0);
    assert.ok(Number.isFinite(run.metrics.lcpMs));
    assert.ok(Number.isFinite(run.metrics.cls));
    assert.ok(Number.isFinite(run.metrics.tbtMs));
    assert.throws(() => process.kill(run.browserPid, 0), { code: 'ESRCH' });
    for (const mutate of [
      report => { report.runtimeError = { code: 'FIXTURE_ERROR' }; },
      report => { report.requestedUrl = other + '/wrong'; },
      report => { report.finalDisplayedUrl = baseURL + '/wrong'; },
      report => { report.lighthouseVersion = '0.0.0'; },
      report => { report.categories.performance.score = '1'; },
      report => { report.categories.accessibility.score = 1.5; },
      report => { report.audits['largest-contentful-paint'].numericValue = -1; },
      report => { report.audits['total-blocking-time'].numericValue = null; },
      report => { report.audits['cumulative-layout-shift'].errorMessage = 'fixture'; },
      report => { report.configSettings.disableStorageReset = true; },
      report => { report.configSettings.throttlingMethod = 'provided'; },
      report => { delete report.environment; },
    ]) {
      const invalid = structuredClone(raw); mutate(invalid);
      assert.throws(() => validateLighthouseReport(invalid, raw.requestedUrl, '13.5.0'), /Invalid|Unexpected|Incomplete|failed/i);
    }
  }
});

test('proxy bounds a hanging allowed request and refuses CONNECT without upstream', async t => {
  const { createLocalAuditProxy } = await helper();
  const app = createServer(() => {});
  const baseURL = await listen(app);
  t.after(() => close(app));
  const proxy = await createLocalAuditProxy(baseURL, { requestTimeoutMs: 100 });
  t.after(() => proxy.close());
  const response = await new Promise((resolve, reject) => {
    const req = request(proxy.url, { path: baseURL + '/', timeout: 3000 }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject); req.end();
  });
  assert.equal(response, 504);
  assert.equal(proxy.counts.timeouts, 1);
  const status = await new Promise((resolve, reject) => {
    const req = request(proxy.url, { method: 'CONNECT', path: '127.0.0.1:1' });
    req.on('connect', (res, socket) => { socket.destroy(); resolve(res.statusCode); }); req.on('error', reject); req.end();
  });
  assert.equal(status, 403);
  assert.equal(proxy.counts.deniedConnect, 1);
});

test('a peer resetting a refused CONNECT is handled locally without contacting upstream', async t => {
  const { createLocalAuditProxy } = await helper();
  const app = createServer((_req, res) => res.end('allowed fixture'));
  const baseURL = await listen(app);
  t.after(() => close(app));
  const proxy = await createLocalAuditProxy(baseURL);
  t.after(() => proxy.close());
  const port = Number(new URL(proxy.url).port);
  for (let index = 0; index < 50; index++) {
    await new Promise((resolvePeer, reject) => {
      const socket = connect(port, '127.0.0.1');
      socket.on('error', reject);
      socket.once('connect', () => socket.write('CONNECT 127.0.0.1:1 HTTP/1.1\r\nHost: 127.0.0.1:1\r\n\r\n'));
      socket.once('data', () => { socket.resetAndDestroy(); resolvePeer(); });
    });
  }
  assert.equal(proxy.counts.deniedConnect, 50);
  assert.equal(proxy.counts.allowed, 0);
  assert.ok(proxy.counts.peerResets > 0, 'expected transport reset is recorded by the owned proxy');
  assert.equal(proxy.counts.errors, 0);
});

test('an allowed upstream resetting its response becomes a counted failure, never uncaught', async t => {
  const { createLocalAuditProxy } = await helper();
  const app = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain', 'content-length': '1000' }); res.write('partial');
    setTimeout(() => res.socket?.resetAndDestroy(), 20);
  });
  const baseURL = await listen(app); t.after(() => close(app));
  const proxy = await createLocalAuditProxy(baseURL); t.after(() => proxy.close());
  const failure = await new Promise((resolveFailure, reject) => {
    const req = request(proxy.url, { path: baseURL + '/', timeout: 3000 }, res => {
      res.on('error', error => resolveFailure(error.code)); res.on('end', () => reject(new Error('reset body cannot complete'))); res.resume();
    });
    req.on('timeout', () => req.destroy(new Error('fixture timeout'))); req.on('error', error => resolveFailure(error.code)); req.end();
  });
  assert.equal(failure, 'ECONNRESET');
  assert.ok(proxy.counts.errors > 0, 'upstream response errors must fail an eventual measurement');
  assert.equal(app.listening, true);
});

test('malformed proxy HTTP is refused and counted without exposing parse buffers', async t => {
  const { createLocalAuditProxy } = await helper();
  const app = createServer((_req, res) => res.end('must not be called'));
  const baseURL = await listen(app); t.after(() => close(app));
  const proxy = await createLocalAuditProxy(baseURL); t.after(() => proxy.close());
  const response = await new Promise((resolveResponse, reject) => {
    const socket = connect(Number(new URL(proxy.url).port), '127.0.0.1');
    socket.on('error', reject); socket.once('connect', () => socket.write('INVALID REQUEST\r\n\r\n'));
    socket.once('data', data => { socket.destroy(); resolveResponse(data.toString()); });
  });
  assert.match(response, /^HTTP\/1\.1 400/);
  assert.equal(proxy.counts.allowed, 0);
  assert.ok(proxy.counts.errors > 0);
});

test('Windows native transient profile lock is released after Chrome stops and own close completes', { timeout: 45_000 }, async t => {
  assert.equal(process.platform, 'win32', 'this native FileShare.None regression requires Windows; never skip it as PASS');
  const { spawn } = await import('node:child_process');
  const { writeFile } = await import('node:fs/promises');
  const { launchLocalAuditBrowser } = await helper();
  const app = createServer((_req, res) => res.end('synthetic cleanup fixture'));
  const baseURL = await listen(app);
  const outputDir = await output();
  let owned;
  let holder;
  let holderExit;
  let releaseTimer;
  let chromeStopped = false;
  let readyPid;
  let helperReleased = false;
  const boundedFixture = async (promise, label) => {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label + ' timeout')), 10_000); })]); }
    finally { clearTimeout(timer); }
  };
  const releaseHolder = () => {
    if (holder && !holder.stdin.destroyed && !holder.stdin.writableEnded) holder.stdin.end('release\n');
  };
  try {
    owned = await launchLocalAuditBrowser({ baseURL, outputDir });
    assert.equal(dirname(resolve(owned.profile)), resolve(outputDir), 'fixture profile must be the exact own direct child');
    const lockPath = join(owned.profile, '000-owned-transient-lock.fixture');
    const scriptPath = join(outputDir, 'owned-native-lock.ps1');
    await writeFile(scriptPath, `param([Parameter(Mandatory=$true)][string]$LiteralPath)
$ErrorActionPreference='Stop'
$fixtureLock=[System.IO.File]::Open($LiteralPath,[System.IO.FileMode]::OpenOrCreate,[System.IO.FileAccess]::ReadWrite,[System.IO.FileShare]::None)
try {
  [Console]::Out.WriteLine("OWN_LOCK_READY:$PID")
  [Console]::Out.Flush()
  if ([Console]::ReadLine() -ne 'release') { throw 'Own helper requires explicit release' }
} finally {
  $fixtureLock.Dispose()
  [Console]::Out.WriteLine("OWN_LOCK_RELEASED:$PID")
  [Console]::Out.Flush()
}
`, { flag: 'wx' });
    holder = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-LiteralPath', lockPath], {
      stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
    });
    holderExit = new Promise((resolveExit, reject) => { holder.once('error', reject); holder.once('close', (code, signal) => resolveExit({ code, signal })); });
    holder.stdin.on('error', () => {}); // A failed helper is reported by its own exit/readiness promise.
    holder.stderr.resume();
    let stdout = '';
    const ready = new Promise(resolveReady => holder.stdout.on('data', chunk => {
      stdout += chunk.toString();
      const marker = stdout.match(/OWN_LOCK_READY:(\d+)/);
      if (marker) resolveReady(Number(marker[1]));
      if (stdout.includes(`OWN_LOCK_RELEASED:${holder.pid}`)) helperReleased = true;
    }));
    readyPid = await boundedFixture(Promise.race([ready, holderExit.then(() => { throw new Error('Native helper exited before FileShare.None readiness'); })]), 'Own lock readiness');
    assert.equal(readyPid, holder.pid, 'readiness must come from the exact spawned native helper PID');
    assert.equal(existsSync(lockPath), true);
    owned.chrome.process.once('close', () => {
      chromeStopped = true;
      // A deliberate transient native fault, released inside the bounded rm retry window.
      releaseTimer = setTimeout(releaseHolder, 600);
    });
    const result = await owned.close().then(() => ({ error: null }), error => ({ error: { name: error.name, code: error.code } }));
    const exit = await boundedFixture(holderExit, 'Own helper release');
    t.diagnostic(JSON.stringify({ chromePid: owned.chrome.pid, helperPid: readyPid, chromeStopped, helperReleased, helperExitCode: exit.code, closeError: result.error }));
    assert.equal(chromeStopped, true);
    assert.equal(helperReleased, true);
    assert.equal(exit.code, 0);
    assert.equal(result.error, null, 'actual owned close must survive a transient native profile lock');
    assert.equal(existsSync(owned.profile), false, 'actual producer must remove only its exclusive profile');
    assert.equal(app.listening, true, 'foreign fixture listener remains owned by the test');
  } finally {
    clearTimeout(releaseTimer);
    releaseHolder();
    if (holderExit) await boundedFixture(holderExit, 'Own helper teardown');
    if (owned) {
      await owned.close().catch(() => {}); // Original close rejection is asserted above; teardown cannot convert it to PASS.
      assert.ok(owned.chrome.process.exitCode !== null || owned.chrome.process.signalCode !== null, 'own Chrome must stop before fixture removal');
      assert.equal(dirname(resolve(owned.profile)), resolve(outputDir), 'resolved recursive cleanup is restricted to the exact own fixture');
      if (existsSync(owned.profile)) await rm(owned.profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
    await close(app);
  }
});
