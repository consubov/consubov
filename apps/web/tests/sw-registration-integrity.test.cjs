const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const modulePath = path.resolve(__dirname, '../src/lib/swRegistration.ts');

function loadRegistration({ busy }) {
  const calls = { waitingMessages: [], reloads: [], pendingDrain: null, timeouts: new Map(), handlers: new Map() };
  let timerId = 0;
  let isBusy = busy;
  const registration = {
    waiting: { scriptURL: 'https://consubov.test/sw.js?v=build-b', state: 'installed', postMessage(message) { calls.waitingMessages.push(message); } },
    installing: null, active: null,
    update: async () => {},
    addEventListener(type, cb) { calls.handlers.set('registration:' + type, cb); },
  };
  const navSw = {
    controller: { scriptURL: 'https://consubov.test/sw.js?v=build-a' },
    async getRegistration() { return registration; },
    addEventListener(type, cb) { calls.handlers.set('sw:' + type, cb); },
  };
  const windowMock = {
    location: { href: 'https://consubov.test/', search: '', hostname: 'consubov.test', replace(url) { calls.reloads.push(url); } },
    sessionStorage: { getItem() { return null; }, setItem() {} },
    clearTimeout(id) { calls.timeouts.delete(id); },
    setTimeout(cb) { const id = ++timerId; calls.timeouts.set(id, cb); return id; },
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
  return { calls, mod: exports, registration, navSw, setBusy(value) { isBusy = value; },
    expireTimeout() { const callbacks = [...calls.timeouts.values()]; calls.timeouts.clear(); for(const fn of callbacks) fn(); },
    emitControllerChange() { calls.handlers.get('sw:controllerchange')?.(); },
    emitActivated(version = 'build-b') { calls.handlers.get('sw:message')?.({ data: { type: 'CONSUBOV_SW_ACTIVATED', version } }); },
    emitInstalled() { calls.handlers.get('registration:updatefound')?.(); },
  };
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

test('explicit update without an activated worker never reloads the installed PWA', async () => {
  const app = loadRegistration({ busy: false });
  await app.mod.applyPendingUpdateNow('token-a');
  assert.equal(app.calls.reloads.length, 0);
  app.expireTimeout();
  assert.equal(app.calls.reloads.length, 0, 'timeout cannot reload an unverified update');
});

test('verified controllerchange after explicit click reloads at most once', async () => {
  const app = loadRegistration({ busy: false });
  await app.mod.applyPendingUpdateNow('token-a');
  app.navSw.controller = { scriptURL: 'https://consubov.test/sw.js?v=build-b' };
  app.emitControllerChange();
  app.emitActivated();
  app.expireTimeout();
  assert.equal(app.calls.reloads.length, 1);
  assert.match(app.calls.reloads[0], /__v=token-a/);
});

test('unsolicited activated worker never navigates a field device', async () => {
  const app = loadRegistration({ busy: false });
  app.emitActivated();
  app.emitControllerChange();
  assert.equal(app.calls.reloads.length, 0);
});

test('waiting update applied after installation only while user requested it', async () => {
  const app = loadRegistration({ busy: false });
  app.registration.waiting = null;
  const listeners = new Map();
  const installing = { state: 'installing', addEventListener(type, cb) { listeners.set(type, cb); } };
  app.registration.installing = installing;
  await app.mod.applyPendingUpdateNow('token-b');
  app.emitInstalled();
  const worker = { scriptURL: 'https://consubov.test/sw.js?v=build-b', state: 'installed', postMessage(message) { app.calls.waitingMessages.push(message); } };
  app.registration.waiting = worker;
  installing.state = 'installed';
  listeners.get('statechange')?.();
  assert.equal(app.calls.waitingMessages.length, 1);
  assert.equal(app.calls.waitingMessages[0].type, 'SKIP_WAITING');
  assert.equal(app.calls.reloads.length, 0, 'worker must take control first');
});
