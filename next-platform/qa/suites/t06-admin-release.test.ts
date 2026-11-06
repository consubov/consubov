import { expect, test } from 'bun:test';
import { randomUUID, webcrypto } from 'node:crypto';
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { adminDigest, assertAdminOutput, publishAdmin, type AdminRelease } from '../../apps/admin-global/scripts/admin-asset-publisher';

const root = resolve(import.meta.dir, '../../.qa/tmp', `t06-admin-release-unit-${randomUUID()}`);
const template = await readFile(resolve(import.meta.dir, '../../apps/admin-global/public/sw.js'), 'utf8');
const origin = 'http://127.0.0.1:5174';
const names = ['index.html', 'manifest.webmanifest'];
async function fixture(version: string) {
  const outDir = resolve(root, 'publisher');
  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, 'sw.js'), template);
  await writeFile(resolve(outDir, 'index.html'), `<html>ADM ${version}</html>`);
  await writeFile(resolve(outDir, 'manifest.webmanifest'), '{"name":"ADM"}');
  return { outDir, mode: 'candidate' as const, version, origin, names };
}

test('ADM publication preserves immutable N-1 and selector on interruption/collision; worker template participates in identity', async () => {
  const old = await publishAdmin(await fixture('N-1'));
  const options = await fixture('N');
  const before = await readFile(resolve(options.outDir, 'admin-release.json'), 'utf8');
  await expect(publishAdmin({ ...options, beforeSelect: async () => { throw new Error('interruption'); } })).rejects.toThrow('interruption');
  expect(await readFile(resolve(options.outDir, 'admin-release.json'), 'utf8')).toBe(before);
  const next = await publishAdmin(options);
  expect(next.generation).not.toBe(old.generation);
  expect(await readFile(resolve(options.outDir, old.resourceBase.slice(1), 'index.html'), 'utf8')).toContain('N-1');
  expect(next.workerTemplateSha256).toBe(adminDigest(template));
  await writeFile(resolve(options.outDir, next.resourceBase.slice(1), 'index.html'), 'corrupt');
  await writeFile(resolve(options.outDir, 'sw.js'), template);
  await expect(publishAdmin(options)).rejects.toThrow('integrity');
  expect(JSON.parse(await readFile(resolve(options.outDir, 'admin-release.json'), 'utf8')).generation).toBe(next.generation);
});

test('ADM output validation refuses foreign roots and junctions before any write', async () => {
  await expect(assertAdminOutput(resolve(root, '../../../dist'), 'candidate')).rejects.toThrow('output');
  const target = resolve(root, 'junction-target');
  const link = resolve(root, 'junction');
  await mkdir(target, { recursive: true });
  await symlink(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  await expect(assertAdminOutput(link, 'candidate')).rejects.toThrow('symlink');
  const fixtureOptions = await fixture('mode-isolation');
  await publishAdmin(fixtureOptions);
  await writeFile(resolve(fixtureOptions.outDir, 'sw.js'), template);
  await expect(publishAdmin({ ...fixtureOptions, mode: 'lab' })).rejects.toThrow('separate');
});

// Worker protocol unit fixture only. Real CacheStorage/lifecycle/origin evidence is the separate browser gate.
function storage() {
  const stores = new Map<string, Map<string, Response>>();
  let previous = Promise.resolve();
  const key = (request: string | Request) => new URL(typeof request === 'string' ? request : request.url, origin).href;
  return {
    stores,
    locks: { request: async (_name: string, _options: { signal?: AbortSignal }, operation: () => Promise<unknown>) => {
      const current = previous.then(operation);
      previous = current.then(() => undefined, () => undefined);
      return _options.signal ? Promise.race([current, new Promise((_, reject) => { _options.signal!.addEventListener('abort', () => reject(new Error('Aborted lock wait')), { once: true }); })]) : current;
    } },
    async open(name: string) {
      let store = stores.get(name);
      if (!store) { store = new Map(); stores.set(name, store); }
      return {
        match: async (request: string | Request) => store!.get(key(request))?.clone(),
        put: async (request: string | Request, response: Response) => { store!.set(key(request), response.clone()); },
        delete: async (request: string | Request) => store!.delete(key(request))
      };
    }
  };
}
function worker(release: AdminRelease, caches: ReturnType<typeof storage>, resources: Map<string, string>, options: { corrupt?: boolean; windows?: number; wrongOrigin?: boolean; beforeFetch?: () => Promise<void>; skipWaiting?: () => Promise<void> } = {}) {
  const handlers = new Map<string, (event: any) => void>();
  let skipped = 0;
  const source = { type: 'window', id: 'client-1' };
  const self = {
    location: new URL((options.wrongOrigin ? 'http://127.0.0.1:5187' : origin) + '/sw.js'),
    registration: { scope: `${origin}/` },
    navigator: { locks: caches.locks },
    clients: { matchAll: async () => Array.from({ length: options.windows ?? 1 }, (_, index) => ({ id: `client-${index + 1}`, type: 'window', frameType: 'top-level', url: `${origin}/` })) },
    addEventListener: (type: string, callback: (event: any) => void) => { handlers.set(type, callback); },
    skipWaiting: () => { skipped++; return options.skipWaiting?.() ?? Promise.resolve(); }
  };
  class RelativeRequest extends Request { constructor(input: string, init?: RequestInit) { super(new URL(input, origin), init); } }
  const context = createContext({ self, caches, crypto: webcrypto, Response, Request: RelativeRequest, URL, Uint8Array, Date, console, AbortController, setTimeout, clearTimeout,
    fetch: async (request: Request) => { await options.beforeFetch?.(); return new Response(options.corrupt ? 'corrupt' : resources.get(new URL(request.url, origin).pathname), { status: resources.has(new URL(request.url, origin).pathname) ? 200 : 404 }); } });
  runInContext(template.replace('const ADM_RELEASE = null;', `const ADM_RELEASE = ${JSON.stringify(release)};`), context);
  async function dispatch(type: string, fields: Record<string, unknown> = {}) {
    let pending: Promise<void> | undefined;
    let result: unknown;
    handlers.get(type)?.({ source, ...fields, waitUntil: (value: Promise<void>) => { pending = value; }, ports: [{ postMessage: (value: unknown) => { result = value; } }] });
    await pending;
    return result as any;
  }
  return { dispatch, skipped: () => skipped, handlers, source };
}
function release(version: string) {
  const generation = adminDigest(version);
  const resourceBase = `/admin-releases/candidate/${generation}/`;
  const resources = new Map<string, string>();
  const assets = names.map(path => { const body = path === 'index.html' ? `ADM ${version}` : '{"name":"ADM"}'; const url = resourceBase + path; resources.set(url, body); return { path: `/${path}`, url, sha256: adminDigest(body), bytes: Buffer.byteLength(body) }; });
  return { descriptor: { schemaVersion: 1, mode: 'candidate', origin, generation, version, workerTemplateSha256: adminDigest(template), resourceBase, assets } as AdminRelease, resources };
}
async function pointers(caches: ReturnType<typeof storage>) { return (await (await caches.open('consubov-adm-candidate-state')).match('/__adm_release_state__'))?.json(); }

test('ADM cold autoactivation preserves active N-1; consent alone promotes verified complete N and retains prior cache', async () => {
  const caches = storage();
  const old = release('N-1');
  const first = worker(old.descriptor, caches, old.resources);
  await first.dispatch('install'); await first.dispatch('activate');
  const next = release('N');
  const second = worker(next.descriptor, caches, next.resources);
  await second.dispatch('install'); await second.dispatch('activate');
  expect((await pointers(caches)).active.generation).toBe(old.descriptor.generation);
  expect(second.skipped()).toBe(0);
  const verified = await second.dispatch('message', { data: { type: 'ADM_VERIFY_UPDATE' } });
  expect(verified.canActivate).toBe(true);
  const ack = await second.dispatch('message', { data: { type: 'ADM_ACTIVATE_WITH_CONSENT', generation: next.descriptor.generation, scriptURL: `${origin}/sw.js`, clientDeadline: Date.now() + 20000 } });
  expect(ack.accepted).toBe(true);
  expect(second.skipped()).toBe(1);
  expect((await pointers(caches)).active.generation).toBe(next.descriptor.generation);
  expect((await pointers(caches)).previous.generation).toBe(old.descriptor.generation);
  expect(caches.stores.has(`consubov-adm-candidate-release-${old.descriptor.generation}`)).toBe(true);
});

test('ADM corruption, expired consent, multiple windows and wrong origin fail closed without changing old active', async () => {
  const caches = storage();
  const old = release('old'); const first = worker(old.descriptor, caches, old.resources);
  await first.dispatch('install'); await first.dispatch('activate');
  const next = release('new');
  await expect(worker(next.descriptor, caches, next.resources, { corrupt: true }).dispatch('install')).rejects.toThrow('Incomplete');
  expect((await pointers(caches)).active.generation).toBe(old.descriptor.generation);
  const second = worker(next.descriptor, caches, next.resources); await second.dispatch('install');
  const message = { type: 'ADM_ACTIVATE_WITH_CONSENT', generation: next.descriptor.generation, scriptURL: `${origin}/sw.js`, clientDeadline: Date.now() - 1 };
  expect((await second.dispatch('message', { data: message })).accepted).toBe(false);
  for (const clientDeadline of [Date.now() + 20000.5, Number.MAX_SAFE_INTEGER + 1, Infinity, '30000']) {
    expect((await second.dispatch('message', { data: { ...message, clientDeadline } })).accepted).toBe(false);
  }
  const multiple = worker(next.descriptor, caches, next.resources, { windows: 2 });
  expect((await multiple.dispatch('message', { data: { ...message, clientDeadline: Date.now() + 20000 } })).accepted).toBe(false);
  await expect(worker(next.descriptor, caches, next.resources, { wrongOrigin: true }).dispatch('install')).rejects.toThrow('origin');
  expect((await pointers(caches)).active.generation).toBe(old.descriptor.generation);
});

test('two worker realms serialize stage B with consent A without reverting active A or dropping candidate B', async () => {
  const caches = storage();
  const old = release('initial'); const initial = worker(old.descriptor, caches, old.resources);
  await initial.dispatch('install'); await initial.dispatch('activate');
  const a = release('candidate-A'); const workerA = worker(a.descriptor, caches, a.resources);
  await workerA.dispatch('install');
  let resume!: () => void;
  let entered!: () => void;
  const paused = new Promise<void>(resolve => { resume = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  const b = release('candidate-B');
  const workerB = worker(b.descriptor, caches, b.resources, { beforeFetch: async () => { entered(); await paused; } });
  const installB = workerB.dispatch('install');
  await started;
  const ack = await workerA.dispatch('message', { data: { type: 'ADM_ACTIVATE_WITH_CONSENT', generation: a.descriptor.generation, scriptURL: `${origin}/sw.js`, clientDeadline: Date.now() + 20000 } });
  expect(ack.accepted).toBe(true);
  resume(); await installB;
  const final = await pointers(caches);
  expect(final.active.generation).toBe(a.descriptor.generation);
  expect(final.previous.generation).toBe(old.descriptor.generation);
  expect(final.candidate.generation).toBe(b.descriptor.generation);
});

test('ADM fetch never intercepts API, other origins, module URLs or bearer requests', async () => {
  const caches = storage(); const next = release('fetch'); const runtime = worker(next.descriptor, caches, next.resources);
  await runtime.dispatch('install'); await runtime.dispatch('activate');
  for (const url of [`${origin}/api/v1/auth/login`, 'http://127.0.0.1:5187/', `${origin}/modules/capataz/module.js`]) {
    let intercepted = false;
    runtime.handlers.get('fetch')?.({ request: new Request(url), respondWith: () => { intercepted = true; } });
    expect(intercepted).toBe(false);
  }
  let intercepted = false;
  runtime.handlers.get('fetch')?.({ request: new Request(`${origin}/assets/a.js`, { headers: { authorization: 'Bearer test' } }), respondWith: () => { intercepted = true; } });
  expect(intercepted).toBe(false);
});

for (const failed of [false, true]) test(`ADM handover releases shared lock for activate/B installation and preserves candidate B on ${failed ? 'failed' : 'successful'} skipWaiting`, async () => {
  const caches = storage(); const old = release(`handover-old-${failed}`); const first = worker(old.descriptor, caches, old.resources);
  await first.dispatch('install'); await first.dispatch('activate');
  let resolveActivation!: () => void;
  let rejectActivation!: (error: Error) => void;
  let invoked!: () => void;
  const started = new Promise<void>(resolve => { invoked = resolve; });
  const activation = new Promise<void>((resolve, reject) => { resolveActivation = resolve; rejectActivation = reject; });
  const a = release(`handover-A-${failed}`);
  const workerA = worker(a.descriptor, caches, a.resources, { skipWaiting: () => { invoked(); return activation; } });
  await workerA.dispatch('install');
  const consent = workerA.dispatch('message', { data: { type: 'ADM_ACTIVATE_WITH_CONSENT', generation: a.descriptor.generation, scriptURL: `${origin}/sw.js`, clientDeadline: Date.now() + 20000 } });
  await started;
  // Native lifecycle needs this same lock. Awaiting skipWaiting inside it would deadlock here.
  await workerA.dispatch('activate');
  const b = release(`handover-B-${failed}`); const workerB = worker(b.descriptor, caches, b.resources);
  await workerB.dispatch('install');
  expect((await pointers(caches)).candidate.generation).toBe(b.descriptor.generation);
  if (failed) rejectActivation(new Error('Native handover failed')); else resolveActivation();
  const ack = await consent;
  expect(ack.accepted).toBe(!failed);
  const current = await pointers(caches);
  expect(current.active.generation).toBe(failed ? old.descriptor.generation : a.descriptor.generation);
  expect(current.candidate.generation).toBe(b.descriptor.generation);
  expect(current.previous?.generation ?? null).toBe(failed ? null : old.descriptor.generation);
});

test('ADM consent expires while another worker owns the state lock and cannot promote later', async () => {
  const caches = storage(); const old = release('lock-initial'); const first = worker(old.descriptor, caches, old.resources);
  await first.dispatch('install'); await first.dispatch('activate');
  const next = release('lock-candidate'); const second = worker(next.descriptor, caches, next.resources); await second.dispatch('install');
  let resume!: () => void;
  const hold = caches.locks.request('state', {}, () => new Promise<void>(resolve => { resume = resolve; }));
  await Promise.resolve();
  const ack = await second.dispatch('message', { data: { type: 'ADM_ACTIVATE_WITH_CONSENT', generation: next.descriptor.generation, scriptURL: `${origin}/sw.js`, clientDeadline: Date.now() + 30 } });
  expect(ack.accepted).toBe(false);
  resume(); await hold;
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(second.skipped()).toBe(0);
  expect((await pointers(caches)).active.generation).toBe(old.descriptor.generation);
});
