const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const sourcePath = path.resolve(__dirname, '../src/lib/legacyOfflineInventory.ts');
const code = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
vm.runInNewContext('(function(exports, module){' + code + '\n})') (mod.exports, mod);
const { LEGACY_OFFLINE_DATABASES, inspectLegacyOffline } = mod.exports;

test('inventory contains the six legacy databases without changing their versions', () => {
  assert.deepEqual(Array.from(LEGACY_OFFLINE_DATABASES, d => [d.name, d.version]), [
    ['consubov-capataz', 7], ['consubov-session', 1],
    ['consubov-consultor-offline', 2], ['mais-arrobas-offline', 1],
    ['mais-arrobas-sync', 2], ['consubov-fotos-salga', 1],
  ]);
});

test('unsupported databases() does not open or create any database', async () => {
  let opens = 0;
  const factory = { open() { opens++; throw new Error('should not open'); } };
  const report = await inspectLegacyOffline(factory, { getItem() { return null; } });
  assert.equal(report.status, 'unsupported');
  assert.equal(opens, 0);
});

test('read-only inventory opens only known existing databases, closes connections, and never reads records', async () => {
  const opened = [], closed = [], transactions = [];
  const db = {
    version: 7,
    objectStoreNames: ['syncQueue', 'lastPdfs'],
    transaction(name, mode) {
      transactions.push([name, mode]);
      return { objectStore() { return { keyPath: 'id', indexNames: ['by-status'] }; } };
    },
    close() { closed.push(true); },
  };
  const factory = {
    async databases() { return [{ name: 'consubov-capataz', version: 7 }, { name: 'unrelated-sensitive-db', version: 3 }]; },
    open(name) {
      opened.push(name);
      const request = { result: db };
      queueMicrotask(() => request.onsuccess());
      return request;
    },
  };
  const report = await inspectLegacyOffline(factory, { getItem(key) { return key === 'pending_backup' ? '[redacted]' : null; } });
  assert.equal(report.status, 'ok');
  assert.deepEqual(opened, ['consubov-capataz']);
  assert.equal(closed.length, 1);
  assert.equal(report.databases[0].actualVersion, 7);
  assert.equal(report.databases[0].stores[0].name, 'syncQueue');
  assert.equal(report.databases[0].missingExpectedStores.includes('lancamentos'), true);
  assert.ok(transactions.every(([, mode]) => mode === 'readonly'));
  assert.deepEqual(Array.from(report.localStorageKeysPresent), ['pending_backup']);
  assert.equal(JSON.stringify(report).includes('redacted'), false, 'localStorage value leaked into report');
});

test('failing databases() is reported without attempting any writable or destructive fallback', async () => {
  let opens = 0;
  const factory = { async databases() { throw new Error('denied'); }, open() { opens++; } };
  const report = await inspectLegacyOffline(factory);
  assert.equal(report.status, 'error');
  assert.equal(opens, 0);
});

test('database deleted between listing and open is never recreated by the inspection', async () => {
  let aborted = 0;
  const factory = {
    async databases() { return [{ name: 'consubov-capataz', version: 7 }]; },
    open() {
      const request = { transaction: { abort() { aborted++; } } };
      queueMicrotask(() => { request.onupgradeneeded(); request.onerror(); });
      return request;
    },
  };
  const report = await inspectLegacyOffline(factory);
  assert.equal(report.status, 'ok');
  assert.equal(aborted, 1);
  assert.equal(report.databases[0].error, 'open-failed-or-raced-with-delete');
});
