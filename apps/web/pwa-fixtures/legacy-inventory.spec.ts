import { test, expect } from './persistentTest';
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const runtime = ts.transpileModule(
  readFileSync(new URL('../src/lib/legacyOfflineInventory.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
type InspectorWindow = Window & {
  inventory: typeof import('../src/lib/legacyOfflineInventory');
};
let server: Server;
let origin: string;

test.beforeAll(async () => {
  server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><html lang="en"><head><title>Read-only inventory fixture</title></head><body><main><h1>Local inventory</h1></main></body></html>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing local fixture address');
  origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
test.beforeEach(async ({ page }) => {
  await page.goto(origin);
  await page.addScriptTag({ content: `(() => { const module = { exports: {} }; (function(exports,module){ ${runtime}\n})(module.exports,module); window.inventory = module.exports; })();` });
});

test('browser reports denied localStorage without losing independent IndexedDB metadata', async ({ page }) => {
  const report = await page.evaluate(async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('fixture denial', 'SecurityError'); } });
    try { return await (window as unknown as InspectorWindow).inventory.inspectLegacyOffline(); }
    finally { if (descriptor) Object.defineProperty(window, 'localStorage', descriptor); }
  });
  expect(report.localStorageStatus).toBe('unavailable');
  expect(report.status).toBe('ok');
  expect(report.databases).toEqual([]);
});

test('browser inventory preserves pending Blob data and discovers exact index metadata', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const request = indexedDB.open('mais-arrobas-sync', 2);
    request.onupgradeneeded = () => {
      const queue = request.result.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
      queue.createIndex('by-owner-command', ['tenant', 'command'], { unique: true });
      request.result.createObjectStore('acknowledged-inserts');
    };
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('queue', 'readwrite');
      tx.objectStore('queue').add({ id: 7, tenant: 'fixture-only', command: 'pending-1', secret: 'PRIVATE-FIXTURE', photo: new Blob(['pending-photo'], { type: 'image/jpeg' }) });
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
    const report = await (window as unknown as InspectorWindow).inventory.inspectLegacyOffline();
    const row = await new Promise<{ photo: Blob; command: string }>((resolve, reject) => {
      const req = db.transaction('queue').objectStore('queue').get(7);
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    const photo = await row.photo.text();
    db.close();
    return { report, photo, command: row.command };
  });
  expect(result.photo).toBe('pending-photo');
  expect(result.command).toBe('pending-1');
  expect(JSON.stringify(result.report)).not.toContain('PRIVATE-FIXTURE');
  const queue = result.report.databases[0].stores.find(store => store.name === 'queue');
  expect(queue?.autoIncrement).toBe(true);
  expect(queue?.indexDefinitions).toEqual([{ name: 'by-owner-command', keyPath: ['tenant', 'command'], unique: true, multiEntry: false }]);
});

test('browser inspection does not create missing legacy databases', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const before = await indexedDB.databases();
    const report = await (window as unknown as InspectorWindow).inventory.inspectLegacyOffline();
    const after = await indexedDB.databases();
    return { before, after, report };
  });
  expect(result.after).toEqual(result.before);
  expect(result.report.databases).toEqual([]);
});
