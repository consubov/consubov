const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { IDBFactory } = require('fake-indexeddb');
const source = path.resolve(__dirname, '../src/lib/legacyOfflineInventory.ts');

function load(globals = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext('(function(exports,module){' + compiled + '\n})', globals)(module.exports, module);
  return module.exports;
}
const unavailable = () => { throw new DOMException('Storage policy denied access', 'SecurityError'); };
const reader = { getItem: () => null };
const toPlain = value => JSON.parse(JSON.stringify(value));

function open(factory, name, version, upgrade) {
  return new Promise((resolve, reject) => {
    const req = factory.open(name, version);
    req.onupgradeneeded = () => upgrade(req.result);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

test('a denied localStorage getter cannot stop independent IndexedDB inspection', async () => {
  const globals = { indexedDB: new IDBFactory() };
  Object.defineProperty(globals, 'localStorage', { get: unavailable });
  const result = await load(globals).inspectLegacyOffline();
  assert.equal(result.status, 'ok');
  assert.equal(result.localStorageStatus, 'unavailable');
  assert.deepEqual(toPlain(result.localStorageKeysPresent), []);
});

test('a denied indexedDB getter is reported without throwing or exposing the exception', async () => {
  const globals = { localStorage: reader };
  Object.defineProperty(globals, 'indexedDB', { get: unavailable });
  const result = await load(globals).inspectLegacyOffline();
  assert.equal(result.status, 'unavailable');
  assert.equal(result.localStorageStatus, 'available');
  assert.equal(JSON.stringify(result).includes('Storage policy'), false);
});

test('getItem failures are not reported as proof that local backups are absent', async () => {
  const result = await load().inspectLegacyOffline(new IDBFactory(), { getItem: unavailable });
  assert.equal(result.status, 'ok');
  assert.equal(result.localStorageStatus, 'unavailable');
});

test('one synchronous open failure preserves successful metadata from other legacy databases', async () => {
  const factory = new IDBFactory();
  const db = await open(factory, 'consubov-session', 1, db => db.createObjectStore('auth_session', { keyPath: 'id' }));
  db.close();
  const actualOpen = factory.open.bind(factory);
  factory.databases = async () => [{ name: 'consubov-capataz', version: 7 }, { name: 'consubov-session', version: 1 }];
  factory.open = (name, ...args) => name === 'consubov-capataz' ? unavailable() : actualOpen(name, ...args);
  const result = await load().inspectLegacyOffline(factory, reader);
  assert.equal(result.databases.length, 2);
  assert.equal(result.databases[0].error, 'open-unavailable');
  assert.equal(result.databases[1].stores[0].name, 'auth_session');
});

test('metadata includes real key paths, generators and index constraints without reading records', async () => {
  const factory = new IDBFactory();
  const db = await open(factory, 'mais-arrobas-sync', 2, db => {
    const store = db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
    store.createIndex('owner-command', ['tenant_id', 'command_id'], { unique: true });
    store.createIndex('tags', 'tags', { multiEntry: true });
    db.createObjectStore('acknowledged-inserts');
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').add({ tenant_id: 'fixture', command_id: 'fixture-command', token: 'DO-NOT-EXPORT', tags: ['a'] });
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
  db.close();
  const result = await load().inspectLegacyOffline(factory, reader);
  const queue = result.databases[0].stores.find(s => s.name === 'queue');
  assert.equal(queue.autoIncrement, true);
  assert.deepEqual(toPlain(queue.indexDefinitions), [
    { name: 'owner-command', keyPath: ['tenant_id', 'command_id'], unique: true, multiEntry: false },
    { name: 'tags', keyPath: 'tags', unique: false, multiEntry: true },
  ]);
  assert.equal(JSON.stringify(result).includes('DO-NOT-EXPORT'), false);
  const after = await open(factory, 'mais-arrobas-sync', 2, () => assert.fail('schema was changed'));
  assert.equal(await new Promise(resolve => { const req = after.transaction('queue').objectStore('queue').count(); req.onsuccess = () => resolve(req.result); }), 1);
  after.close();
});

test('inspection does not create absent databases or touch unrelated storage', async () => {
  const factory = new IDBFactory();
  const db = await open(factory, 'unrelated-db', 3, db => db.createObjectStore('private'));
  db.close();
  const before = await factory.databases();
  const result = await load().inspectLegacyOffline(factory, reader);
  assert.deepEqual(toPlain(result.databases), []);
  assert.deepEqual(await factory.databases(), before);
});
