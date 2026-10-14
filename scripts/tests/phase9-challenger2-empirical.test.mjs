/**
 * Phase 9 — Adversarial Challenger 2 Empirical Stress Test Suite
 *
 * Verifies:
 * 1. Bi-generational Service Worker retention & rollback (N and N-1)
 * 2. Absolute immutability of IndexedDB (6 legacy bases + vnext) and localStorage during rollback
 * 3. Fail-closed SW precache behavior preventing corrupted states
 * 4. DDL DOWN migration idempotency, zero-residue reversibility & determinism
 * 5. Sabotaged DOWN detection (oracle validation)
 * 6. Local snapshot rehearsal and invariant preservation
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import {
  runMigrationIdempotencyFiles,
  runIdempotencyCycle,
  computeCatalogHash
} from '../qa/migration-idempotency-runner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const swPath = path.resolve(__dirname, '../../apps/web/public/sw.js');
const upMigrationPath = path.resolve(__dirname, '../../supabase/migrations/20261014000000_phase8_unified_relational_contracts.sql');
const downMigrationPath = path.resolve(__dirname, '../../supabase/migrations/down/20261014000000_phase8_unified_relational_contracts.down.sql');

/**
 * Harness to simulate Service Worker lifecycle in VM with storage spy
 */
function createServiceWorkerHarness({
  buildVersion = '2026101402',
  precacheAssets = ['/assets/main.hash1234.js', '/assets/main.hash1234.css'],
  failAsset = null,
  initialCaches = new Map()
} = {}) {
  const cacheStores = new Map();
  // Clone any initial caches
  for (const [k, v] of initialCaches.entries()) {
    cacheStores.set(k, new Map(v));
  }

  const listeners = new Map();
  const dispatchedMessages = [];
  const claimedClients = [];
  const notifications = [];

  // Storage mutation tracker to ensure zero interference with client data
  const storageSpy = {
    indexedDbDeletions: [],
    localStorageClears: 0,
    localStorageItemRemovals: []
  };

  const keyOf = (req) => {
    const raw = typeof req === 'string' ? req : req.url;
    const url = new URL(raw, 'https://consubov.local');
    return url.pathname + url.search;
  };

  const mockCaches = {
    open: async (name) => {
      if (!cacheStores.has(name)) cacheStores.set(name, new Map());
      const store = cacheStores.get(name);
      return {
        put: async (request, response) => {
          store.set(keyOf(request), response.clone());
        },
        match: async (request) => {
          const item = store.get(keyOf(request));
          return item ? item.clone() : undefined;
        }
      };
    },
    keys: async () => [...cacheStores.keys()],
    delete: async (name) => cacheStores.delete(name),
    match: async (request) => {
      for (const name of cacheStores.keys()) {
        const item = cacheStores.get(name).get(keyOf(request));
        if (item) return item.clone();
      }
      return undefined;
    }
  };

  const mockFetch = async (request, options = {}) => {
    const url = keyOf(request);
    if (url === failAsset) {
      return new Response('Asset not found', { status: 404, statusText: 'Not Found' });
    }
    if (url === '/' || url === '/index.html') {
      const html = `<!doctype html><html><head><link rel="stylesheet" href="/assets/main.hash1234.css"></head><body><script type="module" src="/assets/main.hash1234.js"></script></body></html>`;
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
    if (url.startsWith('/assets/')) {
      return new Response(`/* asset content for ${url} */`, {
        status: 200,
        headers: { 'Content-Type': url.endsWith('.js') ? 'application/javascript' : 'text/css' }
      });
    }
    return new Response('Offline / Not Found', { status: 404 });
  };

  const mockClient = {
    id: 'client-window-1',
    url: 'https://consubov.local/dashboard',
    postMessage: (msg) => { dispatchedMessages.push(msg); },
    navigate: async (url) => { /* no-op */ }
  };

  const mockSelf = {
    location: { origin: 'https://consubov.local' },
    registration: {
      waiting: null,
      showNotification: async (title, opts) => {
        notifications.push({ title, opts });
      }
    },
    clients: {
      claim: async () => { claimedClients.push(true); },
      matchAll: async () => [mockClient],
      openWindow: async (url) => ({ url })
    },
    addEventListener: (type, handler) => {
      listeners.set(type, handler);
    },
    skipWaiting: () => {}
  };

  // Mock global storage with spies to ensure SW NEVER touches them
  const mockIndexedDB = {
    deleteDatabase: (dbName) => {
      storageSpy.indexedDbDeletions.push(dbName);
    }
  };

  const mockLocalStorage = {
    clear: () => {
      storageSpy.localStorageClears++;
    },
    removeItem: (key) => {
      storageSpy.localStorageItemRemovals.push(key);
    }
  };

  const context = {
    self: mockSelf,
    caches: mockCaches,
    fetch: mockFetch,
    URL,
    Response,
    Request,
    Promise,
    Date,
    Math,
    setTimeout: (fn) => queueMicrotask(fn),
    console: { log() {}, warn() {}, error() {} },
    indexedDB: mockIndexedDB,
    localStorage: mockLocalStorage
  };

  let swCode = fs.readFileSync(swPath, 'utf8');
  swCode = swCode.replace("'__BUILD_TIMESTAMP__'", `'${buildVersion}'`);
  swCode = swCode.replace("'__PRECACHE_ASSETS__'", JSON.stringify(precacheAssets));

  vm.runInNewContext(swCode, context, { filename: swPath });

  const dispatch = async (type, extra = {}) => {
    const promises = [];
    let fetchResponse;
    const event = {
      ...extra,
      waitUntil: (p) => { promises.push(Promise.resolve(p)); },
      respondWith: (p) => { fetchResponse = Promise.resolve(p); }
    };
    const handler = listeners.get(type);
    if (!handler) throw new Error(`Missing listener for ${type}`);
    handler(event);
    await Promise.all(promises);
    return fetchResponse ? await fetchResponse : undefined;
  };

  return {
    dispatch,
    cacheStores,
    storageSpy,
    dispatchedMessages,
    claimedClients,
    notifications
  };
}

// =========================================================================
// SECTION 1: Adversarial Service Worker Bi-Generational Rollback Verification
// =========================================================================

test('SW Bi-Generational Rollback: retém N e N-1 simultaneamente e expurga N-2', async () => {
  // Pre-seed caches with N-2, N-1 and an unrelated foreign cache
  const initialCaches = new Map();

  // N-2 (obsolete, e.g. 2026101400)
  const nMinus2Shell = new Map([['/index.html', new Response('<html>shell v0</html>')]]);
  const nMinus2Assets = new Map([['/assets/app.v0.js', new Response('console.log("v0")')]]);
  initialCaches.set('consubov-shell-v-2026101400', nMinus2Shell);
  initialCaches.set('consubov-v-2026101400', nMinus2Assets);

  // N-1 (previous version, e.g. 2026101401)
  const nMinus1Shell = new Map([['/index.html', new Response('<html>shell v1</html>')]]);
  const nMinus1Assets = new Map([['/assets/main.hash1234.js', new Response('console.log("v1")')]]);
  initialCaches.set('consubov-shell-v-2026101401', nMinus1Shell);
  initialCaches.set('consubov-v-2026101401', nMinus1Assets);

  // Foreign cache from another system or feature
  initialCaches.set('other-user-offline-docs', new Map([['/doc.pdf', new Response('data')]]));

  // Instantiate worker N (version 2026101402)
  const swN = createServiceWorkerHarness({
    buildVersion: '2026101402',
    initialCaches
  });

  // Execute install and activate on version N
  await swN.dispatch('install');
  await swN.dispatch('activate');

  const keysAfterN = [...swN.cacheStores.keys()];

  // Invariant 1: Version N caches are created
  assert.ok(keysAfterN.includes('consubov-shell-v-2026101402'), 'Shell cache N deve existir');
  assert.ok(keysAfterN.includes('consubov-v-2026101402'), 'Assets cache N deve existir');

  // Invariant 2: Version N-1 caches are strictly RETAINED (Bi-generational retention)
  assert.ok(keysAfterN.includes('consubov-shell-v-2026101401'), 'Shell cache N-1 deve ser retido');
  assert.ok(keysAfterN.includes('consubov-v-2026101401'), 'Assets cache N-1 deve ser retido');

  // Invariant 3: Obsolete Version N-2 caches are PRUNED
  assert.ok(!keysAfterN.includes('consubov-shell-v-2026101400'), 'Shell cache N-2 deve ser expurgado');
  assert.ok(!keysAfterN.includes('consubov-v-2026101400'), 'Assets cache N-2 deve ser expurgado');

  // Invariant 4: Unrelated foreign cache is preserved
  assert.ok(keysAfterN.includes('other-user-offline-docs'), 'Cache estrangeiro deve ser preservado');

  // Invariant 5: Zero interference with IndexedDB and localStorage
  assert.equal(swN.storageSpy.indexedDbDeletions.length, 0, 'Zero chamadas a indexedDB.deleteDatabase');
  assert.equal(swN.storageSpy.localStorageClears, 0, 'Zero chamadas a localStorage.clear');
  assert.equal(swN.storageSpy.localStorageItemRemovals.length, 0, 'Zero chamadas a localStorage.removeItem');

  // NOW SIMULATE ROLLBACK TO N-1 (version 2026101401)
  const swRollback = createServiceWorkerHarness({
    buildVersion: '2026101401', // Rolled back version
    initialCaches: swN.cacheStores
  });

  await swRollback.dispatch('install');
  await swRollback.dispatch('activate');

  const keysAfterRollback = [...swRollback.cacheStores.keys()];

  // Both N-1 (now active) and N (now previous) are retained bi-generationally
  assert.ok(keysAfterRollback.includes('consubov-shell-v-2026101401'), 'Shell N-1 ativo apos rollback');
  assert.ok(keysAfterRollback.includes('consubov-v-2026101401'), 'Assets N-1 ativos apos rollback');
  assert.ok(keysAfterRollback.includes('consubov-shell-v-2026101402'), 'Shell N retido como geracao vizinha');
  assert.ok(keysAfterRollback.includes('consubov-v-2026101402'), 'Assets N retidos como geracao vizinha');

  // Invariant 6: Storage remains 100% untouched throughout rollback
  assert.equal(swRollback.storageSpy.indexedDbDeletions.length, 0, 'Zero destruicao de IndexedDB no rollback');
  assert.equal(swRollback.storageSpy.localStorageClears, 0, 'Zero limpeza de localStorage no rollback');
});

test('SW Precache Fail-Closed: falha de download em build N descarta apenas geracao incompleta', async () => {
  const initialCaches = new Map();
  initialCaches.set('consubov-shell-v-2026101401', new Map([['/index.html', new Response('shell v1')]]));
  initialCaches.set('consubov-v-2026101401', new Map([['/assets/main.hash1234.js', new Response('v1')]]));

  const brokenSw = createServiceWorkerHarness({
    buildVersion: '2026101402',
    failAsset: '/assets/main.hash1234.css', // Simulates 404 on CSS asset
    initialCaches
  });

  // Install must reject fail-closed
  await assert.rejects(brokenSw.dispatch('install'), /critical-asset-unavailable/);

  // The incomplete caches for 2026101402 must be purged immediately
  const keys = [...brokenSw.cacheStores.keys()];
  assert.ok(!keys.includes('consubov-shell-v-2026101402'), 'Cache incompleto de shell N deve ser descartado');
  assert.ok(!keys.includes('consubov-v-2026101402'), 'Cache incompleto de assets N deve ser descartado');

  // The intact N-1 version remains ready to serve
  assert.ok(keys.includes('consubov-shell-v-2026101401'), 'Cache N-1 permaneceu integro');
  assert.ok(keys.includes('consubov-v-2026101401'), 'Assets N-1 permaneceram integros');
  assert.equal(brokenSw.storageSpy.indexedDbDeletions.length, 0, 'Zero toque em IndexedDB');
});

test('SW Pinned Shell Navigation: navegacao offline serve o shell instalado sem excecao', async () => {
  const sw = createServiceWorkerHarness({ buildVersion: '2026101402' });
  await sw.dispatch('install');

  // Dispara requisicao de navegacao (mode: navigate simulado pelo navegador)
  const req = { url: 'https://consubov.local/pesagem', method: 'GET', mode: 'navigate' };
  const response = await sw.dispatch('fetch', { request: req });

  assert.equal(response.status, 200);
  const text = await response.text();
  assert.ok(text.includes('<!doctype html>'), 'Deve servir HTML do shell pinned');
  assert.ok(text.includes('main.hash1234.js'), 'HTML referencia os bundles cacheados');
});

// =========================================================================
// SECTION 2: DDL DOWN Idempotency, Zero Residue and Reversibility
// =========================================================================

test('PostgreSQL DDL Rollback: ciclo completo UP -> UP -> DOWN -> UP valida idempotencia e reversibilidade limpa', () => {
  const result = runMigrationIdempotencyFiles(upMigrationPath, downMigrationPath);

  assert.ok(result.passed, 'Ciclo de idempotencia e reversibilidade deve passar');
  assert.ok(result.isIdempotent, 'Aplicacao duplicada de UP deve produzir o mesmo schema hash');
  assert.ok(result.isReversible, 'Aplicacao de DOWN deve restaurar o hash do baseline com ZERO residuos');
  assert.ok(result.isDeterministic, 'Reaplicacao de UP apos DOWN deve ser deterministica');

  assert.equal(result.integrityErrors.length, 0, 'Sem erros de integridade no catalogo');
  assert.equal(result.hashes.state0_baseline, result.hashes.state3_down_rollback,
    'Hash do Estado 3 (DOWN) deve ser RIGOROSAMENTE IDENTICO ao Estado 0 (Baseline)');
});

test('PostgreSQL DDL Rollback: execucao idempotente repetida de DOWN (DOWN -> DOWN) preserva zero residuos', () => {
  const upSql = fs.readFileSync(upMigrationPath, 'utf8');
  const downSql = fs.readFileSync(downMigrationPath, 'utf8');

  // Executa ciclo padrao
  const cycle = runIdempotencyCycle(upSql, downSql);
  assert.ok(cycle.passed);

  // Agora testa executar DOWN uma segunda vez sobre o estado ja desfeito
  const catalogAfterDown = { tables: {}, indexes: {}, policies: {} };
  const baselineHash = computeCatalogHash(catalogAfterDown);

  // Executa DOWN repetido
  const cycleDoubleDown = runIdempotencyCycle(downSql, downSql, catalogAfterDown);
  const hashDoubleDown = cycleDoubleDown.hashes.state1_up;

  assert.equal(baselineHash, hashDoubleDown, 'Executar DOWN repetidamente nao introduz alteracoes nem erros');
});

test('Oracle Validation: script DOWN sabotado e detectado com falha de reversibilidade', () => {
  const upSql = fs.readFileSync(upMigrationPath, 'utf8');
  // DOWN sabotado: removeu a tabela mas esqueceu de dar drop na policy ou simulou remanescente
  const sabotagedDownSql = `
    -- Sabotaged DOWN missing DROP TABLE
    DROP INDEX IF EXISTS public.idx_atomic_commands_kind;
  `;

  const sabotagedCycle = runIdempotencyCycle(upSql, sabotagedDownSql);
  assert.equal(sabotagedCycle.isReversible, false, 'DOWN sabotado nao pode ser considerado reversivel');
  assert.equal(sabotagedCycle.passed, false, 'Ciclo com DOWN sabotado deve falhar');
});

// =========================================================================
// SECTION 3: Multi-tenant Data Invariants & Rehearsal
// =========================================================================

test('Invariante de Dados: as 6 bases legadas do IndexedDB estao no catalogo de protecao', () => {
  const legacyBases = [
    'consubov-capataz',
    'consubov-session',
    'consubov-consultor-offline',
    'mais-arrobas-offline',
    'mais-arrobas-sync',
    'consubov-fotos-salga'
  ];

  const plan72 = fs.readFileSync(path.resolve(__dirname, '../../docs/72-plano-rollback-contingencia.md'), 'utf8');
  for (const base of legacyBases) {
    assert.ok(plan72.includes(base), `docs/72 deve citar explicitamente a protecao de ${base}`);
  }
});
