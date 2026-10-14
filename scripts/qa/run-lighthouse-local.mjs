import { createServer, request } from 'node:http';
import { createRequire } from 'node:module';
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { sourceState } from './source-state.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const requireWeb = createRequire(join(root, 'apps/web/package.json'));
const pages = { home: '/', login: '/login' };
const within = (path, parent) => { const part = relative(parent, path); return !isAbsolute(part) && part !== '..' && !part.startsWith('..' + (process.platform === 'win32' ? '\\' : '/')); };
function localOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Lighthouse requires a local HTTP origin'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Lighthouse requires a local HTTP origin without credentials or a path');
  }
  return url;
}
function duration(value) { if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Lighthouse bounds must be positive integer milliseconds'); }
export async function checkedOutputDir(value) {
  if (typeof value !== 'string' || !value || !within(resolve(value), join(root, '.qa'))) throw new Error('Lighthouse output must be inside ignored repository .qa');
  const destination = resolve(value);
  const canonicalQa = join(await realpath(root), '.qa');
  let ancestor = root;
  // Check every existing ancestor BEFORE mkdir. In particular, mkdir({recursive:true})
  // must never follow a .qa junction and create even an empty outside directory.
  for (const part of relative(root, destination).split(sep)) {
    ancestor = join(ancestor, part);
    let info;
    try { info = await lstat(ancestor); } catch (error) { if (error.code === 'ENOENT') break; throw error; }
    if (info.isSymbolicLink() || !info.isDirectory() || !within(await realpath(ancestor), canonicalQa)) throw new Error('Lighthouse output symlink or ancestor leaves repository .qa');
  }
  return destination;
}
async function bounded(promise, ms, label) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label + ' timeout')), ms); })]); }
  finally { clearTimeout(timer); }
}

/** A private HTTP proxy, not a system proxy. It never opens denied upstreams. */
export async function createLocalAuditProxy(baseURL, { requestTimeoutMs = 5000 } = {}) {
  const origin = localOrigin(baseURL);
  duration(requestTimeoutMs);
  const counts = { allowed: 0, deniedHttp: 0, deniedConnect: 0, deniedUpgrade: 0, peerResets: 0, errors: 0, timeouts: 0, oversized: 0 };
  const sockets = new Set();
  const upstreams = new Set();
  const server = createServer({ maxHeaderSize: 8192 }, (req, res) => {
    let target;
    try { target = new URL(req.url); } catch { /* proxy requires an absolute URL */ }
    if (!target || req.url.length > 4096 || target.origin !== origin.origin || target.username || target.password) {
      counts.deniedHttp++; res.writeHead(403); res.end('Local audit origin refused'); return;
    }
    counts.allowed++;
    const headers = { ...req.headers, host: origin.host };
    for (const key of ['proxy-authorization', 'proxy-connection', 'connection']) delete headers[key];
    const upstream = request(target, { method: req.method, headers, agent: false });
    upstreams.add(upstream);
    const timer = setTimeout(() => {
      counts.timeouts++;
      if (!res.headersSent) res.writeHead(504);
      res.end(); upstream.destroy();
    }, requestTimeoutMs);
    upstream.once('close', () => { clearTimeout(timer); upstreams.delete(upstream); });
    upstream.once('error', () => {
      if (!upstream.destroyed || !res.writableEnded) counts.errors++;
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    upstream.on('response', response => {
      res.writeHead(response.statusCode, response.headers);
      let bytes = 0;
      response.on('data', chunk => {
        bytes += chunk.length;
        // Larger than the entire versioned web bundle; do not buffer unbounded bodies.
        if (bytes > 32 * 1024 * 1024) { counts.oversized++; response.destroy(); res.destroy(); upstream.destroy(); }
      });
      response.pipe(res);
    });
    let requestBytes = 0;
    req.on('data', chunk => {
      requestBytes += chunk.length;
      if (requestBytes > 1024 * 1024) { counts.oversized++; upstream.destroy(); res.destroy(); }
    });
    res.once('close', () => { if (!res.writableFinished) upstream.destroy(); });
    req.pipe(upstream);
  });
  server.on('connection', socket => {
    sockets.add(socket); socket.once('close', () => sockets.delete(socket));
    // CONNECT detaches the HTTP parser. A peer can reset our local refusal socket;
    // handle that transport event on this owned socket, not via process-wide suppression.
    socket.on('error', error => {
      if (['ECONNRESET', 'EPIPE'].includes(error.code)) counts.peerResets++;
      else counts.errors++;
    });
  });
  server.on('connect', (_req, socket) => { counts.deniedConnect++; socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); });
  server.on('upgrade', (_req, socket) => { counts.deniedUpgrade++; socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); });
  try {
    await bounded(new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolveListen); }), 5000, 'Local proxy startup');
  } catch (error) { for (const socket of sockets) socket.destroy(); server.close(); throw error; }
  let closing;
  return { counts, url: `http://127.0.0.1:${server.address().port}`, close() {
    return closing ??= bounded(new Promise(resolveClose => {
      for (const upstream of upstreams) upstream.destroy();
      for (const socket of sockets) socket.destroy();
      server.close(resolveClose);
    }), 5000, 'Own proxy cleanup');
  } };
}

/** Each audit gets its own Chrome process/profile and proxy. No existing debugger is reused. */
export async function launchLocalAuditBrowser({ baseURL, outputDir, startupTimeoutMs = 15_000 } = {}) {
  const origin = localOrigin(baseURL);
  duration(startupTimeoutMs);
  outputDir = await checkedOutputDir(outputDir);
  const { chromium } = requireWeb('@playwright/test');
  const cache = join(root, '.qa/tools/playwright-browsers');
  const chromePath = chromium.executablePath();
  if (!within(chromePath, cache) || !existsSync(chromePath)) throw new Error('Set process-only PLAYWRIGHT_BROWSERS_PATH to repository .qa/tools/playwright-browsers');
  const requireLighthouse = createRequire(requireWeb.resolve('lighthouse/package.json'));
  const { Launcher } = await import(pathToFileURL(requireLighthouse.resolve('chrome-launcher')));
  await checkedOutputDir(outputDir);
  await mkdir(outputDir, { recursive: true });
  if (!within(await realpath(outputDir), join(root, '.qa'))) throw new Error('Lighthouse output symlink leaves repository .qa');
  const profile = await mkdtemp(join(outputDir, 'chrome-profile-'));
  const proxy = await createLocalAuditProxy(origin.origin);
  const launcher = new Launcher({ chromePath, userDataDir: profile, port: 0, startingUrl: 'about:blank',
    chromeFlags: ['--headless', '--no-sandbox', '--disable-quic', `--proxy-server=${proxy.url}`, '--proxy-bypass-list=<-loopback>'],
    connectionPollInterval: 250, maxConnectionRetries: Math.ceil(startupTimeoutMs / 250), logLevel: 'silent' });
  let closing;
  const close = () => closing ??= (async () => {
    let stopped = false;
    try {
      const child = launcher.chromeProcess;
      const closed = child && child.exitCode === null && child.signalCode === null ? new Promise(resolveClose => child.once('close', resolveClose)) : Promise.resolve();
      launcher.kill();
      await bounded(closed, 5000, 'Own Chrome cleanup');
      stopped = true;
    } finally {
      await proxy.close();
      // Only the exclusive directory created above, after its own Chrome has stopped.
      if (stopped) {
        const profilePath = resolve(profile);
        if (!within(profilePath, join(root, '.qa')) || !within(await realpath(profilePath), join(root, '.qa'))) throw new Error('Own Chrome profile cleanup path invalid');
        // Windows may briefly retain a profile file after the owned Chrome exits.
        // Retry the whole removal, rather than multiplying retries per directory.
        for (let attempt = 0; ; attempt++) {
          try {
            const info = await lstat(profilePath);
            if (info.isSymbolicLink() || !info.isDirectory() || !within(await realpath(profilePath), join(root, '.qa'))) throw new Error('Own Chrome profile cleanup path invalid');
            await rm(profilePath, { recursive: true, force: true, maxRetries: 0 });
            break;
          } catch (error) {
            if (error?.code === 'ENOENT') break;
            if (!['EBUSY', 'ENOTEMPTY', 'EPERM', 'EMFILE', 'ENFILE'].includes(error?.code) || attempt >= 5) throw error;
            await delay((attempt + 1) * 200);
          }
        }
      }
    }
  })();
  try {
    const startupDeadline = Date.now() + startupTimeoutMs;
    await bounded(launcher.launch(), startupTimeoutMs, 'Own Chrome startup');
    const chrome = { pid: launcher.pid, port: launcher.port, process: launcher.chromeProcess };
    if (!chrome.pid || chrome.process.exitCode !== null || chrome.process.signalCode !== null) throw new Error('Own Chrome exited before readiness');
    // Launcher proves TCP accept only. Lighthouse needs its own DevTools HTTP endpoint ready.
    let ready = false;
    while (Date.now() < startupDeadline) {
      if (chrome.process.exitCode !== null || chrome.process.signalCode !== null) throw new Error('Own Chrome exited during DevTools readiness');
      try {
        const info = await new Promise((resolveInfo, reject) => {
          const req = request(`http://127.0.0.1:${chrome.port}/json/version`, { timeout: Math.min(1000, Math.max(1, startupDeadline - Date.now())) }, res => {
            let body = '';
            res.on('data', chunk => { body += chunk; if (body.length > 65_536) req.destroy(new Error('DevTools response exceeds bound')); });
            res.once('error', reject);
            res.once('end', () => { try { if (res.statusCode !== 200) throw new Error(); resolveInfo(JSON.parse(body)); } catch { reject(new Error('Own DevTools response invalid')); } });
          });
          req.once('timeout', () => req.destroy(new Error('Own DevTools request timeout'))); req.once('error', reject); req.end();
        });
        const endpoint = new URL(info.webSocketDebuggerUrl);
        if (!/^\w*Chrome\/\d+/.test(info.Browser) || endpoint.hostname !== '127.0.0.1' || Number(endpoint.port) !== chrome.port || !endpoint.pathname.startsWith('/devtools/browser/')) throw new Error('Own DevTools identity invalid');
        const markerPath = join(profile, 'DevToolsActivePort');
        if (existsSync(markerPath)) {
          const marker = (await readFile(markerPath, 'utf8')).trim().split(/\r?\n/);
          if (Number(marker[0]) !== chrome.port || marker[1] !== endpoint.pathname) throw new Error('Own fresh-profile DevTools marker mismatch');
          chrome.profileMarkerVerified = true;
        }
        chrome.version = info.Browser; ready = true; break;
      } catch { await delay(100); }
    }
    if (!ready || chrome.process.exitCode !== null || chrome.process.signalCode !== null) throw new Error('Own Chrome DevTools readiness timeout');
    return { chrome, proxy, profile, close };
  } catch (error) { await close(); throw error; }
}

export function validateLighthouseReport(report, expectedURL, version) {
  if (!report || report.runtimeError || report.lighthouseVersion !== version) throw new Error('Invalid Lighthouse report/runtime/version');
  for (const key of ['requestedUrl', 'mainDocumentUrl', 'finalDisplayedUrl']) {
    if (report[key] !== expectedURL) throw new Error('Unexpected Lighthouse report origin or route');
  }
  if (!report.configSettings || report.configSettings.formFactor !== 'mobile' || report.configSettings.throttlingMethod !== 'simulate' || report.configSettings.disableStorageReset) {
    throw new Error('Unexpected Lighthouse cold mobile simulation settings');
  }
  const metrics = { performance: report.categories?.performance?.score, accessibility: report.categories?.accessibility?.score,
    lcpMs: report.audits?.['largest-contentful-paint']?.numericValue, cls: report.audits?.['cumulative-layout-shift']?.numericValue,
    tbtMs: report.audits?.['total-blocking-time']?.numericValue };
  for (const [name, value] of Object.entries(metrics)) {
    if (!Number.isFinite(value) || value < 0 || (['performance', 'accessibility'].includes(name) && value > 1)) throw new Error('Invalid Lighthouse metric: ' + name);
  }
  for (const id of ['largest-contentful-paint', 'cumulative-layout-shift', 'total-blocking-time']) {
    if (report.audits[id].errorMessage || report.audits[id].scoreDisplayMode === 'error') throw new Error('Lighthouse metric audit failed');
  }
  if (!Array.isArray(report.runWarnings) || !report.environment?.hostUserAgent || !Number.isFinite(report.environment.benchmarkIndex)) throw new Error('Incomplete Lighthouse provenance');
  return metrics;
}

export async function runLocalLighthouse({ baseURL = 'http://127.0.0.1:8080', outputDir, runs = 3, auditTimeoutMs = 120_000 } = {}) {
  const origin = localOrigin(baseURL);
  duration(auditTimeoutMs);
  if (!Number.isInteger(runs) || runs < 1 || runs > 3) throw new Error('Lighthouse runs must be between1 and3');
  outputDir = await checkedOutputDir(outputDir);
  const { default: lighthouse } = await import(pathToFileURL(requireWeb.resolve('lighthouse')));
  const lighthouseVersion = requireWeb('lighthouse/package.json').version;
  await checkedOutputDir(outputDir);
  await mkdir(outputDir, { recursive: true });
  for (const page of Object.keys(pages)) if (existsSync(join(outputDir, `lighthouse-${page}.json`))) throw new Error('Refusing to overwrite previous Lighthouse reports');
  const session = await mkdtemp(join(outputDir, 'lighthouse-session-'));
  const measured = { status: 'FAIL', applicationAcceptance: false, baseURL: origin.origin, startedAt: new Date().toISOString(),
    sourceAtStart: sourceState(root), environment: { node: process.version, platform: process.platform, arch: process.arch,
      osRelease: os.release(), cpuCount: os.cpus().length, totalMemoryBytes: os.totalmem() }, lighthouseVersion,
    playwrightVersion: requireWeb('@playwright/test/package.json').version, runs: [], summary: {}, error: null };
  let owned;
  let stage = 'initialization';
  let interrupted = false;
  const onSignal = () => { interrupted = true; void owned?.close().catch(() => {}); };
  process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
  try {
    for (let index = 1; index <= runs; index++) {
      for (const [page, path] of Object.entries(pages)) {
        if (interrupted) throw new Error('Local Lighthouse interrupted');
        const dir = join(session, 'run-' + index);
        await checkedOutputDir(dir);
        await mkdir(dir, { recursive: true });
        stage = 'browser-start';
        owned = await launchLocalAuditBrowser({ baseURL: origin.origin, outputDir: dir });
        const startedAt = new Date().toISOString();
        try {
          stage = 'audit';
          const target = new URL(path, origin).href;
          if (interrupted) throw new Error('Local Lighthouse interrupted during startup');
          const result = await bounded(lighthouse(target, { port: owned.chrome.port, hostname: '127.0.0.1', output: 'json', logLevel: 'error', enableErrorReporting: false }), auditTimeoutMs, 'Local Lighthouse audit');
          if (interrupted || owned.chrome.process.exitCode !== null || owned.chrome.process.signalCode !== null) throw new Error('Own Chrome exited during audit');
          stage = 'report';
          const json = JSON.stringify(result?.lhr, null, 2);
          if (!json) throw new Error('Lighthouse did not return a report');
          const filename = join(dir, 'lighthouse-' + page + '.json');
          await checkedOutputDir(dir);
          await writeFile(filename, json + '\n', { flag: 'wx' });
          const metrics = validateLighthouseReport(result.lhr, target, lighthouseVersion);
          if (owned.proxy.counts.errors || owned.proxy.counts.timeouts || owned.proxy.counts.oversized) throw new Error('Allowed local Lighthouse proxy request failed');
          const network = { ...owned.proxy.counts };
          measured.runs.push({ page, index, startedAt, finishedAt: new Date().toISOString(), browserPid: owned.chrome.pid,
            browserVersion: owned.chrome.version, profileMarkerVerified: Boolean(owned.chrome.profileMarkerVerified),
            chrome: result.lhr.environment.hostUserAgent, settings: result.lhr.configSettings, warnings: result.lhr.runWarnings.map(() => 'Lighthouse warning retained in original local report'),
            report: relative(outputDir, filename), reportSha256: createHash('sha256').update(json + '\n').digest('hex'), metrics, network });
          if (index === 1) {
            await checkedOutputDir(outputDir);
            await writeFile(join(outputDir, 'lighthouse-' + page + '.json'), json + '\n', { flag: 'wx' });
          }
          console.log(`[lighthouse:local] ${page} run${index}: measured; deniedHTTP=${network.deniedHttp}; deniedCONNECT=${network.deniedConnect}`);
        } finally {
          const completed = owned; owned = undefined;
          const beforeClose = stage; stage = 'cleanup';
          await completed.close();
          stage = beforeClose;
        }
      }
    }
    for (const page of Object.keys(pages)) {
      measured.summary[page] = {};
      for (const metric of ['performance', 'accessibility', 'lcpMs', 'cls', 'tbtMs']) {
        const values = measured.runs.filter(run => run.page === page).map(run => run.metrics[metric]).sort((a, b) => a - b);
        measured.summary[page][metric] = { min: values[0], median: values[Math.floor(values.length / 2)], max: values.at(-1), values };
      }
    }
    measured.status = 'MEASURED';
    return measured;
  } catch (error) {
    measured.error = 'Local Lighthouse measurement failed; inspect owned local evidence';
    measured.errorStage = stage;
    measured.errorCode = ['EBUSY', 'ENOTEMPTY', 'EPERM', 'EMFILE', 'ENFILE', 'ENOENT', 'EACCES'].includes(error?.code) ? error.code : null;
    throw error;
  }
  finally {
    process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal);
    try { await owned?.close(); }
    catch (error) {
      measured.status = 'FAIL'; measured.error = 'Own local audit cleanup failed';
      throw error;
    } finally {
      measured.finishedAt = new Date().toISOString(); measured.sourceAtFinish = sourceState(root);
      await checkedOutputDir(session);
      await writeFile(join(session, 'measurements.json'), JSON.stringify(measured, null, 2) + '\n', { flag: 'wx' });
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const result = await runLocalLighthouse({ baseURL: process.env.QA_BASE_URL, outputDir: process.env.QA_OUTPUT_DIR }); console.log(`[lighthouse:local] ${result.status}: ${result.runs.length} reports; baseline approval remains separate`); }
  catch { console.error('[lighthouse:local] FAIL: local measurement/containment incomplete'); process.exitCode = 1; }
}
