import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { captureGitBaseline, captureSourceManifest, canonicalRepository, createOwnedQaDirectory, nextPlatformDir as root } from '../harness/workspace-baseline';
import { createProductionHandler } from './serve-production-t03';

// This observes actual built App documents. Device names describe emulation,
// never installation, physical hardware, assistive technology or acceptance.
const run = createOwnedQaDirectory('t07-devices', 'runs');
const owned = createOwnedQaDirectory('t07-devices');
const output: string[] = [], cases: any[] = [];
const log = (message: string) => { output.push(message); console.info(message); };
const hash = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
async function inventory(directory: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink());
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) for (const [name, digest] of Object.entries(await inventory(path))) files[`${entry.name}/${name}`] = digest;
    else files[entry.name] = hash(await readFile(path));
  }
  return files;
}
async function until(read: () => Promise<any>, predicate: (value: any) => boolean, label: string) {
  const end = Date.now() + 45000;
  while (Date.now() < end) { const value = await read(); if (predicate(value)) return value; await Bun.sleep(100); }
  throw new Error(`Timed out: ${label}`);
}
async function domAudit(frame: any) {
  return frame.evaluate(() => {
    const visible = (element: Element) => { const r = element.getBoundingClientRect(); const s = getComputedStyle(element); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const identify = (element: Element) => ({ tag: element.tagName.toLowerCase(), id: element.id, role: element.getAttribute('role'), text: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 100) });
    const controls = Array.from(document.querySelectorAll('button,a[href],input:not([type=hidden]),textarea,select,[role=button],[role=tab]')).filter(visible);
    const dimensions = controls.map(element => { const r = element.getBoundingClientRect(); return { ...identify(element), width: r.width, height: r.height }; });
    const unnamed = controls.filter(element => {
      const input = element as HTMLInputElement;
      return !(element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || input.labels?.length || (element.tagName === 'INPUT' && ['submit', 'button'].includes(input.type) && input.value) || (element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA' && element.tagName !== 'SELECT' && element.textContent?.trim()));
    }).map(identify);
    const imagesWithoutAlt = Array.from(document.querySelectorAll('img:not([alt])')).filter(visible).map(identify);
    const iframesWithoutTitle = Array.from(document.querySelectorAll('iframe:not([title]),iframe[title=""]')).filter(visible).map(identify);
    const duplicateIds = [...new Set(Array.from(document.querySelectorAll('[id]')).map(element => element.id))].filter(id => document.querySelectorAll('[id]').length && Array.from(document.querySelectorAll('[id]')).filter(element => element.id === id).length > 1);
    const overflow = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) - document.documentElement.clientWidth;
    const overflowElements = overflow > 1 ? Array.from(document.querySelectorAll('body *')).filter(visible).filter(element => { const r = element.getBoundingClientRect(); return r.right > document.documentElement.clientWidth + 1 || r.left < -1; }).slice(0, 20).map(identify) : [];
    return { title: document.title, lang: document.documentElement.lang, viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth, horizontalOverflow: { status: overflow <= 1 ? 'PASS' : 'FAIL', pixels: overflow, elements: overflowElements }, accessibleNames: { status: unnamed.length ? 'FAIL' : 'PASS', elements: unnamed }, imageAlt: { status: imagesWithoutAlt.length ? 'FAIL' : 'PASS', elements: imagesWithoutAlt }, iframeTitles: { status: iframesWithoutTitle.length ? 'FAIL' : 'PASS', elements: iframesWithoutTitle }, duplicateIds: { status: duplicateIds.length ? 'FAIL' : 'PASS', ids: duplicateIds }, touch24: { status: dimensions.some(r => r.width < 24 || r.height < 24) ? 'FAIL' : 'PASS', elements: dimensions.filter(r => r.width < 24 || r.height < 24), criterion: 'Raw geometry 24 CSS px; spacing exceptions require manual review' }, touch44Advisory: dimensions.filter(r => r.width < 44 || r.height < 44), controlCount: controls.length };
  });
}
async function resourceMetrics(frame: any) {
  return frame.evaluate(() => ({ navigation: performance.getEntriesByType('navigation').map((e: any) => ({ duration: e.duration, domContentLoadedEventEnd: e.domContentLoadedEventEnd, loadEventEnd: e.loadEventEnd, transferSize: e.transferSize, encodedBodySize: e.encodedBodySize, decodedBodySize: e.decodedBodySize })), resources: performance.getEntriesByType('resource').map((e: any) => ({ name: e.name.replace(location.origin, ''), initiatorType: e.initiatorType, duration: e.duration, transferSize: e.transferSize, encodedBodySize: e.encodedBodySize, decodedBodySize: e.decodedBodySize })), marks: performance.getEntriesByType('mark').map(e => ({ name: e.name, startTime: e.startTime })), note: 'Observed local browser timing; zero size can mean cache/cross-origin timing restrictions. No SLA, score or physical-device inference.' }));
}
async function keyboardAudit(page: any, frame: any, scope: 'shell' | 'module') {
  const target = scope === 'shell' ? page : frame;
  await target.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); document.body.tabIndex = -1; document.body.focus(); });
  const trace: any[] = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    trace.push(await target.evaluate(() => { const element = document.activeElement as HTMLElement | null; const style = element ? getComputedStyle(element) : null; return { tag: element?.tagName, id: element?.id, role: element?.getAttribute('role'), text: (element?.getAttribute('aria-label') || element?.textContent || '').trim().slice(0, 80), outlineStyle: style?.outlineStyle, outlineWidth: style?.outlineWidth }; }));
  }
  return { status: trace.some(item => !['BODY', 'HTML', 'IFRAME'].includes(item.tag)) ? 'PASS' : 'FAIL', trace, limitation: 'Basic real Tab reachability only; no screen-reader or complete focus-trap certification.' };
}

const before = { git: captureGitBaseline(), source: captureSourceManifest() };
let server: ReturnType<typeof Bun.serve> | undefined, paths: any, error: string | undefined;
let artifactBefore: any, artifactAfter: any;
let axeSource: string | undefined, axeResolved: string | undefined;
const axeCandidates = [root, canonicalRepository()];
for (const directory of axeCandidates) {
  try { const require = createRequire(resolve(directory, 'package.json')); axeResolved = require.resolve('axe-core/axe.min.js'); axeSource = await readFile(axeResolved, 'utf8'); break; } catch { /* Absent dependencies are reported, never installed. */ }
}
async function axeAudit(target: any) {
  if (!axeSource) return { status: 'NAO_EXECUTADO', reason: 'axe-core not locally resolvable; no dependency installed' };
  try {
    if (!await target.evaluate(() => Boolean((window as any).axe))) await target.evaluate(axeSource);
    return await target.evaluate(async () => {
      const audit = await (window as any).axe.run(document, { iframes: false });
      return { status: audit.violations.length ? 'FAIL' : 'PASS', violations: audit.violations, incomplete: audit.incomplete, passes: audit.passes.map((v: any) => v.id), version: audit.testEngine.version };
    });
  } catch (error) { return { status: 'BLOQUEADO', error: String(error), reason: 'Actual document evaluated with product CSP intact' }; }
}
try {
  const shellRoot = process.env.T07_SHELL_ROOT, moduleRoot = process.env.T07_MODULE_ROOT;
  let origin = process.env.T07_ORIGIN;
  if (!origin) {
    assert(shellRoot && moduleRoot, 'Provide T07_ORIGIN or frozen T07_SHELL_ROOT + T07_MODULE_ROOT');
    artifactBefore = { shell: await inventory(shellRoot), modules: await inventory(moduleRoot) };
    server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: createProductionHandler({ shellRoot, moduleRoot }) });
    origin = `http://127.0.0.1:${server.port}`;
  }
  assert(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Local owned QA origins only');
  assert(new URL(origin).port !== '5187', 'Do not use existing live QA server');
  const { chromium, webkit } = await import(pathToFileURL(resolve(root, 'packages/local-data/node_modules/@playwright/test/index.mjs')).href);
  const { createPersistentProfilePaths } = await import(pathToFileURL(resolve(import.meta.dir, 'persistent-profile-path.mjs')).href);
  paths = await createPersistentProfilePaths(owned.path);
  for (const [engine, browser] of [['chromium', chromium], ['webkit', webkit]] as const) {
    for (const device of [{ name: 'desktop', width: 1366, height: 900, touch: false }, { name: 'mobile', width: 390, height: 844, touch: true }, { name: 'tablet', width: 820, height: 1180, touch: true }]) {
      for (const profile of ['capataz', 'gerente', 'escritorio', 'fabrica']) {
        const result: any = { engine, device, profile, mode: 'EMULATED_VIEWPORT', consoleErrors: [], pageErrors: [], failedRequests: [], httpErrors: [], apiGrants: [], tabs: [] }; cases.push(result);
        log(`[RUN] ${engine}/${device.name}/${profile}`);
        const context = await browser.launchPersistentContext(paths.browserPath(resolve(owned.path, `${engine}-${device.name}-${profile}`)), { headless: true, viewport: { width: device.width, height: device.height }, hasTouch: device.touch, isMobile: device.touch, serviceWorkers: 'allow' });
        try {
          await context.route('**/*', (route: any) => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort('blockedbyclient'));
          const page = await context.newPage();
          page.on('console', (message: any) => { if (message.type() === 'error') result.consoleErrors.push({ text: message.text(), location: message.location() }); });
          page.on('pageerror', (error: Error) => result.pageErrors.push(error.message));
          page.on('requestfailed', (request: any) => result.failedRequests.push({ url: request.url(), failure: request.failure() }));
          page.on('response', (response: any) => { if (response.status() >= 400) result.httpErrors.push({ url: response.url(), status: response.status() }); if (/\/api\/v1\/.*(?:login|grant|context)/.test(response.url())) result.apiGrants.push({ path: new URL(response.url()).pathname, status: response.status() }); });
          await page.goto(origin + '/#/fazenda/' + profile);
          await page.locator('#login-email').fill(`${profile}.lab@consubov.local`);
          await page.locator('#login-password').fill('lab@123456');
          const start = performance.now();
          await page.evaluate(() => performance.mark('t07-login-submit'));
          await page.getByRole('button', { name: /Entrar no Sistema/i }).click();
          const choose = page.getByRole('button', { name: /Acessar Este Contexto/i });
          const readySelector = profile === 'capataz' ? '#cocho-input-notes' : `[data-testid="${profile}-module-view"]`;
          await Promise.race([choose.waitFor({ state: 'visible', timeout: 45000 }), page.frameLocator('iframe').locator(readySelector).waitFor({ state: 'visible', timeout: 45000 })]);
          if (await choose.isVisible()) await choose.click();
          await page.frameLocator('iframe').locator(readySelector).waitFor({ state: 'visible', timeout: 45000 });
          await until(() => page.evaluate(async (profile: string) => { const response = await (await caches.open('consubov-release-pointers-v2')).match('/__modules/' + profile); return response ? response.json() : null; }, profile), value => value?.activeHealthy && !value.candidate, 'healthy actual module');
          result.loginToHealthyReadyMs = performance.now() - start;
          await page.evaluate(() => performance.mark('t07-module-healthy-ready'));
          const frame = await page.locator('iframe').elementHandle().then((element: any) => element.contentFrame());
          assert(frame, 'Actual module iframe not found');
          result.actualIframe = { url: frame.url(), origin: await frame.evaluate(() => location.origin), sandbox: await page.locator('iframe').getAttribute('sandbox') };
          result.shell = await domAudit(page); result.module = await domAudit(frame);
          result.keyboard = { shell: await keyboardAudit(page, frame, 'shell'), module: await keyboardAudit(page, frame, 'module') };
          result.axe = {};
          for (const [name, target] of [['shell', page], ['module', frame]] as const) {
            result.axe[name] = await axeAudit(target);
          }
          for (const id of await frame.locator('[role=tab]').evaluateAll((tabs: Element[]) => tabs.map(tab => tab.id))) {
            if (!id) continue;
            const started = performance.now();
            await frame.locator(`[id="${id}"]`).click();
            await frame.locator(`[id="${id}"][aria-selected=true]`).waitFor();
            await frame.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
            const navigationToPaintMs = performance.now() - started;
            result.tabs.push({ id, navigationToPaintMs, audit: await domAudit(frame), axe: await axeAudit(frame) });
          }
          result.metrics = { shell: await resourceMetrics(page), module: await resourceMetrics(frame) };
          result.errors = { status: [result.consoleErrors, result.pageErrors, result.failedRequests, result.httpErrors].some(items => items.length) ? 'FAIL' : 'PASS', allowlist: [] };
          result.authentication = { status: result.apiGrants.some((entry: any) => entry.status === 200 && entry.path.endsWith('/login')) ? 'PASS' : 'FAIL' };
          result.execution = 'PASS';
        } catch (failure) { result.execution = 'FAIL'; result.failure = String(failure); log(`[FAIL] ${String(failure)}`); }
        finally { await context.close(); await writeFile(resolve(run.path, 'partial.json'), JSON.stringify(cases, null, 2)); }
      }
    }
  }
  if (shellRoot && moduleRoot) artifactAfter = { shell: await inventory(shellRoot), modules: await inventory(moduleRoot) };
} catch (failure) { error = String(failure); log(error); }
finally {
  server?.stop(true); if (paths) await paths.dispose();
  const after = { git: captureGitBaseline(), source: captureSourceManifest() };
  const sourceUnchanged = before.source.sha256 === after.source.sha256;
  const result = { runId: run.path.split(/[\\/]/).at(-1), startedBaseline: before, finalBaseline: after, sourceUnchanged, finalCommit: after.git.head, artifactsUnchanged: artifactBefore ? JSON.stringify(artifactBefore) === JSON.stringify(artifactAfter) : null, artifactBefore, artifactAfter, axeResolved, cases, error, physicalDevices: 'NAO_EXECUTADO', installedAppHardware: 'NAO_EXECUTADO', assistiveTechnology: 'NAO_EXECUTADO', independentQa: 'NAO_EXECUTADO', production: 'NO_GO', scope: 'Local real built App on emulated viewports; no latency/CPU throttling; basic geometry/name/keyboard audit and optional axe; all raw errors retained.' };
  await writeFile(resolve(run.path, 'result.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
  log(`Evidence ${run.path}; sourceUnchanged=${sourceUnchanged}; cases=${cases.length}`);
  await writeFile(resolve(run.path, 'output.log'), output.join('\n') + '\n', { flag: 'wx' });
  // Browser profiles remain inside the owned temporary directory for inspection.
  process.exitCode = error || !sourceUnchanged || cases.length !== 24 || cases.some(item => item.execution !== 'PASS') ? 1 : 0;
}
