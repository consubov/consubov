import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';
import type { PinnedModuleGeneration } from '../src/generation';
const origin = 'https://app.test';
const source = readFileSync(resolve(import.meta.dir, '../../../apps/fazenda/shell/public/sw.js'), 'utf8');
const bytes = (s: string) => new TextEncoder().encode(s);
const digest = async (s: string) => Buffer.from(await webcrypto.subtle.digest('SHA-256', bytes(s))).toString('hex');
const key = (input: RequestInfo | URL) => new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, origin).href;
class Cache {
  rows = new Map<string, Response>();
  constructor(private owner: Storage, public name: string) {}
  async match(input: RequestInfo | URL) { await this.owner.beforeMatch?.(this.name, key(input)); return this.rows.get(key(input))?.clone(); }
  async put(input: RequestInfo | URL, response: Response) { if (this.owner.failPut?.(this.name, key(input))) throw new DOMException('Test quota', 'QuotaExceededError'); this.rows.set(key(input), response.clone()); }
}
class Storage {
  beforeMatch?: (name: string, url: string) => Promise<void>;
  private lockTails = new Map<string, Promise<unknown>>();
  locks = { request: async (name: string, _options: unknown, operation: () => unknown) => {
    const next = (this.lockTails.get(name) ?? Promise.resolve()).catch(() => {}).then(operation);
    this.lockTails.set(name, next);
    return next;
  } };
  rows = new Map<string, Cache>(); failPut?: (name: string, url: string) => boolean;
  async open(name: string) { let c = this.rows.get(name); if (!c) { c = new Cache(this, name); this.rows.set(name, c); } return c; }
  async keys() { return [...this.rows.keys()]; }
  async delete(name: string) { return this.rows.delete(name); }
}
async function artifact(id: string, version: string, legacy = false) {
  const resources = { 'index.html': '<!doctype html><script src="./module.js"></script>', 'module.js': `window.fixtureVersion=${JSON.stringify(version)};` };
  const assets = await Promise.all(Object.entries(resources).map(async ([url, content]) => ({ url, bytes: bytes(content).length, sha256: await digest(content), integrity: `sha256-${Buffer.from(await webcrypto.subtle.digest('SHA-256', bytes(content))).toString('base64')}` })));
  const manifest = { moduleId: id, profileId: id, version, protocolVersion: 1, apiVersions: ['1'], entry: 'index.html', assets, ...(!legacy ? { localDataSchemaVersion: 2, capabilities: ['local-data.read', 'local-data.write'], dependencies: [] } : {}) };
  const raw = JSON.stringify(manifest); const generation = await digest(raw); const root = legacy ? `/modules/${id}/current/` : `/modules/${id}/releases/${generation}/`;
  return { id, manifest, raw, generation, root, resources, legacy };
}
async function shell(version: string, protocols = [1]) {
  const resources = { '/index.html': `<!doctype html><title>${version}</title>`, '/manifest.webmanifest': '{"name":"Fixture"}', '/assets/shell.js': `window.shellVersion=${JSON.stringify(version)};` };
  const manifest = JSON.stringify({ assets: await Promise.all(Object.entries(resources).map(async ([url, content]) => ({ url, bytes: bytes(content).length, sha256: await digest(content) }))) });
  const generation = await digest(manifest); const resourceBase = `/shell-releases/${generation}/`;
  return { manifest, resources, descriptor: { generation, manifestUrl: resourceBase + 'shell-assets.json', manifestSha256: generation, resourceBase, protocolVersions: protocols, apiVersions: ['1'] } };
}
class Harness {
  storage = new Storage(); routes = new Map<string, string>(); requests: string[] = []; skipped = 0;
  skipWaitingBarrier?: () => Promise<void>;
  fetchBarrier?: (path: string) => Promise<void>;
  clients = [{ id: 'authorized', url: origin + '/app' }]; matchDelay = 0;
  handlers = new Map<string, (event: any) => void>();
  constructor(release: unknown = null, storage?: Storage, lockAvailable = true) {
    if (storage) this.storage = storage;
    const self = { navigator: { locks: lockAvailable ? this.storage.locks : undefined }, location: { origin, href: origin + '/sw.js' }, registration: { active: null, waiting: {} }, clients: { get: async (id: string) => id === 'authorized' ? { url: origin + '/app' } : { url: 'https://foreign.test' }, matchAll: async () => { if (this.matchDelay) await new Promise(resolve => setTimeout(resolve, this.matchDelay)); return this.clients; }, claim: async () => undefined }, skipWaiting: async () => { this.skipped++; await this.skipWaitingBarrier?.(); }, addEventListener: (type: string, callback: (event: any) => void) => this.handlers.set(type, callback) };
    const fetcher = async (input: RequestInfo | URL) => { const path = new URL(key(input)).pathname; this.requests.push(path); await this.fetchBarrier?.(path); const content = this.routes.get(path); return content === undefined ? new Response('missing', { status: 404 }) : new Response(content); };
    new Function('self', 'caches', 'fetch', 'crypto', 'Response', 'URL', 'TextEncoder', 'TextDecoder', 'btoa', source.replace('const SHELL_RELEASE = null;', `const SHELL_RELEASE = ${JSON.stringify(release)};`))(self, this.storage, fetcher, webcrypto, Response, URL, TextEncoder, TextDecoder, (s: string) => Buffer.from(s, 'binary').toString('base64'));
  }
  publish(a: Awaited<ReturnType<typeof artifact>>) {
    this.routes.set(`/modules/${a.id}/current/module.json`, a.legacy ? a.raw : JSON.stringify({ schemaVersion: 2, moduleId: a.id, generation: a.generation, releaseUrl: a.root + 'module.json' }));
    this.routes.set(a.root + 'module.json', a.raw);
    for (const [url, content] of Object.entries(a.resources)) this.routes.set(a.root + url, content);
  }
  publishShell(s: Awaited<ReturnType<typeof shell>>) { this.routes.set(s.descriptor.manifestUrl, s.manifest); for (const [url, content] of Object.entries(s.resources)) this.routes.set(s.descriptor.resourceBase + url.slice(1), content); }
  async lifecycle(type: string) { let promise: Promise<void> | undefined; this.handlers.get(type)!({ waitUntil: (p: Promise<void>) => { promise = p; } }); await promise; }
  async message(type: string, rest: Record<string, unknown> = {}, client = 'authorized') { let promise: Promise<void> | undefined; let result: any; this.handlers.get('message')!({ data: { type, ...(type === 'ACTIVATE_WITH_CONSENT' ? { clientDeadline: Date.now() + 10000 } : {}), ...rest }, source: { id: client }, ports: [{ postMessage: (r: unknown) => { result = r; } }], waitUntil: (p: Promise<void>) => { promise = p; } }); await promise; return result; }
  async pointer(path: string) { return (await (await this.storage.open('consubov-release-pointers-v2')).match(path))?.json(); }
  async prepare(id: string): Promise<PinnedModuleGeneration> { const response = await this.message('PROVISION_AUTHORIZED_MODULE', { moduleId: id }); if (!response.complete) throw new Error('prepare rejected'); return response.descriptor; }
  async healthy(d: PinnedModuleGeneration) { return this.message('MARK_MODULE_HEALTHY', d as unknown as Record<string, unknown>); }
}

describe('durable independent release generations', () => {
  it('rejects unsafe asset lists and explicit incompatible legacy declarations before downloading assets', async () => {
    const a = await artifact('capataz', '1.0.0', true);
    for (const overrides of [
      { assets: [...a.manifest.assets, a.manifest.assets[0]] },
      { assets: [{ ...a.manifest.assets[0], url: '../other.js' }] },
      { assets: [{ ...a.manifest.assets[0], bytes: 33 * 1024 * 1024 }] },
      { assets: Array(17).fill(a.manifest.assets[0]) },
      { localDataSchemaVersion: 99 }, { dependencies: ['unprovisioned-module'] }, { capabilities: ['sql.admin'] }
    ]) {
      const h = new Harness(); h.routes.set('/modules/capataz/current/module.json', JSON.stringify({ ...a.manifest, ...overrides }));
      expect((await h.message('PROVISION_AUTHORIZED_MODULE', { moduleId: 'capataz' })).complete).toBe(false);
      expect(h.requests).toEqual(['/modules/capataz/current/module.json']);
      expect((await h.storage.keys()).filter(name => name.startsWith('consubov-module-capataz-'))).toHaveLength(0);
    }
  });
  it('stages immutable complete bytes before promotion and pins concurrent generations independently', async () => {
    const h = new Harness(); const a = await artifact('capataz', '1.0.0'); h.publish(a); const first = await h.prepare('capataz');
    expect((await h.pointer('/__modules/capataz')).activeHealthy).toBeNull();
    expect((await h.healthy(first)).complete).toBe(true);
    const b = await artifact('capataz', '1.1.0'); h.publish(b); const next = await h.prepare('capataz');
    expect((await h.pointer('/__modules/capataz')).activeHealthy.generation).toBe(a.generation);
    expect(await (await (await h.storage.open(first.cacheName)).match(first.resourceBase + 'module.js'))?.text()).toContain('1.0.0');
    expect(await (await (await h.storage.open(next.cacheName)).match(next.resourceBase + 'module.js'))?.text()).toContain('1.1.0');
    expect((await h.healthy(next)).complete).toBe(true);
    expect((await h.pointer('/__modules/capataz')).previousHealthy.generation).toBe(a.generation);
  });
  it('serializes independent worker module mutations while unrelated profiles remain available', async () => {
    const firstWorker = new Harness(); const a = await artifact('capataz', '1.0.0'); firstWorker.publish(a); const first = await firstWorker.prepare('capataz'); await firstWorker.healthy(first);
    const b = await artifact('capataz', '2.0.0'); firstWorker.publish(b); const candidate = await firstWorker.prepare('capataz');
    const otherWorker = new Harness(null, firstWorker.storage);
    const c = await artifact('capataz', '3.0.0'); firstWorker.publish(c);
    let reached!: () => void; let release!: () => void;
    const blocked = new Promise<void>(resolve => { reached = resolve; }); const resume = new Promise<void>(resolve => { release = resolve; });
    firstWorker.fetchBarrier = async path => { if (path === c.root + 'module.js') { reached(); await resume; } };
    const staging = firstWorker.prepare('capataz'); await blocked;
    let settled = false; const promotion = otherWorker.healthy(candidate).then(result => { settled = true; return result; });
    const gerente = await artifact('gerente', '1.0.0'); otherWorker.publish(gerente); await otherWorker.healthy(await otherWorker.prepare('gerente'));
    expect(settled).toBe(false);
    release(); const latest = await staging;
    expect((await promotion).complete).toBe(false);
    const state = await firstWorker.pointer('/__modules/capataz');
    expect(state.activeHealthy.cacheName).toBe(first.cacheName);
    expect(state.candidate.cacheName).toBe(latest.cacheName);
    expect((await firstWorker.pointer('/__modules/gerente')).activeHealthy.generation).toBe(gerente.generation);
  });
  it('retains healthy N-1 on asset404, manifest corruption, incompatibility, and cache quota', async () => {
    for (const fault of ['404', 'manifest', 'compatibility', 'quota']) {
      const h = new Harness(); const a = await artifact('capataz', '1.0.0'); h.publish(a); const first = await h.prepare('capataz'); await h.healthy(first);
      const b = await artifact('capataz', '2.0.0'); h.publish(b);
      if (fault === '404') h.routes.delete(b.root + 'module.js');
      if (fault === 'manifest') h.routes.set(b.root + 'module.json', b.raw + ' ');
      if (fault === 'compatibility') { const invalid = { ...b.manifest, protocolVersion: 2 }; h.routes.set(`/modules/capataz/current/module.json`, JSON.stringify(invalid)); }
      if (fault === 'quota') h.storage.failPut = name => name.startsWith('consubov-module-capataz-') && name !== first.cacheName;
      const recovered = await h.prepare('capataz'); expect(recovered.generation).toBe(a.generation);
      expect((await h.pointer('/__modules/capataz')).activeHealthy.cacheName).toBe(first.cacheName);
      expect((await h.storage.keys()).filter(x => x.startsWith('consubov-module-capataz-'))).toEqual([first.cacheName]);
    }
  });
  it('automatically restores the explicit previous pointer if the current cache becomes corrupted', async () => {
    const h = new Harness(); const a = await artifact('capataz', '9.0.0'); h.publish(a); const first = await h.prepare('capataz'); await h.healthy(first);
    const b = await artifact('capataz', '10.0.0'); h.publish(b); const next = await h.prepare('capataz'); await h.healthy(next);
    await (await h.storage.open(next.cacheName)).put(next.resourceBase + 'module.js', new Response('corrupt'));
    h.routes.clear(); expect((await h.prepare('capataz')).generation).toBe(a.generation);
    expect((await h.pointer('/__modules/capataz')).activeHealthy.generation).toBe(a.generation);
  });
  it('rolls back runtime failure without changing another module cache and rejects stale health acknowledgements', async () => {
    const h = new Harness(); const g = await artifact('gerente', '1.0.0'); h.publish(g); const gerente = await h.prepare('gerente'); await h.healthy(gerente);
    const a = await artifact('capataz', '1.0.0'); h.publish(a); const first = await h.prepare('capataz'); await h.healthy(first);
    const b = await artifact('capataz', '2.0.0'); h.publish(b); const next = await h.prepare('capataz');
    const c = await artifact('capataz', '3.0.0'); h.publish(c); const latest = await h.prepare('capataz');
    expect((await h.healthy(next)).complete).toBe(false);
    await h.healthy(latest);
    const rolled = await h.message('ROLLBACK_MODULE', latest as unknown as Record<string, unknown>);
    expect(rolled.descriptor.generation).toBe(first.generation);
    expect((await h.pointer('/__modules/gerente')).activeHealthy.cacheName).toBe(gerente.cacheName);
    expect(await (await (await h.storage.open(gerente.cacheName)).match(gerente.resourceBase + 'module.js'))?.text()).toContain('1.0.0');
  });
  it('adapts legacy v1 cache pointers explicitly and rejects foreign clients without any download', async () => {
    const h = new Harness(); const a = await artifact('fabrica', '0.1.0', true); const oldName = 'consubov-module-fabrica-legacy'; const cache = await h.storage.open(oldName);
    await cache.put(a.root + 'module.json', new Response(a.raw)); for (const [url, content] of Object.entries(a.resources)) await cache.put(a.root + url, new Response(content));
    await (await h.storage.open('consubov-module-pointers-v1')).put('/__module_cache/fabrica', new Response(JSON.stringify({ cacheName: oldName, manifest: a.manifest })));
    const legacy = await h.prepare('fabrica'); expect(legacy.legacy).toBe(true); expect(legacy.health).toBe('healthy'); expect(legacy.cacheName).toBe(oldName);
    const before = h.requests.length; expect((await h.message('PROVISION_AUTHORIZED_MODULE', { moduleId: 'gerente' }, 'foreign')).complete).toBe(false); expect(h.requests.length).toBe(before);
  });
  it('stages a shell without mutating the installed shell and preserves it through unconsented cold activation', async () => {
    const a = await shell('shell-A'); const h = new Harness(a.descriptor); h.publishShell(a); await h.lifecycle('install'); await h.lifecycle('activate');
    const first = (await h.pointer('/__shell')).active;
    const oldBytes = await (await (await h.storage.open(first.cacheName)).match('/index.html'))!.text();
    const b = await shell('shell-B'); const update = new Harness(b.descriptor, h.storage); update.publishShell(b); await update.lifecycle('install');
    expect((await update.pointer('/__shell')).active.cacheName).toBe(first.cacheName);
    expect(await (await (await h.storage.open(first.cacheName)).match('/index.html'))!.text()).toBe(oldBytes);
    await update.lifecycle('activate'); expect((await update.pointer('/__shell')).active.cacheName).toBe(first.cacheName);
    const verified = await update.message('VERIFY_WAITING_WORKER'); expect(verified.compatible).toBe(true);
    expect((await update.message('ACTIVATE_WITH_CONSENT', { version: b.descriptor.generation, scriptURL: origin + '/sw.js' })).type).toBe('SHELL_ACTIVATION_ACCEPTED');
    await update.lifecycle('activate'); expect((await update.pointer('/__shell')).active.generation).toBe(b.descriptor.generation);
    expect((await update.pointer('/__shell')).previous.cacheName).toBe(first.cacheName);
  });
  it('publishes B from an independent worker after consent promotes A without regressing active or N-1', async () => {
    const initial = await shell('initial'); const installed = new Harness(initial.descriptor); installed.publishShell(initial);
    await installed.lifecycle('install'); await installed.lifecycle('activate');
    const a = await shell('consented-A'); const workerA = new Harness(a.descriptor, installed.storage); workerA.publishShell(a); await workerA.lifecycle('install');
    const b = await shell('installing-B'); const workerB = new Harness(b.descriptor, installed.storage); workerB.publishShell(b);
    let release!: () => void; let reached!: () => void;
    const blocked = new Promise<void>(resolve => { reached = resolve; });
    const resume = new Promise<void>(resolve => { release = resolve; });
    installed.storage.beforeMatch = async (name, url) => { if (name.startsWith(`consubov-shell-${b.descriptor.generation}`) && url.endsWith('/shell-assets.json')) { reached(); await resume; } };
    const staging = workerB.lifecycle('install'); await blocked;
    expect((await workerA.message('ACTIVATE_WITH_CONSENT', { version: a.descriptor.generation, scriptURL: origin + '/sw.js' })).accepted).toBe(true);
    await workerA.lifecycle('activate');
    expect((await installed.pointer('/__shell')).active.generation).toBe(a.descriptor.generation);
    release(); await staging;
    const state = await installed.pointer('/__shell');
    expect(state.active.generation).toBe(a.descriptor.generation);
    expect(state.previous.generation).toBe(initial.descriptor.generation);
    expect(state.candidate.generation).toBe(b.descriptor.generation);
    expect(state.consentedGeneration).toBeNull();
    await workerB.lifecycle('activate');
    expect((await installed.pointer('/__shell')).active.generation).toBe(a.descriptor.generation);
  });
  it('preserves accepted A and candidate B when B publishes between skipWaiting and activate', async () => {
    const initial = await shell('initial'); const h = new Harness(initial.descriptor); h.publishShell(initial); await h.lifecycle('install'); await h.lifecycle('activate');
    const a = await shell('A'); const workerA = new Harness(a.descriptor, h.storage); workerA.publishShell(a); await workerA.lifecycle('install');
    const b = await shell('B'); const workerB = new Harness(b.descriptor, h.storage); workerB.publishShell(b);
    let entered!: () => void; let release!: () => void;
    const reached = new Promise<void>(resolve => { entered = resolve; }); const resume = new Promise<void>(resolve => { release = resolve; });
    workerA.skipWaitingBarrier = async () => { entered(); await resume; };
    const consent = workerA.message('ACTIVATE_WITH_CONSENT', { version: a.descriptor.generation, scriptURL: origin + '/sw.js' });
    await reached; await workerB.lifecycle('install'); await workerA.lifecycle('activate'); release();
    expect((await consent).accepted).toBe(true);
    const state = await h.pointer('/__shell');
    expect(state.active.generation).toBe(a.descriptor.generation);
    expect(state.previous.generation).toBe(initial.descriptor.generation);
    expect(state.candidate.generation).toBe(b.descriptor.generation);
  });
  it('rolls back failed skipWaiting with CAS while retaining a newer candidate', async () => {
    const initial = await shell('initial'); const h = new Harness(initial.descriptor); h.publishShell(initial); await h.lifecycle('install'); await h.lifecycle('activate');
    const a = await shell('A'); const workerA = new Harness(a.descriptor, h.storage); workerA.publishShell(a); await workerA.lifecycle('install');
    const b = await shell('B'); const workerB = new Harness(b.descriptor, h.storage); workerB.publishShell(b);
    let entered!: () => void; let fail!: () => void;
    const reached = new Promise<void>(resolve => { entered = resolve; }); const failure = new Promise<void>((_, reject) => { fail = () => reject(new Error('skip failed')); });
    workerA.skipWaitingBarrier = async () => { entered(); await failure; };
    const consent = workerA.message('ACTIVATE_WITH_CONSENT', { version: a.descriptor.generation, scriptURL: origin + '/sw.js' });
    await reached; await workerB.lifecycle('install'); fail();
    expect((await consent).accepted).toBe(false);
    const state = await h.pointer('/__shell');
    expect(state.active.generation).toBe(initial.descriptor.generation);
    expect(state.previous).toBeNull();
    expect(state.candidate.generation).toBe(b.descriptor.generation);
  });
  it('fails closed without native locks and preserves installed offline shell bytes', async () => {
    const a = await shell('installed'); const installed = new Harness(a.descriptor); installed.publishShell(a); await installed.lifecycle('install'); await installed.lifecycle('activate');
    const before = JSON.stringify(await installed.pointer('/__shell'));
    const b = await shell('unsupported-update'); const unsupported = new Harness(b.descriptor, installed.storage, false); unsupported.publishShell(b);
    await expect(unsupported.lifecycle('install')).rejects.toThrow('RELEASE_POINTER_LOCK_UNAVAILABLE');
    expect(JSON.stringify(await installed.pointer('/__shell'))).toBe(before);
    expect((await unsupported.message('ACTIVATE_WITH_CONSENT', { version: b.descriptor.generation, scriptURL: origin + '/sw.js' })).accepted).toBe(false);
    expect(await (await (await installed.storage.open((await installed.pointer('/__shell')).active.cacheName)).match('/index.html'))!.text()).toContain('installed');
    expect((await installed.storage.keys()).filter(name => name.startsWith(`consubov-shell-${b.descriptor.generation}`))).toHaveLength(0);
  });
  it('blocks shell compatibility breaks and rechecks shell byte integrity at consent', async () => {
    const a = await shell('A'); const h = new Harness(a.descriptor); h.publishShell(a); await h.lifecycle('install'); await h.lifecycle('activate');
    const mod = await artifact('gerente', '1.0.0'); h.publish(mod); await h.healthy(await h.prepare('gerente'));
    const b = await shell('B', [2]); const update = new Harness(b.descriptor, h.storage); update.publishShell(b); await update.lifecycle('install');
    expect((await update.message('VERIFY_WAITING_WORKER')).compatible).toBe(false);
    expect((await update.message('ACTIVATE_WITH_CONSENT', { version: b.descriptor.generation, scriptURL: origin + '/sw.js' })).type).toBe('SHELL_ACTIVATION_BLOCKED'); expect(update.skipped).toBe(0);
    const c = await shell('C'); const compatible = new Harness(c.descriptor, h.storage); compatible.publishShell(c); await compatible.lifecycle('install');
    const candidate = (await compatible.pointer('/__shell')).candidate; await (await h.storage.open(candidate.cacheName)).put('/index.html', new Response('corrupt'));
    expect((await compatible.message('ACTIVATE_WITH_CONSENT', { version: c.descriptor.generation, scriptURL: origin + '/sw.js' })).type).toBe('SHELL_ACTIVATION_BLOCKED'); expect(compatible.skipped).toBe(0);
  });
  it('blocks activation when a second shell window appears after verification and preserves all installed bytes', async () => {
    const a = await shell('A'); const h = new Harness(a.descriptor); h.publishShell(a); await h.lifecycle('install'); await h.lifecycle('activate');
    const b = await shell('B'); const update = new Harness(b.descriptor, h.storage); update.publishShell(b); await update.lifecycle('install');
    expect((await update.message('VERIFY_WAITING_WORKER')).canActivate).toBe(true);
    const before = JSON.stringify(await update.pointer('/__shell'));
    update.clients.push({ id: 'another-window', url: origin + '/app' });
    const denial = await update.message('ACTIVATE_WITH_CONSENT', { version: b.descriptor.generation, scriptURL: origin + '/sw.js' });
    expect(denial.accepted).toBe(false); expect(denial.reason).toBe('OTHER_CLIENTS_OPEN'); expect(update.skipped).toBe(0);
    expect(JSON.stringify(await update.pointer('/__shell'))).toBe(before);
    expect((await update.message('VERIFY_WAITING_WORKER')).clientCount).toBe(2);
    update.clients.pop();
    expect((await update.message('ACTIVATE_WITH_CONSENT', { version: b.descriptor.generation, scriptURL: origin + '/sw.js' })).accepted).toBe(true);
  });
  it('durably quarantines bounded runtime/handshake failures while integrity failures remain repairable', async () => {
    const h = new Harness(); h.publish(await artifact('capataz', '1.0.0')); const first = await h.prepare('capataz'); await h.healthy(first);
    let rejected = '';
    for (let n = 2; n < 20; n++) {
      const next = await artifact('capataz', `${n}.0.0`); h.publish(next); const d = await h.prepare('capataz'); rejected = d.generation;
      expect((await h.message('ROLLBACK_MODULE', { ...d, reason: n % 2 ? 'runtime' : 'handshake' })).descriptor.generation).toBe(first.generation);
    }
    expect((await h.pointer('/__modules/capataz')).rejectedGenerations).toHaveLength(16);
    const restarted = new Harness(null, h.storage); const bad = await artifact('capataz', '19.0.0'); restarted.publish(bad);
    expect((await restarted.prepare('capataz')).generation).toBe(first.generation);
    expect((await restarted.pointer('/__modules/capataz')).rejectedGenerations[0]).toBe(rejected);
    const repaired = await artifact('capataz', '20.0.0'); restarted.publish(repaired); const damaged = await restarted.prepare('capataz');
    await (await restarted.storage.open(damaged.cacheName)).put(damaged.resourceBase + 'module.js', new Response('broken'));
    expect((await restarted.message('ROLLBACK_MODULE', { ...damaged, reason: 'integrity' })).descriptor.generation).toBe(first.generation);
    expect((await restarted.prepare('capataz')).generation).toBe(repaired.generation);
  });
  it('rejects absent, expired, excessive and asynchronously expired activation deadlines without promotion', async () => {
    const a = await shell('A'); const h = new Harness(a.descriptor); h.publishShell(a); await h.lifecycle('install'); await h.lifecycle('activate');
    const b = await shell('B'); const update = new Harness(b.descriptor, h.storage); update.publishShell(b); await update.lifecycle('install');
    const before = JSON.stringify(await update.pointer('/__shell'));
    for (const clientDeadline of [undefined, Date.now()-1, Date.now()+60000]) {
      const denied = await update.message('ACTIVATE_WITH_CONSENT', { version:b.descriptor.generation, scriptURL:origin+'/sw.js', clientDeadline });
      expect(denied.reason).toBe('ACTIVATION_LEASE_EXPIRED'); expect(denied.accepted).toBe(false);
    }
    update.matchDelay = 50;
    const expired = await update.message('ACTIVATE_WITH_CONSENT', { version:b.descriptor.generation, scriptURL:origin+'/sw.js', clientDeadline:Date.now()+20 });
    expect(expired.reason).toBe('ACTIVATION_LEASE_EXPIRED'); expect(update.skipped).toBe(0);
    expect(JSON.stringify(await update.pointer('/__shell'))).toBe(before);
  });
});

export { Harness, artifact, shell };
