const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const workerPath = path.resolve(__dirname, '../public/sw.js');
const html = '<!doctype html><html><head><link rel="stylesheet" href="/assets/app.12345678.css"></head><body><script type="module" src="/assets/app.12345678.js"></script></body></html>';

function fixture({ assetsAvailable = true, deniedAsset = null, precacheAssets = [] } = {}) {
  const stores = new Map();
  const listeners = new Map();
  const navigations = [];
  const messages = [];
  const state = { skipped: 0, claimed: 0, storageTouched: 0 };
  let offline = false;
  let networkHtml = html;

  const keyOf = (input) => {
    const raw = typeof input === 'string' ? input : input.url;
    const url = new URL(raw, 'https://consubov.test');
    return url.pathname + url.search;
  };
  const openCache = async (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const entries = stores.get(name);
    return {
      async put(request, response) { entries.set(keyOf(request), response.clone()); },
      async match(request) { return entries.get(keyOf(request))?.clone(); },
    };
  };
  const caches = {
    open: openCache,
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async match(request) {
      for (const name of stores.keys()) {
        const match = await (await openCache(name)).match(request);
        if (match) return match;
      }
    },
  };
  const responseFor = async (request) => {
    if (offline) throw new Error('offline');
    const url = keyOf(request);
    if (url === '/' || url === '/index.html') return new Response(networkHtml, { status: 200, headers: { 'Content-Type': 'text/html' } });
    if (/\.(?:js|css|woff2)$/.test(url)) {
      if (!assetsAvailable || url === deniedAsset) return new Response('not found', { status: 404 });
      return new Response('asset:' + url, { status: 200 });
    }
    return new Response('not found', { status: 404 });
  };
  const client = {
    url: 'https://consubov.test/pesagem',
    postMessage(message) { messages.push(message); },
    async navigate(url) { navigations.push(url); },
    async focus() {},
  };
  const self = {
    location: { origin: 'https://consubov.test' },
    registration: { waiting: null, showNotification: async () => {} },
    clients: { async claim() { state.claimed++; }, async matchAll() { return [client]; } },
    addEventListener(type, fn) { listeners.set(type, fn); },
    skipWaiting() { state.skipped++; return Promise.resolve(); },
  };
  const context = {
    self, caches, fetch: responseFor, URL, Response, Request, Promise, Date, Math,
    setTimeout(fn) { queueMicrotask(fn); return 1; },
    console: { log() {}, warn() {}, error() {} },
    indexedDB: { deleteDatabase() { state.storageTouched++; } },
    localStorage: { clear() { state.storageTouched++; } },
  };
  const source = fs.readFileSync(workerPath, 'utf8').replace("'__PRECACHE_ASSETS__'", JSON.stringify(precacheAssets));
  vm.runInNewContext(source, context, { filename: workerPath });
  async function dispatch(type, extra = {}) {
    const promises = [];
    let fetchResponse;
    const event = {
      ...extra,
      waitUntil(promise) { promises.push(Promise.resolve(promise)); },
      respondWith(promise) { fetchResponse = Promise.resolve(promise); },
    };
    const handler = listeners.get(type);
    assert.ok(handler, 'missing ' + type + ' listener');
    handler(event);
    await Promise.all(promises);
    return fetchResponse ? await fetchResponse : undefined;
  }
  return { state, stores, caches, dispatch, navigations, messages, setOffline(value) { offline = value; }, setNetworkHtml(value) { networkHtml = value; } };
}

test('install caches critical HTML and JS/CSS before the new worker is usable', async () => {
  const h = fixture();
  await h.dispatch('install');
  const names = await h.caches.keys();
  const shellName = names.find((name) => name.startsWith('consubov-shell-'));
  assert.ok(shellName);
  assert.equal(await (await (await h.caches.open(shellName)).match('/index.html'))?.text(), html);
  const assets = await h.caches.open(names.find((name) => name.startsWith('consubov-v-')));
  assert.ok(await assets.match('/assets/app.12345678.js'));
  assert.ok(await assets.match('/assets/app.12345678.css'));
  assert.equal(h.state.skipped, 0, 'update must wait for explicit user consent');
});

test('failed critical asset prevents incomplete update from installing', async () => {
  const h = fixture({ assetsAvailable: false });
  await assert.rejects(h.dispatch('install'));
  assert.equal(h.state.skipped, 0);
});

test('activation keeps current plus previous generation and foreign caches', async () => {
  const h = fixture();
  await h.caches.open('another-application-data');
  await h.caches.open('consubov-v-oldest');
  await h.caches.open('consubov-shell-v-oldest');
  await h.caches.open('consubov-v-previous');
  await h.caches.open('consubov-shell-v-previous');
  await h.dispatch('install');
  await h.dispatch('activate');
  const keys = await h.caches.keys();
  assert.ok(keys.includes('another-application-data'), 'foreign cache deleted');
  assert.ok(keys.includes('consubov-v-previous'), 'previous assets deleted');
  assert.ok(keys.includes('consubov-shell-v-previous'), 'previous shell deleted');
  assert.ok(!keys.includes('consubov-v-oldest'), 'obsolete assets retained');
  assert.equal(h.navigations.length, 0, 'worker navigated users without consent');
  assert.equal(h.state.storageTouched, 0, 'operational storage touched');
});

test('offline navigation serves the installed shell, not a 504', async () => {
  const h = fixture();
  await h.dispatch('install');
  h.setOffline(true);
  const response = await h.dispatch('fetch', {
    request: { url: 'https://consubov.test/pesagem', method: 'GET', mode: 'navigate' },
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), html);
});

test('only an explicit SKIP_WAITING message activates a waiting update', async () => {
  const h = fixture();
  await h.dispatch('install');
  assert.equal(h.state.skipped, 0);
  await h.dispatch('message', { data: { type: 'SKIP_WAITING' } });
  assert.equal(h.state.skipped, 1);
});

test('update notification delegates to the client instead of forcing navigation', async () => {
  const h = fixture();
  await h.dispatch('notificationclick', {
    notification: { tag: 'consubov-update', data: { type: 'update', url: '/' }, close() {} },
  });
  assert.equal(h.navigations.length, 0);
  assert.equal(h.messages.length, 1);
  assert.equal(h.messages[0].type, 'CONSUBOV_APPLY_UPDATE');
  assert.equal(h.state.skipped, 0);
});

test('push notification cannot navigate a client to another origin', async () => {
  const h = fixture();
  await h.dispatch('notificationclick', {
    notification: { tag: 'external', data: { url: 'https://untrusted.example/login' }, close() {} },
  });
  assert.equal(h.navigations.length, 1);
  assert.equal(h.navigations[0], 'https://consubov.test/');
});

test('online navigation stays pinned to installed shell until explicit update', async () => {
  const h = fixture();
  await h.dispatch('install');
  const newHtml = html.replaceAll('12345678', 'abcdef123');
  h.setNetworkHtml(newHtml);
  const response = await h.dispatch('fetch', {
    request: { url: 'https://consubov.test/pesagem', method: 'GET', mode: 'navigate' },
  });
  assert.equal(await response.text(), html, 'old SW exposed new HTML before user consent');
});

test('installation includes lazily loaded route bundles declared by build', async () => {
  const h = fixture({ precacheAssets: ['/assets/lazy.abcdef123.js', '/assets/fonts.abcdef123.woff2'] });
  await h.dispatch('install');
  const names = await h.caches.keys();
  const assets = await h.caches.open(names.find((name) => name.startsWith('consubov-v-')));
  assert.ok(await assets.match('/assets/lazy.abcdef123.js'));
  assert.ok(await assets.match('/assets/fonts.abcdef123.woff2'));
});

test('missing lazy bundle fails update atomically, preserving old cached data', async () => {
  const h = fixture({ precacheAssets: ['/assets/lazy.abcdef123.js'], deniedAsset: '/assets/lazy.abcdef123.js' });
  await h.caches.open('consubov-shell-v-previous');
  await assert.rejects(h.dispatch('install'));
  const keys = await h.caches.keys();
  assert.ok(keys.includes('consubov-shell-v-previous'));
  assert.ok(!keys.some((name) => name.includes('__BUILD_TIMESTAMP__')));
  assert.equal(h.state.storageTouched, 0);
});
