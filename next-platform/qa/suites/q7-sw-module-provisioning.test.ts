import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';

const workerPath = resolve(import.meta.dir, '../../apps/fazenda/shell/public/sw.js');
const origin = 'https://app.test';

class MemoryCache {
  private entries = new Map<string, Response>();
  private key(input: RequestInfo | URL): string { return new URL(typeof input === 'string' || input instanceof URL ? input.toString() : input.url, origin).href; }
  async match(input: RequestInfo | URL): Promise<Response | undefined> { return this.entries.get(this.key(input))?.clone(); }
  async put(input: RequestInfo | URL, response: Response): Promise<void> { this.entries.set(this.key(input), response.clone()); }
  async addAll(inputs: RequestInfo[]): Promise<void> { for (const input of inputs) await this.put(input, new Response('shell')); }
}

class MemoryCacheStorage {
  stores = new Map<string, MemoryCache>();
  async open(name: string): Promise<MemoryCache> { let cache = this.stores.get(name); if (!cache) { cache = new MemoryCache(); this.stores.set(name, cache); } return cache; }
  async keys(): Promise<string[]> { return [...this.stores.keys()]; }
  async delete(name: string): Promise<boolean> { return this.stores.delete(name); }
  async match(input: RequestInfo | URL, options?: { cacheName?: string }): Promise<Response | undefined> {
    if (options?.cacheName) return this.stores.get(options.cacheName)?.match(input);
    for (const cache of this.stores.values()) { const response = await cache.match(input); if (response) return response; }
    return undefined;
  }
}

async function assetRecord(url: string, body: string) {
  const bytes = new TextEncoder().encode(body);
  const digest = new Uint8Array(await webcrypto.subtle.digest('SHA-256', bytes));
  const hex = [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
  const base64 = Buffer.from(digest).toString('base64');
  return { url, bytes: bytes.byteLength, sha256: hex, integrity: `sha256-${base64}`, body };
}

describe('Q7 service worker verified module provisioning', () => {
  it('rejects foreign clients, isolates module caches, and serves cached entry despite nonce query', async () => {
    const index = await assetRecord('index.html', '<!doctype html><script src="./module.js"></script>');
    const script = await assetRecord('module.js', 'window.__verifiedModule = true;');
    const manifest = { moduleId: 'fabrica', profileId: 'fabrica', version: '1.2.3', protocolVersion: 1, apiVersions: ['1'], entry: 'index.html', assets: [index, script].map(({ body: _body, ...entry }) => entry) };
    const listenerMap = new Map<string, (event: any) => void>();
    const storage = new MemoryCacheStorage();
    const clients = new Map<string, { url: string }>([['same-origin', { url: `${origin}/app` }], ['foreign', { url: 'https://evil.test/app' }]]);
    let assetFetches = 0;
    const workerFetch = async (input: RequestInfo | URL): Promise<Response> => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input.toString() : input.url, origin);
      if (url.pathname === '/modules/fabrica/current/module.json') return new Response(JSON.stringify(manifest), { headers: { 'content-type': 'application/json' } });
      const asset = [index, script].find(candidate => url.pathname === `/modules/fabrica/current/${candidate.url}`);
      if (asset) { assetFetches++; return new Response(asset.body); }
      return new Response('not found', { status: 404 });
    };
    const selfObject: any = {
      location: { origin, href: `${origin}/sw.js` },
      navigator: { onLine: true, locks: { request: async (_name: string, _options: unknown, operation: () => unknown) => operation() } },
      clients: { get: async (id: string) => clients.get(id) },
      addEventListener: (name: string, listener: (event: any) => void) => listenerMap.set(name, listener),
      skipWaiting: () => {},
      clientsClaim: () => {}
    };
    const source = readFileSync(workerPath, 'utf8');
    new Function('self', 'caches', 'fetch', 'crypto', 'Response', 'URL', 'TextEncoder', 'btoa', `${source}\n//# sourceURL=sw.js`)(selfObject, storage, workerFetch, webcrypto, Response, URL, TextEncoder, (value: string) => Buffer.from(value, 'binary').toString('base64'));

    const messageHandler = listenerMap.get('message')!;
    let rejected: any;
    let rejectedWait: Promise<void> | undefined;
    messageHandler({ data: { type: 'PROVISION_AUTHORIZED_MODULE', moduleId: 'fabrica' }, source: { id: 'foreign' }, ports: [{ postMessage: (value: unknown) => { rejected = value; } }], waitUntil: (promise: Promise<void>) => { rejectedWait = promise; } });
    await rejectedWait;
    expect(rejected.type).toBe('MODULE_PROVISION_FAILED');
    expect(assetFetches).toBe(0);

    let provisioned: any;
    let provisionWait: Promise<void> | undefined;
    messageHandler({ data: { type: 'PROVISION_AUTHORIZED_MODULE', moduleId: 'fabrica' }, source: { id: 'same-origin' }, ports: [{ postMessage: (value: unknown) => { provisioned = value; } }], waitUntil: (promise: Promise<void>) => { provisionWait = promise; } });
    await provisionWait;
    expect(provisioned).toMatchObject({ type: 'MODULE_PROVISIONED', moduleId: 'fabrica', complete: true, descriptor: { moduleId: 'fabrica', legacy: true, health: 'candidate' } });
    expect((await storage.keys()).some(name => name.startsWith('consubov-module-fabrica-'))).toBe(true);
    expect((await storage.keys()).some(name => name.startsWith('consubov-fazendas-'))).toBe(false);

    let responsePromise: Promise<Response> | undefined;
    listenerMap.get('fetch')!({
      request: new Request(`${origin}/modules/fabrica/current/index.html?nonce=session-specific`, { mode: 'navigate' }),
      respondWith: (promise: Promise<Response>) => { responsePromise = promise; }
    });
    const response = await responsePromise!;
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('module.js');

    let scriptResponsePromise: Promise<Response> | undefined;
    listenerMap.get('fetch')!({
      request: new Request(`${origin}/modules/fabrica/current/module.js`, { mode: 'cors' }),
      respondWith: (promise: Promise<Response>) => { scriptResponsePromise = promise; }
    });
    const scriptResponse = await scriptResponsePromise!;
    expect(scriptResponse.headers.get('access-control-allow-origin')).toBe('*');
    expect(scriptResponse.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
  });
});
