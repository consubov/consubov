const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const modulePath = path.resolve(__dirname, '../src/lib/swRegistration.ts');

function loadRegistration({ busy }) {
  const calls = { waitingMessages: [], reloads: [], pendingDrain: null };
  let isBusy = busy;
  const registration = {
    waiting: { scriptURL: 'https://consubov.test/sw.js?v=build-b', state: 'installed', postMessage(message) { calls.waitingMessages.push(message); } },
    installing: null, active: null,
    update: async () => {},
    addEventListener() {},
  };
  const navSw = {
    controller: { scriptURL: 'https://consubov.test/sw.js?v=build-a' },
    async getRegistration() { return registration; },
    addEventListener() {},
  };
  const windowMock = {
    location: { href: 'https://consubov.test/', search: '', hostname: 'consubov.test', replace(url) { calls.reloads.push(url); } },
    sessionStorage: { getItem() { return null; }, setItem() {} },
    clearTimeout() {},
    setTimeout() { return 1; },
  };
  windowMock.self = windowMock;
  windowMock.top = windowMock;
  const navigatorMock = { serviceWorker: navSw };
  const documentMock = { addEventListener() {}, visibilityState: 'visible' };
  const modules = {
    react: { useEffect() {}, useState() {}, useCallback(fn) { return fn; } },
    '@/lib/authIdle': { reloadWhenAuthIdle(fn) { fn(); } },
    './criticalOperations': {
      hasCriticalOperations() { return isBusy; },
      onCriticalOperationsDrained(cb) { calls.pendingDrain = cb; return () => { calls.pendingDrain = null; }; },
    },
  };
  const exports = {};
  const input = fs.readFileSync(modulePath, 'utf8').replace('import.meta.env.PROD', 'true');
  const code = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const sandbox = {
    exports,
    require(spec) { assert.ok(spec in modules, 'unexpected module: ' + spec); return modules[spec]; },
    navigator: navigatorMock, window: windowMock, document: documentMock,
    URL, URLSearchParams, Date, Set, WeakSet, Promise, __APP_BUILD_VERSION__: 'build-a',
    setTimeout(cb) { queueMicrotask(cb); },
    console: { log() {}, warn() {} },
  };
  vm.runInNewContext(code, sandbox, { filename: modulePath });
  return { calls, mod: exports, setBusy(value) { isBusy = value; } };
}

test('critical work defers explicit update before SKIP_WAITING', async () => {
  const app = loadRegistration({ busy: true });
  await app.mod.applyPendingUpdateNow('user-click');
  assert.equal(app.calls.waitingMessages.length, 0);
  assert.equal(typeof app.calls.pendingDrain, 'function');
  app.setBusy(false);
  app.calls.pendingDrain();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.calls.waitingMessages.length, 1);
  assert.equal(app.calls.waitingMessages[0].type, 'SKIP_WAITING');
});

test('explicit update without critical work signals waiting worker', async () => {
  const app = loadRegistration({ busy: false });
  await app.mod.applyPendingUpdateNow('user-click');
  assert.equal(app.calls.waitingMessages.length, 1);
});
