import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

// The candidate and final scripts/tests destination have the same directory depth.
const swPath = path.resolve(import.meta.dirname, '../../apps/web/public/sw.js');
const source = fs.readFileSync(swPath, 'utf8');
const sourceHash = createHash('sha256').update(source).digest('hex');
const turn = () => new Promise(resolve => setImmediate(resolve));
const assetList = Array.from({ length: 349 }, (_, index) => `/assets/fixture-${index}.abcdefgh.${index % 3 === 0 ? 'css' : 'js'}`);
const entry = assetList[1];
const generation = 'precache-integrity';
const assetCache = `consubov-v-${generation}`;
const shellCache = `consubov-shell-v-${generation}`;

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function fixture(failure) {
  const listeners = new Map();
  const journal = [];
  const fetches = [];
  const puts = [];
  const deletions = [];
  const heldPeers = deferred();
  const peerPutSeen = deferred();
  const failureSeen = deferred();
  const seeds = new Map([
    ['consubov-v-stable', new Map([['old.js', 'old asset sentinel']])],
    ['consubov-shell-v-stable', new Map([['/', 'old shell sentinel']])],
    ['unrelated-user-cache', new Map([['binary', [0, 255, 42]]])],
  ]);
  const initialSeeds = JSON.stringify([...seeds].map(([name, values]) => [name, [...values]]));
  const records = new Map(seeds);
  const deleted = new Set();
  const userDataMutations = [];
  let activeFetches = 0;
  let activePuts = 0;
  let maximumCombined = 0;
  let maximumFetches = 0;
  let maximumPuts = 0;
  let lateWrites = 0;
  let skipWaiting = 0;
  let claims = 0;
  const sample = () => {
    maximumCombined = Math.max(maximumCombined, activeFetches + activePuts);
    maximumFetches = Math.max(maximumFetches, activeFetches);
    maximumPuts = Math.max(maximumPuts, activePuts);
  };
  const html = failure === 'entrypoint' ? '<link href="/assets/fixture-0.abcdefgh.css">'
    : `<script src="${entry}"></script><script src='${entry}'></script><link href="${assetList[0]}">`;
  const fetchBoundary = async url => {
    fetches.push(url);
    activeFetches++;
    sample();
    journal.push({ operation: 'fetch-start', url });
    try {
      if (url !== '/index.html' && url !== entry && ['http', 'put'].includes(failure)) await heldPeers.promise;
      await turn();
      if (url === entry && failure === 'http') {
        failureSeen.resolve();
        return new Response('synthetic unavailable asset', { status: 503 });
      }
      return new Response(url === '/index.html' ? html : `synthetic ${url}`, {
        status: url === '/index.html' && failure === 'shell-http' ? 503 : 200,
      });
    } finally {
      activeFetches--;
      journal.push({ operation: 'fetch-end', url });
    }
  };
  const caches = {
    async open(name) {
      if (!records.has(name)) records.set(name, new Map());
      const values = records.get(name);
      return {
        async put(url, response) {
          activePuts++;
          sample();
          puts.push({ name, url });
          journal.push({ operation: 'put-start', name, url });
          try {
            if (name === assetCache && failure === 'held-falsy-put') {
              if (url === entry) {
                await peerPutSeen.promise;
                failureSeen.resolve();
                throw undefined;
              }
              peerPutSeen.resolve();
              await heldPeers.promise;
            }
            if (name === assetCache && url === entry && failure === 'put') {
              failureSeen.resolve();
              throw new Error('synthetic-quota-failure');
            }
            await turn();
            if (name === shellCache && url === '/' && failure === 'shell-put') throw new Error('synthetic-shell-put-failure');
            if (deleted.has(name)) lateWrites++;
            values.set(url, await response.text());
          } finally {
            activePuts--;
            journal.push({ operation: 'put-end', name, url });
          }
        },
      };
    },
    async delete(name) {
      const deletion = { name, active: activeFetches + activePuts, activeFetches, activePuts };
      deletions.push(deletion);
      journal.push({ operation: 'delete', ...deletion });
      deleted.add(name);
      return records.delete(name);
    },
  };
  const mutateUserData = operation => { userDataMutations.push(operation); throw new Error('unexpected-user-data-mutation'); };
  assert.ok(source.includes("'__PRECACHE_ASSETS__'"), 'actual Vite precache injection point must exist');
  const builtSource = source.replaceAll('__BUILD_TIMESTAMP__', generation)
    .replace("'__PRECACHE_ASSETS__'", JSON.stringify([...assetList, entry, assetList[0]]));
  vm.runInNewContext(builtSource, {
    Response, URL, setTimeout, clearTimeout, fetch: fetchBoundary, caches,
    indexedDB: { deleteDatabase: () => mutateUserData('deleteDatabase') },
    localStorage: { clear: () => mutateUserData('localStorage.clear'), removeItem: () => mutateUserData('localStorage.removeItem') },
    self: {
      addEventListener: (name, listener) => listeners.set(name, listener),
      skipWaiting: () => { skipWaiting++; },
      clients: { claim: async () => { claims++; }, matchAll: async () => [] },
    },
  }, { filename: swPath });
  const installPromises = [];
  assert.equal(typeof listeners.get('install'), 'function');
  listeners.get('install')({ waitUntil: promise => installPromises.push(promise) });
  assert.equal(installPromises.length, 1, 'real install event must own its lifetime');
  let settled = false;
  const outcome = installPromises[0].then(
    () => ({ rejected: false, error: null }), error => ({ rejected: true, error }),
  ).then(result => { settled = true; return result; });
  const assertPreserved = () => {
    assert.equal(JSON.stringify([...seeds].map(([name]) => [name, [...records.get(name)]])), initialSeeds);
    assert.deepEqual(userDataMutations, []);
    assert.equal(skipWaiting, 0, 'install must not activate without consent');
    assert.equal(claims, 0, 'install must not claim clients');
  };
  return {
    journal, fetches, puts, deletions, records, outcome, failureSeen: failureSeen.promise,
    release: heldPeers.resolve, isSettled: () => settled, assertPreserved,
    drain: async () => { heldPeers.resolve(); while (activeFetches + activePuts > 0) await turn(); },
    metrics: () => ({ sourceHash, maximumCombined, maximumFetches, maximumPuts, fetchCount: fetches.length, putCount: puts.length, lateWrites }),
  };
}

test('actual install precaches all349 deduped assets with at most4 combined fetch/put operations and shell LAST', async t => {
  const f = fixture();
  assert.equal((await f.outcome).error, null);
  f.assertPreserved();
  assert.deepEqual(f.fetches.filter(url => url !== '/index.html').sort(), [...assetList].sort());
  assert.deepEqual([...f.records.get(assetCache).keys()].sort(), [...assetList].sort());
  assert.deepEqual(f.puts.filter(item => item.name === assetCache).map(item => item.url).sort(), [...assetList].sort());
  const firstShellWrite = f.journal.findIndex(item => item.operation === 'put-start' && item.name === shellCache);
  const lastAssetWrite = f.journal.findLastIndex(item => item.operation === 'put-end' && item.name === assetCache);
  assert.ok(firstShellWrite > lastAssetWrite, 'shell publication must follow all completed asset puts');
  assert.deepEqual(f.puts.slice(-2), [{ name: shellCache, url: '/index.html' }, { name: shellCache, url: '/' }]);
  assert.deepEqual(f.deletions, []);
  t.diagnostic(JSON.stringify(f.metrics()));
  assert.ok(f.metrics().maximumCombined <= 4, `combined fetch/put concurrency=${f.metrics().maximumCombined}, required<=4`);
});

for (const failure of ['http', 'put', 'held-falsy-put']) {
  test(`actual install ${failure} failure waits for every started writer before deleting only failed generation`, async t => {
    const f = fixture(failure);
    try {
      await f.failureSeen;
      await turn();
      await turn();
      const startedFetches = f.fetches.length;
      assert.deepEqual(f.deletions, [], 'cleanup must wait while peer fetch/put operations are held');
      assert.equal(f.isSettled(), false, 'waitUntil must stay pending until peer writers drain');
      f.release();
      const result = await f.outcome;
      assert.equal(result.rejected, true, 'even a falsy thrown value must reject installation');
      if (failure === 'held-falsy-put') assert.equal(result.error, undefined);
      else assert.equal(result.error?.message, failure === 'http' ? `critical-asset-unavailable: ${entry}` : 'synthetic-quota-failure');
      assert.equal(f.fetches.length, startedFetches, 'do not dequeue more assets after failure');
      assert.deepEqual(f.deletions.map(item => item.name).sort(), [assetCache, shellCache].sort());
      assert.ok(f.deletions.every(item => item.active === 0), 'cleanup is after all pending boundary operations');
      assert.equal(f.metrics().lateWrites, 0);
      assert.equal(f.records.has(assetCache), false);
      assert.equal(f.records.has(shellCache), false);
      assert.equal(f.puts.some(item => item.name === shellCache), false);
      f.assertPreserved();
    } finally {
      f.release();
      await f.outcome;
      // Current RED may reject before peers; drain controlled boundaries for clean test teardown.
      await f.drain();
      t.diagnostic(JSON.stringify(f.metrics()));
    }
  });
}

for (const [failure, message] of [
  ['shell-http', 'app-shell-unavailable'],
  ['entrypoint', 'missing-entrypoint-js'],
  ['shell-put', 'synthetic-shell-put-failure'],
]) {
  test(`actual install ${failure} rejects atomically and preserves existing generations/consent`, async () => {
    const f = fixture(failure);
    const result = await f.outcome;
    assert.equal(result.error?.message, message);
    assert.deepEqual(f.deletions.map(item => item.name).sort(), [assetCache, shellCache].sort());
    assert.ok(f.deletions.every(item => item.active === 0));
    assert.equal(f.records.has(assetCache), false);
    assert.equal(f.records.has(shellCache), false);
    f.assertPreserved();
  });
}
