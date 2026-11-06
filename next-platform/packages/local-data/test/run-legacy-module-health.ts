import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, webkit } from '@playwright/test';
import { assetRecord, digest } from '../../../apps/fazenda/shell/scripts/artifact-publisher';

// Actual production host + worker + verified cache bytes. No transport mocks,
// accelerated clocks, production servers, or changes to legacy fixtures.
const root = resolve(import.meta.dir, '../../..');
const run = resolve(root, '.qa/runs', `legacy-health-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`);
await mkdir(run, { recursive: true });
const built = await Bun.build({ entrypoints: [resolve(root, 'qa/fixtures/legacy-module-health-host.ts')], target: 'browser', format: 'esm', define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' } });
if (!built.success) throw new AggregateError(built.logs, 'Host build failed');
const host = await built.outputs[0]!.text();
const worker = await readFile(resolve(root, 'apps/fazenda/shell/public/sw.js'), 'utf8');
const results: unknown[] = [];
const modes = ['installed-ready', 'installed-nohello', 'installed-noready', 'legacy-candidate', 'modern-candidate'] as const;
const onlyInstalled = process.env.LEGACY_HEALTH_ONLY_INSTALLED === '1';

function moduleScript(mode: typeof modes[number]) {
  return `
const nonce=document.querySelector('meta[name="consubov-module-nonce"]').content;
const identity={protocolVersion:1,moduleId:'capataz',profileId:'capataz',nonce};
const pending=new Map();let port;
window.addEventListener('message',event=>{
 if(event.source!==parent||event.data?.kind!=='shell:init'||event.data.nonce!==nonce||event.ports.length!==1)return;
 port=event.ports[0];port.onmessage=({data})=>{if(data.kind==='response'&&data.nonce===nonce){const f=pending.get(data.requestId);if(f){pending.delete(data.requestId);f(data);}}};port.start();
 ${mode === 'installed-noready' ? '' : "port.postMessage({...identity,kind:'module:ready'});"}
 document.getElementById('rpc').onclick=()=>{const requestId=crypto.randomUUID();pending.set(requestId,d=>document.getElementById('result').textContent=d.ok?'schema:'+d.result:'error:'+d.error.code);port.postMessage({kind:'request',protocolVersion:1,moduleId:'capataz',nonce,requestId,method:'getSchemaVersion',payload:{}});};
});
${mode === 'installed-nohello' ? '' : "parent.postMessage({...identity,kind:'module:hello',version:'0.1.0'},'*');"}
`;
}

async function exercise(browser: Awaited<ReturnType<typeof chromium.launch>>, browserName: string, mode: typeof modes[number]) {
  const script = moduleScript(mode);
  const html = '<!doctype html><body><button id="rpc">Read schema</button><output id="result"></output><script defer src="./module.js"></script>';
  const legacy = mode !== 'modern-candidate';
  const installed = mode.startsWith('installed');
  const manifest = { moduleId: 'capataz', profileId: 'capataz', version: '0.1.0', protocolVersion: 1, apiVersions: ['1'], entry: 'index.html', assets: [assetRecord('index.html', new TextEncoder().encode(html)), assetRecord('module.js', new TextEncoder().encode(script))], ...(legacy ? {} : { localDataSchemaVersion: 2, capabilities: ['local-data.read'], dependencies: [] }) };
  const manifestBytes = JSON.stringify(manifest);
  const generation = digest(manifestBytes);
  const base = legacy ? '/modules/capataz/current/' : `/modules/capataz/releases/${generation}/`;
  const staticAssets = new Map([
    ['/index.html', { body: '<!doctype html><body><div id="root"></div><script type="module" src="/host.js"></script>', type: 'text/html' }],
    ['/host.js', { body: host, type: 'text/javascript' }],
    ['/manifest.webmanifest', { body: '{"name":"Legacy health QA","start_url":"/"}', type: 'application/manifest+json' }]
  ]);
  const shellManifest = JSON.stringify({ assets: [...staticAssets].map(([name, asset]) => assetRecord(name, new TextEncoder().encode(asset.body))) });
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/sw.js') return new Response(worker, { headers: { 'content-type': 'text/javascript' } });
    if (path === '/shell-assets.json') return new Response(shellManifest, { headers: { 'content-type': 'application/json' } });
    const asset = staticAssets.get(path === '/' ? '/index.html' : path);
    if (asset) return new Response(asset.body, { headers: { 'content-type': asset.type } });
    if (!installed) {
      if (path === '/modules/capataz/current/module.json') return Response.json(legacy ? manifest : { schemaVersion: 2, moduleId: 'capataz', generation, releaseUrl: `${base}module.json` });
      if (path === `${base}module.json`) return Response.json(manifest);
      if (path === `${base}index.html`) return new Response(html, { headers: { 'content-type': 'text/html' } });
      if (path === `${base}module.js`) return new Response(script, { headers: { 'content-type': 'text/javascript' } });
    }
    return new Response('Not found', { status: 404 });
  } });
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const origin = `http://127.0.0.1:${server.port}`;
  const cacheName = `consubov-module-capataz-installed-${generation}`;
  try {
    await page.goto(origin);
    await page.waitForFunction(() => window.legacyHealthHost?.ready === true);
    if (installed) await page.evaluate(async ({ manifest, manifestBytes, html, script, cacheName }) => {
      const cache = await caches.open(cacheName);
      const base = `${location.origin}/modules/capataz/current/`;
      await cache.put(`${base}module.json`, new Response(manifestBytes, { headers: { 'content-type': 'application/json' } }));
      await cache.put(`${base}index.html`, new Response(html, { headers: { 'content-type': 'text/html' } }));
      await cache.put(`${base}module.js`, new Response(script, { headers: { 'content-type': 'text/javascript' } }));
      await (await caches.open('consubov-module-pointers-v1')).put('/__module_cache/capataz', new Response(JSON.stringify({ cacheName, manifest })));
    }, { manifest, manifestBytes, html, script, cacheName });
    await page.evaluate(() => window.legacyHealthHost.mount());
    const frame = page.frameLocator('iframe');
    if (mode !== 'installed-nohello' && mode !== 'installed-noready') {
      await frame.locator('#rpc').waitFor({ state: 'visible', timeout: 15000 });
      await frame.locator('#rpc').click();
      await frame.locator('#result').getByText('schema:2', { exact: true }).waitFor();
    } else await page.locator('iframe').waitFor({ state: 'attached' });
    const started = Date.now();
    await page.waitForTimeout(16500);
    const elapsedMs = Date.now() - started;
    const pointer = await page.evaluate(async () => {
      const r = await (await caches.open('consubov-release-pointers-v2')).match('/__modules/capataz');
      return r ? r.json() : null;
    });
    if (mode === 'installed-ready') {
      assert(!pointer?.rejectedGenerations?.includes(generation), 'Valid installed v1 ready must not be quarantined after handshake deadline');
      assert(!pointer || pointer.activeHealthy?.generation === generation, 'Valid installed v1 pointer must not be removed');
      assert.equal(await page.getByRole('alert').count(), 0, 'Working legacy module must not acquire a false runtime alert');
      await frame.locator('#result').evaluate(node => { node.textContent = ''; });
      await frame.locator('#rpc').click();
      await frame.locator('#result').getByText('schema:2', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.legacyHealthHost.activationBlocked()), true, 'Absent legacy bridge must block activation');
      await context.setOffline(true);
      await page.close();
      const reopened = await context.newPage();
      await reopened.goto(`${origin}/?mount=1`);
      const reopenedFrame = reopened.frameLocator('iframe');
      await reopenedFrame.locator('#rpc').waitFor({ state: 'visible', timeout: 15000 });
      await reopenedFrame.locator('#rpc').click();
      await reopenedFrame.locator('#result').getByText('schema:2', { exact: true }).waitFor();
      assert.equal(await reopened.evaluate(() => window.legacyHealthHost.activationBlocked()), true);
    } else {
      assert(pointer?.rejectedGenerations?.includes(generation), `${mode}: missing handshake/health must quarantine failed generation`);
      assert.equal(pointer.activeHealthy, null, `${mode}: must not gain healthy pointer`);
      if (!installed) assert.equal(pointer.candidate, null, 'Unconfirmed candidate must not remain eligible');
    }
    assert.deepEqual(errors, []);
    return { browser: browserName, mode, status: 'PASS', elapsedMs, generation, offlineRemount: mode === 'installed-ready', pointer };
  } finally { await context.close(); server.stop(true); }
}

try {
  for (const type of [chromium, webkit]) {
    const browser = await type.launch({ headless: true });
    try {
      const cases = await Promise.allSettled((onlyInstalled ? ['installed-ready'] as const : modes).map(mode => exercise(browser, type.name(), mode)));
      for (let i = 0; i < cases.length; i++) {
        const result = cases[i]!;
        const value = result.status === 'fulfilled' ? result.value : { browser: type.name(), mode: (onlyInstalled ? ['installed-ready'] : modes)[i], status: 'FAIL', error: String(result.reason) };
        results.push(value);
        console.log(JSON.stringify(value));
      }
    } finally { await browser.close(); }
  }
} finally {
  const status = results.length && results.every((r: any) => r.status === 'PASS') ? 'PASS' : 'FAIL';
  await writeFile(resolve(run, 'result.json'), JSON.stringify({ status, results }, null, 2));
  await writeFile(resolve(run, 'output.log'), results.map(r => JSON.stringify(r)).join('\n') + '\n');
  console.log(`Evidence: ${run}`);
}
if (results.some((r: any) => r.status === 'FAIL')) process.exitCode = 1;
