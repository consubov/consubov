import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const helperURL = new URL('../qa/run-api-smoke.mjs', import.meta.url);
const childProgram = `
const http = require('node:http');
require('node:fs').writeFileSync(process.env.FIXTURE_PID, String(process.pid));
const mode = process.env.FIXTURE_MODE;
if (mode === 'exit' || mode === 'exit-zero') process.exit(mode === 'exit' ? 9 : 0);
if (mode === 'signal') { process.kill(process.pid, 'SIGTERM'); }
const server = http.createServer((req,res)=>{
  require('node:fs').appendFileSync(process.env.FIXTURE_REQUESTS, req.url+'\\n');
  for (const [key,value] of Object.entries({'cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'no-referrer','permissions-policy':'camera=(), microphone=(), geolocation=()'})) res.setHeader(key,value);
  if (mode === 'hang') return;
  if (mode === 'body-hang') { res.writeHead(200); res.write('{'); return; }
  if (mode === 'oversized') { res.end('x'.repeat(1_048_577)); return; }
  if (mode === 'redirect') { res.writeHead(302,{location:process.env.FIXTURE_REDIRECT}); res.end(); return; }
  if (mode === 'late' && req.url === '/api/docs') { setTimeout(()=>process.exit(7),30); return; }
  if (mode === 'bad-health' && req.url === '/api/v1/health') { res.end('{"status":"bad"}'); return; }
  if (mode === 'bad-headers') res.removeHeader('x-frame-options');
  if (req.url === '/api/v1/health') res.end('{"status":"ok"}');
  else if (req.url === '/api/v1/readiness') res.end('{"status":"ready"}');
  else if (req.url === '/api/v1/openapi.json') res.end('{"openapi":"3.1.0"}');
  else if (req.url === '/api/docs') res.end('<title>Consubov Developers</title>');
  else { res.writeHead(404); res.end('{"error":{"code":"NOT_FOUND"}}'); }
});
server.listen(Number(process.env.PORT),'127.0.0.1',()=>{
  const startup = 'Consubov API listening on http://127.0.0.1:'+server.address().port;
  if (mode === 'stderr-startup') console.error(startup);
  else if (mode === 'wrong-startup') console.log(startup+'9');
  else if (mode !== 'missing-startup') console.log(startup);
});
`;

async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function fixtureOptions(mode, overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'consubov-api-smoke-'));
  const port = await freePort();
  return { program: process.execPath, args: ['-e', childProgram], baseURL: `http://127.0.0.1:${port}`,
    outputDir: dir, startupTimeoutMs: 1200, requestTimeoutMs: 300, pollIntervalMs: 20,
    env: { ...process.env, FIXTURE_MODE: mode, FIXTURE_PID: join(dir, 'child.pid'), FIXTURE_REQUESTS: join(dir, 'requests') }, ...overrides };
}

async function smoke(options) {
  assert.ok(existsSync(helperURL), 'own-child API smoke boundary must exist');
  return (await import(helperURL)).runApiSmoke(options);
}

async function assertStopped(options) {
  const pid = Number(await readFile(options.env.FIXTURE_PID, 'utf8'));
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' }, 'only the spawned API child must have stopped');
}

test('stale correct HTTP cannot satisfy a child that cannot bind; original fixture survives', async t => {
  let hits = 0;
  const server = createServer((_req, res) => { hits++; res.end('{"status":"ok"}'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const options = await fixtureOptions('valid', { baseURL: `http://127.0.0.1:${server.address().port}` });
  await assert.rejects(smoke(options), /own API child.*exit|startup/i);
  assert.equal(hits, 0, 'no HTTP may run before own-child startup');
  assert.equal(await (await fetch(options.baseURL)).text(), '{"status":"ok"}');
  assert.equal(server.listening, true);
  await assertStopped(options);
});

for (const mode of ['exit', 'exit-zero', 'signal', 'missing-startup', 'stderr-startup', 'wrong-startup', 'hang', 'body-hang', 'late', 'bad-health', 'bad-headers']) {
  test(`own-child API smoke fails closed and cleans up: ${mode}`, async () => {
    const options = await fixtureOptions(mode);
    const start = Date.now();
    await assert.rejects(smoke(options), mode === 'late' ? /child|fetch/i : /child|startup|timeout|health|header/i);
    assert.ok(Date.now() - start < 6000, 'failure and cleanup must remain bounded');
    await assertStopped(options);
    if (mode.includes('startup')) assert.equal(existsSync(options.env.FIXTURE_REQUESTS), false, 'unverified child must never receive HTTP');
  });
}

test('local API redirect fails without following another origin', async t => {
  let redirectedHits = 0;
  const other = createServer((_req, res) => { redirectedHits++; res.end('{"status":"ok"}'); });
  await new Promise(resolve => other.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => other.close(resolve)));
  const options = await fixtureOptions('redirect');
  options.env.FIXTURE_REDIRECT = `http://127.0.0.1:${other.address().port}/`;
  await assert.rejects(smoke(options), /redirect|fetch/i);
  assert.equal(redirectedHits, 0);
  await assertStopped(options);
});

test('API response bytes are bounded as well as elapsed request time', async () => {
  const options = await fixtureOptions('oversized');
  await assert.rejects(smoke(options), /response.*size limit/i);
  await assertStopped(options);
});

test('valid own API child checks HTTP contracts, saves evidence and stops only that child', async () => {
  const options = await fixtureOptions('valid');
  const result = await smoke(options);
  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.paths, ['/api/v1/health', '/api/v1/readiness', '/api/v1/openapi.json', '/api/docs', '/api/v1/qa-missing-route']);
  assert.equal(await readFile(join(options.outputDir, 'health.json'), 'utf8'), '{"status":"ok"}');
  assert.match(await readFile(join(options.outputDir, 'consubov-api.log'), 'utf8'), /Consubov API listening on http:\/\/127\.0\.0\.1:/);
  await assertStopped(options);
});

test('API smoke rejects remote, credential-bearing and path targets before child creation', async () => {
  for (const baseURL of ['https://example.invalid', 'http://user:pass@127.0.0.1:3000', 'http://127.0.0.1:3000/path']) {
    const options = await fixtureOptions('valid', { baseURL });
    await assert.rejects(smoke(options), /local HTTP origin/i);
    assert.equal(existsSync(options.env.FIXTURE_PID), false);
  }
});
