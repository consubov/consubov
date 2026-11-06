import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const root = resolve(import.meta.dir, '../../..');
// Reuse the repository's existing browser-test installation; no toolchain install.
const { chromium, webkit } = createRequire(resolve(root, 'packages/local-data/package.json'))('@playwright/test');
const workerSource = await readFile(resolve(root, 'apps/fazenda/shell/public/sw.js'), 'utf8');
const built = await Bun.build({ entrypoints: [resolve(import.meta.dir, 'browser-generation-client.ts')], target: 'browser', format: 'iife', write: false });
if (!built.success) throw new AggregateError(built.logs, 'Fixture client build failed');
const fixtureScript = await built.outputs[0]!.text();
async function poll(check: () => Promise<boolean>, label: string) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 50)); }
  throw new Error(`Timed out: ${label}`);
}
const bytes = (s: string) => new TextEncoder().encode(s);
async function hash(s: string) { return Buffer.from(await crypto.subtle.digest('SHA-256', bytes(s))).toString('hex'); }
async function moduleRelease(id: string, version: string) {
  const files = { 'index.html': '<!doctype html><script src="./module.js"></script>', 'module.js': `parent.postMessage({kind:'fixture-version',version:${JSON.stringify(version)}},'*');` };
  const assets = await Promise.all(Object.entries(files).map(async ([url, body]) => ({ url, bytes: bytes(body).length, sha256: await hash(body), integrity: `sha256-${Buffer.from(await crypto.subtle.digest('SHA-256', bytes(body))).toString('base64')}` })));
  const manifest = JSON.stringify({ moduleId: id, profileId: id, version, protocolVersion: 1, apiVersions: ['1'], entry: 'index.html', assets, localDataSchemaVersion: 2, capabilities: ['local-data.read','local-data.write'], dependencies: [] });
  const generation = await hash(manifest); return { id, files, manifest, generation, resourceBase: `/modules/${id}/releases/${generation}/` };
}
async function shellRelease(version: string, protocols = [1]) {
  const files = { '/index.html': `<!doctype html><title>${version}</title><script src="/fixture.js"></script>`, '/fixture.js': fixtureScript, '/manifest.webmanifest': '{"name":"Release fixture"}' };
  const manifest = JSON.stringify({ assets: await Promise.all(Object.entries(files).map(async ([url, body]) => ({ url, bytes: bytes(body).length, sha256: await hash(body) }))) });
  const generation = await hash(manifest); return { files, manifest, descriptor: { generation, manifestSha256: generation, manifestUrl: `/shell-releases/${generation}/shell-assets.json`, resourceBase: `/shell-releases/${generation}/`, protocolVersions: protocols, apiVersions: ['1'] } };
}
const a = await moduleRelease('capataz', '1.0.0'); const b = await moduleRelease('capataz', '2.0.0'); const c = await moduleRelease('capataz', '3.0.0'); const gerente = await moduleRelease('gerente','1.0.0');
const shellA = await shellRelease('Shell-A'); const shellB = await shellRelease('Shell-B'); const incompatible = await shellRelease('Shell-C', [2]);
const results: Array<{ browser: string; passed: string[]; error?: string }> = [];
for (const [name, browserType] of [['Chromium', chromium], ['WebKit', webkit]] as const) {
  let skipReached = false; let resumeSkip!: () => void;
  const skipBarrier = new Promise<void>(resolve => { resumeSkip = resolve; });
  let raceReached = false; let resumeRace!: () => void;
  const raceBarrier = new Promise<void>(resolve => { resumeRace = resolve; });
  const files = new Map<string, string>(); let currentShell = shellA; const requests: string[] = [];
  const publishShell = (s: typeof shellA) => { currentShell = s; files.set(s.descriptor.manifestUrl, s.manifest); for (const [url, body] of Object.entries(s.files)) { files.set(s.descriptor.resourceBase + url.slice(1), body); files.set(url, body); } };
  const publishModule = (m: typeof a) => { files.set(`/modules/${m.id}/current/module.json`, JSON.stringify({ schemaVersion: 2, moduleId: m.id, generation: m.generation, releaseUrl: m.resourceBase + 'module.json' })); files.set(m.resourceBase + 'module.json', m.manifest); for (const [url, body] of Object.entries(m.files)) files.set(m.resourceBase + url, body); };
  publishShell(shellA); publishModule(a); publishModule(gerente);
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, idleTimeout: 60, async fetch(request) {
    const path = new URL(request.url).pathname; requests.push(path);
    if (path === '/race-skip') { skipReached = true; await skipBarrier; return new Response('resume'); }
    if (path === '/race-verify') { raceReached = true; await raceBarrier; return new Response('resume'); }
    if (path === '/race-sw.js') return new Response(workerSource.replace('const SHELL_RELEASE = null;', `const SHELL_RELEASE = ${JSON.stringify(incompatible.descriptor)};`).replace('async function verifyShell(release) {', "async function verifyShell(release) { await fetch('/race-verify');"), { headers: { 'Content-Type': 'application/javascript', 'Service-Worker-Allowed': '/' } });
    if (path === '/sw.js') return new Response(workerSource.replace('const SHELL_RELEASE = null;', `const SHELL_RELEASE = ${JSON.stringify(currentShell.descriptor)};`).replace('skipWaitingPromise = self.skipWaiting();', currentShell.descriptor.generation === shellB.descriptor.generation ? "skipWaitingPromise = (async () => { await fetch('/race-skip'); return self.skipWaiting(); })();" : 'skipWaitingPromise = self.skipWaiting();'), { headers: { 'Content-Type':'application/javascript', 'Cache-Control':'no-store', 'Service-Worker-Allowed':'/' } });
    const body = files.get(path === '/' ? '/index.html' : path);
    return new Response(body ?? 'Missing', { status: body === undefined ? 404 : 200, headers: { 'Content-Type': path.endsWith('.js') ? 'application/javascript' : path.endsWith('.json') ? 'application/json' : 'text/html', 'Cache-Control':'no-store' } });
  } });
  const browser = await browserType.launch(); const context = await browser.newContext(); let page = await context.newPage(); const result = { browser: name, passed: [] as string[], error: undefined as string | undefined };
  const assert = (condition: boolean, label: string) => { if (!condition) throw new Error(label); result.passed.push(label); };
  try {
    await page.goto(`http://127.0.0.1:${server.port}/`);
    await page.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })); });
    const preservation = await page.evaluate(() => (window as any).seedPreservationFixture());
    const first = await page.evaluate(async () => (await (window as any).releaseMessage('PROVISION_AUTHORIZED_MODULE', { moduleId:'capataz' })).descriptor);
    assert(first.generation === a.generation && first.health === 'candidate', 'initial complete generation remains candidate');
    await page.evaluate(d => (window as any).releaseMessage('MARK_MODULE_HEALTHY', d), first);
    const other = await page.evaluate(async () => (await (window as any).releaseMessage('PROVISION_AUTHORIZED_MODULE', { moduleId:'gerente' })).descriptor); await page.evaluate(d => (window as any).releaseMessage('MARK_MODULE_HEALTHY', d), other);
    publishModule(b); const next = await page.evaluate(async () => (await (window as any).releaseMessage('PROVISION_AUTHORIZED_MODULE', { moduleId:'capataz' })).descriptor);
    await page.evaluate(d => (window as any).releaseMessage('MARK_MODULE_HEALTHY', d), next);
    await page.evaluate(async d => { const frame = document.createElement('iframe'); frame.sandbox.add('allow-scripts'); frame.srcdoc = await (window as any).readPinnedDocument(d, 'fixture-nonce'); document.body.append(frame); }, first);
    await page.waitForFunction(() => (window as any).fixtureVersions.includes('1.0.0'));
    assert(true, 'old pinned document executes old bytes after active pointer changes');
    const untouched = await page.evaluate(async d => { const cache = await caches.open(d.cacheName); return (await cache.match(d.resourceBase + 'module.js'))?.text(); }, other);
    assert(untouched === gerente.files['module.js'], 'Capataz promotion preserves Gerente exact cache bytes');
    publishModule(c); files.delete(c.resourceBase + 'module.js');
    const fallback = await page.evaluate(async () => (await (window as any).releaseMessage('PROVISION_AUTHORIZED_MODULE', { moduleId:'capataz' })).descriptor);
    assert(fallback.generation === b.generation, 'asset404 preserves complete healthy generation');
    await page.evaluate(async d => { const cache = await caches.open(d.cacheName); await cache.put(d.resourceBase + 'module.js', new Response('corrupted')); }, next);
    const corruptRejected = await page.evaluate(async d => { try { await (window as any).readPinnedDocument(d, 'corrupt-nonce'); return false; } catch { return true; } }, next);
    assert(corruptRejected, 'opaque loader rehash rejects corrupted cached bytes');
    const recovered = await page.evaluate(async () => (await (window as any).releaseMessage('PROVISION_AUTHORIZED_MODULE', { moduleId:'capataz' })).descriptor);
    assert(recovered.generation === a.generation, 'cached corruption automatically restores explicit N-1');
    publishShell(shellB);
    await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration!.update(); });
    await poll(() => page.evaluate(async generation => { const response = await (await caches.open('consubov-release-pointers-v2')).match('/__shell'); return Boolean(response && (await response.json()).candidate?.generation === generation && !(await navigator.serviceWorker.getRegistration())?.installing); }, shellB.descriptor.generation), 'shell candidate installed');
    const before = await page.evaluate(async () => { const response = await (await caches.open('consubov-release-pointers-v2')).match('/__shell'); return (await response!.json()).active.generation; });
    assert(before === shellA.descriptor.generation, 'waiting shell install preserves active generation without consent');
    const verification = await page.evaluate(() => (window as any).releaseMessage('VERIFY_WAITING_WORKER', {}, true));
    assert(verification.compatible === true, 'waiting shell compatibility verified against installed modules');
    const expired = await page.evaluate(async version => (window as any).releaseMessage('ACTIVATE_WITH_CONSENT', { version, scriptURL: location.origin + '/sw.js', clientDeadline:Date.now()-1 }, true), shellB.descriptor.generation);
    assert(expired.accepted === false && expired.reason === 'ACTIVATION_LEASE_EXPIRED', 'expired critical-work lease cannot authorize shell activation');
    await page.evaluate(async () => {
      await new Promise<void>(resolve => { void navigator.locks.request('consubov-shell-pointer-v2', async () => { resolve(); await new Promise<void>(release => { (window as any).releasePointerLock = release; }); }); });
    });
    await page.evaluate(version => { (window as any).queuedConsent = (window as any).releaseMessage('ACTIVATE_WITH_CONSENT', { version, scriptURL: location.origin + '/sw.js', clientDeadline: Date.now() + 30 }, true); }, shellB.descriptor.generation);
    await new Promise(resolve => setTimeout(resolve, 80));
    const queuedDenial = await page.evaluate(() => (window as any).queuedConsent);
    await page.evaluate(() => (window as any).releasePointerLock());
    assert(queuedDenial.accepted === false && queuedDenial.reason === 'ACTIVATION_LEASE_EXPIRED', 'native worker rechecks activation deadline after waiting for the shared origin lock');
    const peer = await context.newPage(); await peer.goto(`http://127.0.0.1:${server.port}/`);
    const peerBlocked = await page.evaluate(async version => (window as any).releaseMessage('ACTIVATE_WITH_CONSENT', { version, scriptURL: location.origin + '/sw.js' }, true), shellB.descriptor.generation);
    assert(peerBlocked.accepted === false && peerBlocked.reason === 'OTHER_CLIENTS_OPEN', 'another shell window blocks activation at the consent boundary');
    await peer.close();
    // A second real ServiceWorkerGlobalScope shares native CacheStorage and
    // LockManager, while its cache verification is suspended outside publication.
    publishShell(incompatible); publishShell(shellB);
    await page.evaluate(() => { (window as any).raceRegistration = navigator.serviceWorker.register('/race-sw.js', { scope: '/race-only/' }); });
    await poll(async () => raceReached, 'second worker paused at cache verification');
    await page.evaluate(version => { (window as any).raceActivation = (window as any).releaseMessage('ACTIVATE_WITH_CONSENT', { version, scriptURL: location.origin + '/sw.js' }, true); }, shellB.descriptor.generation);
    await poll(async () => skipReached, 'consented worker paused before native activation');
    resumeRace();
    await poll(() => page.evaluate(async generation => { const pointer = await (await (await caches.open('consubov-release-pointers-v2')).match('/__shell'))!.json(); return pointer.candidate?.generation === generation; }, incompatible.descriptor.generation), 'second worker publishes before consented worker activates');
    resumeSkip();
    const activation = await page.evaluate(() => (window as any).raceActivation);
    assert(activation.type === 'SHELL_ACTIVATION_ACCEPTED', 'verified explicit shell consent accepted after concurrent candidate publication');
    await poll(() => page.evaluate(async generation => { const response = await (await caches.open('consubov-release-pointers-v2')).match('/__shell'); return (await response!.json()).active.generation === generation; }, shellB.descriptor.generation), 'consented shell activation completed');
    const raced = await page.evaluate(async () => (await (await caches.open('consubov-release-pointers-v2')).match('/__shell'))!.json());
    assert(raced.active.generation === shellB.descriptor.generation && raced.previous.generation === shellA.descriptor.generation && raced.candidate.generation === incompatible.descriptor.generation && raced.consentedGeneration === null, 'independent native worker staging preserves consented active and N-1 plus new candidate');
    await page.evaluate(async () => { const registration = await (window as any).raceRegistration; await registration.unregister(); });
    await page.reload(); const activatedTitle = await page.title();
    if (activatedTitle !== 'Shell-B') console.log(name, JSON.stringify(await page.evaluate(async () => ({ title: document.title, pointer: await (await (await caches.open('consubov-release-pointers-v2')).match('/__shell'))!.json(), registration: { active:(await navigator.serviceWorker.getRegistration())?.active?.state, waiting:(await navigator.serviceWorker.getRegistration())?.waiting?.state, controller:navigator.serviceWorker.controller?.state } }))));
    assert(activatedTitle === 'Shell-B', 'consented shell generation served after activation');
    publishShell(incompatible); await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update()); await poll(() => page.evaluate(async generation => { const response = await (await caches.open('consubov-release-pointers-v2')).match('/__shell'); return Boolean(response && (await response.json()).candidate?.generation === generation && !(await navigator.serviceWorker.getRegistration())?.installing); }, incompatible.descriptor.generation), 'incompatible candidate installed');
    const rejected = await page.evaluate(() => (window as any).releaseMessage('VERIFY_WAITING_WORKER', {}, true)); assert(rejected.compatible === false, 'breaking shell protocol blocked by installed modules');
    const denial = await page.evaluate(async version => (window as any).releaseMessage('ACTIVATE_WITH_CONSENT', { version, scriptURL: location.origin + '/sw.js' }, true), incompatible.descriptor.generation); assert(denial.type === 'SHELL_ACTIVATION_BLOCKED', 'forged incompatible consent cannot activate shell');
    await context.setOffline(true); await page.reload(); assert(await page.title() === 'Shell-B', 'previous compatible shell remains operable offline');
    await page.close(); page = await context.newPage(); await page.goto(`http://127.0.0.1:${server.port}/`);
    assert(await page.title() === 'Shell-B', 'cold start after unconsented waiting worker retains previous shell offline');
    assert(await page.evaluate(fixture => (window as any).checkPreservationFixture(fixture), preservation), 'real IndexedDbLocalData snapshot immutable outbox and photo survive all module and shell releases');
    assert(!requests.some(path => /modules\/(escritorio|fabrica)\//.test(path)), 'zero requests for unused modules');
  } catch (error) { result.error = error instanceof Error ? `${error.message}\n${error.stack}` : String(error); }
  finally { resumeSkip(); resumeRace(); results.push(result); await browser.close(); server.stop(true); }
  console.log(`${name}: ${result.passed.length} checks passed${result.error ? '\nFAIL: ' + result.error : ''}`);
}
const run = resolve(root, '.qa/runs', `t05-worker-generations-${new Date().toISOString().replace(/[:.]/g,'-')}`); await mkdir(run, { recursive:true }); const sha = process.env.SOURCE_SHA ?? null; await writeFile(resolve(run,'result.json'), JSON.stringify({ sha, workingTreeDirty:true, results, productionApproval:false }, null,2)); await writeFile(resolve(run,'output.log'), results.map(x=>`${x.browser}: ${x.passed.join('\n')}${x.error ? '\nFAIL: '+x.error : ''}`).join('\n')); console.log(run); if(results.some(x=>x.error)) process.exitCode=1;
