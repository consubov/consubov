const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { IDBFactory } = require('fake-indexeddb');
const source = fs.readFileSync(path.join(__dirname, '../src/platform/adapters/IndexedDbLocalDatabase.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exported = {};
vm.runInNewContext('(function(exports){' + code + '\n})', { structuredClone, Blob })(exported);
const { IndexedDbLocalDatabase, NEXT_LOCAL_DB_NAME } = exported;
const owner = { tenantId: 'tenant-test', userId: 'user-test' };

function open(factory, setup) {
  return new Promise((resolve, reject) => {
    const request = factory.open(NEXT_LOCAL_DB_NAME, 1);
    request.onupgradeneeded = () => setup(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

test('captures accepted payload before the asynchronous IndexedDB opening', async () => {
  const store = new IndexedDbLocalDatabase(owner, new IDBFactory());
  const payload = { amount: 10, nested: { original: true }, bytes: new Uint8Array([1, 2]).buffer };
  const write = store.set('pending-command', payload);
  payload.amount = 99;
  payload.nested.original = false;
  new Uint8Array(payload.bytes)[0] = 255;
  await write;
  const saved = await store.get('pending-command');
  assert.equal(saved.amount, 10);
  assert.equal(saved.nested.original, true);
  assert.deepEqual([...new Uint8Array(saved.bytes)], [1, 2]);
  await store.close();
});

test('captures accepted payload even with an already resolved connection', async () => {
  const store = new IndexedDbLocalDatabase(owner, new IDBFactory());
  await store.get('warmup');
  const payload = { amount: 20 };
  const write = store.set('pending-command', payload);
  payload.amount = 88;
  await write;
  assert.equal((await store.get('pending-command')).amount, 20);
  await store.close();
});

test('rejects uncloneable input before opening or changing any database', async () => {
  let opens = 0;
  const factory = { open() { opens++; throw new Error('must not open'); } };
  const store = new IndexedDbLocalDatabase(owner, factory);
  await assert.rejects(store.set('invalid', { callback() {} }), error => error.name === 'DataCloneError');
  assert.equal(opens, 0);
});

for (const options of [{ keyPath: 'wrong' }, { keyPath: 'id', autoIncrement: true }]) {
  test('refuses incompatible existing kv schema: ' + JSON.stringify(options), async () => {
    const factory = new IDBFactory();
    const seed = await open(factory, db => db.createObjectStore('kv', options));
    seed.close();
    const store = new IndexedDbLocalDatabase(owner, factory);
    await assert.rejects(store.get('pending-command'), /schema/i);
    const inspect = await open(factory, () => assert.fail('must not migrate'));
    const objectStore = inspect.transaction('kv').objectStore('kv');
    assert.equal(objectStore.keyPath, options.keyPath);
    assert.equal(objectStore.autoIncrement, Boolean(options.autoIncrement));
    inspect.close();
  });
}

test('closes a connection which arrives after a blocked request has failed', async () => {
  let request, closes = 0;
  const factory = { open() { return request = {}; } };
  const store = new IndexedDbLocalDatabase(owner, factory);
  const result = store.get('pending-command');
  request.onblocked();
  await assert.rejects(result, /blocked/i);
  request.result = { close() { closes++; } };
  request.onsuccess();
  assert.equal(closes, 1);
});

test('fake-indexeddb retains binary content after close and reopening', async () => {
  const factory = new IDBFactory();
  const store = new IndexedDbLocalDatabase(owner, factory);
  await store.set('photo', { file: new Blob(['offline-photo'], { type: 'image/jpeg' }), bytes: new Uint8Array([9, 8, 7]).buffer });
  await store.close();
  const reopened = new IndexedDbLocalDatabase(owner, factory);
  const saved = await reopened.get('photo');
  assert.equal(await saved.file.text(), 'offline-photo');
  assert.equal(saved.file.type, 'image/jpeg');
  assert.deepEqual([...new Uint8Array(saved.bytes)], [9, 8, 7]);
  await reopened.close();
});

test('fake-indexeddb never shares scoped keys between users or tenants', async () => {
  const factory = new IDBFactory();
  const a = new IndexedDbLocalDatabase(owner, factory);
  const b = new IndexedDbLocalDatabase({ ...owner, userId: 'other-user' }, factory);
  const c = new IndexedDbLocalDatabase({ ...owner, tenantId: 'other-tenant' }, factory);
  await a.set('same-key', { private: true });
  assert.equal(await b.get('same-key'), undefined);
  assert.equal(await c.get('same-key'), undefined);
  await b.set('same-key', { private: false });
  await a.delete('same-key');
  assert.equal((await b.get('same-key')).private, false);
  await Promise.all([a.close(), b.close(), c.close()]);
});
