import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const securityHeaders = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

// The CLI has a fixed local Bun target. Injection here lets real process/HTTP fixtures
// exercise failure boundaries without binding a developer's application ports.
export async function runApiSmoke({
  baseURL = 'http://127.0.0.1:3000', program = 'bun', args = [join(root, 'apps/api/dist/index.js')],
  env = process.env, outputDir = process.env.QA_OUTPUT_DIR,
  startupTimeoutMs = 5000, requestTimeoutMs = 2000, pollIntervalMs = 50,
} = {}) {
  const target = new URL(baseURL);
  if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || target.username || target.password ||
      target.pathname !== '/' || target.search || target.hash) {
    throw new Error('API smoke requires a local HTTP origin without credentials or a path');
  }
  for (const value of [startupTimeoutMs, requestTimeoutMs, pollIntervalMs]) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error('API smoke timeouts must be positive integers');
  }
  if (!outputDir) throw new Error('API smoke requires QA_OUTPUT_DIR for evidence');
  await mkdir(outputDir, { recursive: true });
  const lifetime = new AbortController();
  const child = spawn(program, args, { cwd: root, env: { ...env, PORT: target.port || '80' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  let stdout = '';
  let startup = false;
  const startupLine = `Consubov API listening on ${target.origin}`;
  const appendLog = chunk => { log = (log + chunk.toString()).slice(-262_144); };
  child.stdout.on('data', chunk => {
    appendLog(chunk);
    stdout = (stdout + chunk.toString()).slice(-65_536);
    const lines = stdout.split('\n');
    stdout = lines.pop();
    if (lines.some(line => line.replace(/\r$/, '') === startupLine)) startup = true;
  });
  child.stderr.on('data', appendLog);
  const closed = new Promise(resolveClosed => child.once('close', resolveClosed));
  child.once('error', () => lifetime.abort(new Error('own API child failed to start')));
  child.once('exit', (code, signal) => lifetime.abort(new Error(`own API child exited (code=${code}, signal=${signal})`)));
  function assertAlive() {
    if (lifetime.signal.aborted) throw lifetime.signal.reason;
    if (child.exitCode !== null || child.signalCode !== null || child.killed) throw new Error('own API child is no longer alive');
  }
  async function pause(ms) {
    assertAlive();
    try { await delay(ms, undefined, { signal: lifetime.signal }); }
    catch { assertAlive(); }
    assertAlive();
  }
  async function request(path, timeoutMs = requestTimeoutMs) {
    assertAlive();
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(new Error(`API request timeout: ${path}`)), timeoutMs);
    try {
      const response = await fetch(new URL(path, target), {
        redirect: 'error', signal: AbortSignal.any([lifetime.signal, deadline.signal]),
      });
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let bytes = 0;
      let body = '';
      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > 1_048_576) {
              deadline.abort(new Error(`API response exceeds size limit: ${path}`));
              throw deadline.signal.reason;
            }
            body += decoder.decode(value, { stream: true });
          }
          body += decoder.decode();
        } finally { reader.releaseLock(); }
      }
      // Let process exit events surface before treating received bytes as acceptance.
      await new Promise(resolveTick => setImmediate(resolveTick));
      assertAlive();
      return { response, body };
    } catch (error) {
      assertAlive();
      if (deadline.signal.aborted) throw deadline.signal.reason;
      throw new Error(`API fetch failed (redirects are refused): ${path}`, { cause: error });
    } finally { clearTimeout(timer); }
  }
  function checkHeaders(response, path) {
    for (const [name, value] of Object.entries(securityHeaders)) {
      if (response.headers.get(name) !== value) throw new Error(`API security header mismatch: ${path} ${name}`);
    }
  }
  const paths = [];
  try {
    const readyDeadline = Date.now() + startupTimeoutMs;
    while (!startup) {
      if (Date.now() >= readyDeadline) throw new Error('own API child startup timeout: matching startup output absent');
      await pause(Math.min(pollIntervalMs, Math.max(1, readyDeadline - Date.now())));
    }
    assertAlive();
    const checks = [
      ['/api/v1/health', 200, 'health.json', body => body === '{"status":"ok"}'],
      ['/api/v1/readiness', 200, 'readiness.json', body => body === '{"status":"ready"}'],
      ['/api/v1/openapi.json', 200, 'openapi.json', body => JSON.parse(body).openapi === '3.1.0'],
      ['/api/docs', 200, 'docs.html', body => body.includes('Consubov Developers')],
      ['/api/v1/qa-missing-route', 404, 'not-found.json', body => JSON.parse(body).error?.code === 'NOT_FOUND'],
    ];
    for (const [path, status, filename, valid] of checks) {
      assertAlive();
      const { response, body } = await request(path);
      if (response.status !== status || !valid(body)) throw new Error(`API HTTP contract mismatch: ${path}`);
      checkHeaders(response, path);
      await writeFile(join(outputDir, filename), body);
      assertAlive();
      paths.push(path);
    }
    assertAlive();
    return { status: 'PASS', paths };
  } finally {
    // Ownership is the ChildProcess handle. Never discover/terminate a process by port.
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    let timer;
    try {
      const didClose = await Promise.race([closed.then(() => true), new Promise(resolveTimeout => { timer = setTimeout(() => resolveTimeout(false), 1000); })]);
      if (!didClose) {
        child.kill('SIGKILL');
        const stopped = await Promise.race([closed.then(() => true), delay(1000).then(() => false)]);
        if (!stopped) throw new Error('own API child cleanup timeout');
      }
    } finally {
      clearTimeout(timer);
      await writeFile(join(outputDir, 'consubov-api.log'), log);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const result = await runApiSmoke(); console.log(`[api smoke] ${result.status} (${result.paths.length} local HTTP contracts)`); }
  catch (error) { console.error(`[api smoke] FAIL: ${error.message}`); process.exitCode = 1; }
}
