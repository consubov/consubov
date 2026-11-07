/**
 * Isolated, deterministic QA for the Capataz offline hotfix.
 * No network, Supabase, device storage, or real users are accessed.
 * Run: node --test apps/web/scripts/qa/check-capataz-offline.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const req = createRequire(import.meta.url);
const ts = req(process.env.CONSUBOV_TYPESCRIPT_PATH || 'typescript');
const source = fs.readFileSync(new URL('../../src/lib/offlineDb.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

class FakeDb {
  constructor() {
    this.stores = new Map(['lancamentos', 'pastos', 'retiro', 'ciclos', 'produtoAtivo',
      'fazendaCache', 'config', 'observacoesOffline', 'pesagensPendentes',
      'syncQueue', 'syncErrors', 'lastPdfs'].map((name) => [name, new Map()]));
    this.failPutStore = null;
    this.failGetKeyStore = null;
    this.countCalls = [];
    this.allCalls = [];
    this.bulkReadForbidden = false;
  }
  key(name, value) {
    if (name === 'config') return value.key;
    return value.id;
  }
  transaction(names, mode) {
    const db = this;
    const targets = Array.isArray(names) ? names : [names];
    const staged = new Map(targets.map((name) => [name, new Map(db.stores.get(name))]));
    let finalized = false;
    const store = (name) => {
      assert.ok(staged.has(name), `unexpected transaction store ${name}`);
      const records = staged.get(name);
      const fake = {
        async clear() { records.clear(); },
        async put(value) {
          if (db.failPutStore === name) throw new Error('QuotaExceededError');
          records.set(db.key(name, value), value);
          return db.key(name, value);
        },
        async openCursor(range) {
          const keys = [...records.keys()].sort();
          const after = range?.after;
          let index = keys.findIndex(k => after == null || k > after);
          if (index < 0) return null;
          const next = () => index < keys.length ? ({
            primaryKey: keys[index], value: records.get(keys[index]),
            continue: async () => { index++; return next(); },
          }) : null;
          return next();
        },
      };
      return fake;
    };
    return {
      get store() { return store(targets[0]); },
      objectStore: store,
      get done() { return { then(resolve) {
        if (!finalized) {
          for (const name of targets) db.stores.set(name, staged.get(name));
          finalized = true;
        }
        resolve();
      } }; },
    };
  }
  async getAllKeys(name) { return [...this.stores.get(name).keys()]; }
  async getKey(name, id) {
    if (this.failGetKeyStore === name) return undefined;
    return this.stores.get(name).has(id) ? id : undefined;
  }
  async get(name, id) { return this.stores.get(name).get(id); }
  async getAll(name) { this.allCalls.push(name); return [...this.stores.get(name).values()]; }
  async getAllFromIndex(name, idx, key) {
    if (this.bulkReadForbidden) throw Error('large bulk read forbidden');
    return [...this.stores.get(name).values()].filter((v) => v[idx === 'by-status' ? 'status' : idx] === key);
  }
  async countFromIndex(name, idx, key) {
    this.countCalls.push(`${name}/${idx}/${key}`);
    return [...this.stores.get(name).values()].filter((v) => v.status === key).length;
  }
}
function newModule() {
  const db = new FakeDb();
  const mod = { exports: {} };
  const context = {
    module: mod, exports: mod.exports, console,
    require(id) {
      assert.equal(id, 'idb');
      return { openDB: async () => db };
    },
    IDBKeyRange: { lowerBound: (after) => ({ after }) },
  };
  vm.runInNewContext(compiled, context, { filename: 'offlineDb.js' });
  return { mod: mod.exports, db };
}
const lanc = (id, status = 'pendente', foto = null) => ({
  id, pasto_id: 'p1', status, data: '2026-10-30T10:00:00Z',
  foto_auditoria_url: foto, observacoes: [],
});

// Verified reads only happen after a committed IDB transaction.
test('durable salva de salga commits and confirms key', async () => {
  const { mod, db } = newModule();
  await mod.saveLancamento(lanc('s1'));
  assert.equal(db.stores.get('lancamentos').size, 1);
  assert.equal((await mod.getLancamentosPendentes()).length, 1);
});

test('quota rejection never acknowledges an offline salga', async () => {
  const { mod, db } = newModule();
  db.failPutStore = 'lancamentos';
  await assert.rejects(mod.saveLancamento(lanc('s2')), (e) => e.code === 'OFFLINE_WRITE_FAILED');
  assert.equal(db.stores.get('lancamentos').size, 0);
});

test('missing read-back key is a write failure, not success', async () => {
  const { mod, db } = newModule();
  db.failGetKeyStore = 'lancamentos';
  await assert.rejects(mod.saveLancamento(lanc('s3')), (e) => e.code === 'OFFLINE_WRITE_FAILED');
});

test('observacao, fechamento and pesagem require confirmed writes', async () => {
  const { mod, db } = newModule();
  await mod.saveObservacaoOffline({ id: 'o1', status: 'pendente' });
  await mod.saveFecharMes({ tipo: 'fechar_mes', ciclo_id: 'c1', data: '2026-10-30', status: 'pendente' });
  await mod.savePesagemPendente({ id: 'p1', sincronizado: false });
  assert.equal(db.stores.get('observacoesOffline').size, 1);
  assert.equal(db.stores.get('config').get('fechar_mes_pendente')?.key, 'fechar_mes_pendente');
  assert.equal(db.stores.get('pesagensPendentes').size, 1);
  db.failPutStore = 'observacoesOffline';
  await assert.rejects(mod.saveObservacaoOffline({ id: 'o2', status: 'pendente' }), /salvar no aparelho/);
});

test('pending count uses indexed COUNT for photo-heavy data, not getAll', async () => {
  const { mod, db } = newModule();
  const huge = 'data:image/jpeg;base64,' + 'x'.repeat(100_000);
  db.stores.get('lancamentos').set('s1', lanc('s1', 'pendente', huge));
  db.stores.get('lancamentos').set('s2', lanc('s2', 'sincronizado', huge));
  db.stores.get('observacoesOffline').set('o1', { id: 'o1', status: 'pendente', foto_url: huge });
  db.stores.get('pesagensPendentes').set('p1', { id: 'p1', sincronizado: false });
  db.stores.get('pesagensPendentes').set('p2', { id: 'p2', sincronizado: true });
  db.stores.get('config').set('fechar_mes_pendente', { key: 'fechar_mes_pendente', value: '{}' });
  db.bulkReadForbidden = true;
  assert.equal(await mod.getTotalPendingCount(), 4);
  assert.deepEqual(db.countCalls, ['lancamentos/by-status/pendente', 'observacoesOffline/by-status/pendente']);
  assert.deepEqual(db.allCalls, ['pesagensPendentes']);
});

test('cursor paginates large photo history without cloning all records', async () => {
  const { mod, db } = newModule();
  for (let n = 0; n < 10; n++) {
    const id = `s${n}`;
    db.stores.get('lancamentos').set(id, lanc(id, 'pendente', n % 3 === 0 ? 'data:image/png;base64,a' : null));
  }
  const first = await mod.getLancamentosFotoPage(null, 4);
  assert.deepEqual(Array.from(first.records, (r) => r.id), ['s0', 's3']);
  assert.equal(first.cursor, 's3');
  assert.equal(first.hasMore, true);
  const second = await mod.getLancamentosFotoPage(first.cursor, 4);
  assert.deepEqual(Array.from(second.records, (r) => r.id), ['s6']);
  const third = await mod.getLancamentosFotoPage(second.cursor, 4);
  assert.deepEqual(Array.from(third.records, (r) => r.id), ['s9']);
  assert.equal(third.hasMore, false);
  assert.equal(db.allCalls.length, 0);
});

const reference = (retId) => ({
  retiro: { id: retId, nome: retId },
  pastos: [{ id: 'pasto-' + retId, nome: 'Pasto', qr_uuid: retId }],
  ciclos: [{ id: 'ciclo-' + retId, mes: 10, ano: 2026 }],
  produto: { id: 'produto-' + retId },
  fazenda: { id: 'fazenda-' + retId },
  fazendaId: 'fazenda-' + retId,
  cicloAtivoId: 'ciclo-' + retId,
});

test('active retiro switch atomically replaces references without touching pendings', async () => {
  const { mod, db } = newModule();
  await mod.saveLancamento(lanc('pending'));
  await mod.activateRetiroReference(reference('r1'));
  await mod.activateRetiroReference(reference('r2'));
  assert.equal((await mod.getCachedRetiro()).id, 'r2');
  assert.equal((await mod.getCachedPastos())[0].id, 'pasto-r2');
  assert.equal((await mod.getCachedCiclos())[0].id, 'ciclo-r2');
  assert.equal((await mod.getConfig('capatazRetiroAtivoId')), 'r2');
  assert.equal((await mod.getLancamentosPendentes())[0].id, 'pending');
  assert.equal(db.stores.get('lancamentos').size, 1);
});

test('failed multi-store swap rolls back old retiro and pending work', async () => {
  const { mod, db } = newModule();
  await mod.saveLancamento(lanc('s1'));
  await mod.activateRetiroReference(reference('r1'));
  db.failPutStore = 'ciclos';
  await assert.rejects(mod.activateRetiroReference(reference('r2')), (e) => e.code === 'OFFLINE_WRITE_FAILED');
  assert.equal((await mod.getCachedRetiro()).id, 'r1');
  assert.equal((await mod.getCachedPastos())[0].id, 'pasto-r1');
  assert.equal((await mod.getConfig('capatazRetiroAtivoId')), 'r1');
  assert.equal((await mod.getLancamentosPendentes()).length, 1);
  db.failPutStore = null;
  await mod.activateRetiroReference(reference('r2'));
  assert.equal((await mod.getCachedRetiro()).id, 'r2');
});

function newBackupModule(photos) {
  const backupSource = fs.readFileSync(new URL('../../src/lib/backupMirror.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(backupSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const localStorageData = new Map();
  const mod = { exports: {} };
  const context = {
    module: mod, exports: mod.exports, console,
    window: { localStorage: {
      setItem: (key, value) => localStorageData.set(key, value),
      getItem: (key) => localStorageData.get(key) ?? null,
    } },
    require: () => ({
      getLancamentosPendentes: async () => [{
        id: 'l1', foto_auditoria_url: photos, foto_cocho_url: null, observacoes: [],
      }],
      getObservacoesPendentes: async () => [],
      getPesagensPendentes: async () => [],
      getFecharMesPendente: async () => null,
      getSyncErrors: async () => [],
    }),
  };
  vm.runInNewContext(code, context, { filename: 'backupMirror.js' });
  return { backup: mod.exports, localStorageData };
}

test('backup mirror keeps small photos as redundant copy', async () => {
  const { backup, localStorageData } = newBackupModule('data:image/jpeg;base64,small');
  const result = await backup.backupPendingToLocalStorage();
  assert.equal(result.ok, true);
  assert.equal(result.trimmed, false);
  assert.equal(JSON.parse(localStorageData.get('pending_backup')).lancamentos[0].foto_auditoria_url, 'data:image/jpeg;base64,small');
});

test('backup mirror strips oversized photos before huge JSON allocation', async () => {
  const { backup, localStorageData } = newBackupModule('data:image/jpeg;base64,' + 'x'.repeat(2_100_000));
  const result = await backup.backupPendingToLocalStorage();
  assert.equal(result.ok, true);
  assert.equal(result.trimmed, true);
  assert.equal(JSON.parse(localStorageData.get('pending_backup')).lancamentos[0].foto_auditoria_url, '[stripped]');
  assert.ok(result.bytes < 20_000);
});


test('summary reads metadata only: photos remain durable but are not copied to UI memory', async () => {
  const { mod, db } = newModule();
  const large = 'data:image/jpeg;base64,' + 'z'.repeat(200000);
  await mod.saveLancamento(lanc('stored', 'pendente', large));
  const resumo = await mod.getLancamentosResumo();
  assert.equal(resumo.length, 1);
  assert.equal(resumo[0].foto_auditoria_url, null);
  assert.equal(resumo[0].id, 'stored');
  assert.equal((await mod.getLancamentosPendentes())[0].foto_auditoria_url, large);
  assert.deepEqual(await mod.getLancamentoIds(), ['stored']);
});

test('pending launch forbids switching retiro without deleting the record', async () => {
  const { mod, db } = newModule();
  await mod.saveLancamento(lanc('unsent'));
  await assert.rejects(mod.assertRetiroSwitchSafe(), /Sincronize os lançamentos/);
  assert.equal((await mod.getLancamentosPendentes()).length, 1);
  await mod.markSincronizado('unsent');
  await mod.assertRetiroSwitchSafe();
});

test('pending month close also forbids switch, even without launches', async () => {
  const { mod } = newModule();
  await mod.saveFecharMes({ tipo: 'fechar_mes', ciclo_id: 'c', data: '2026-10-30', status: 'pendente' });
  await assert.rejects(mod.assertRetiroSwitchSafe(), /Sincronize os lançamentos/);
});


test('retreat summaries never display launches from the previous retreat', async () => {
  const { mod } = newModule();
  const all = [lanc('r1'), { ...lanc('r2'), pasto_id: 'outro-pasto' }];
  const visible = mod.lancamentosDoRetiro(all, [{ id: 'p1' }]);
  assert.deepEqual(visible.map((l) => l.id), ['r1']);
});


test('sync rejects a record from another retreat before touching the RPC', async () => {
  const { mod } = newModule();
  assert.doesNotThrow(() => mod.assertLancamentoNoRetiroAtivo({ pasto_id: 'p1' }, [{ id: 'p1' }], 'r1', 'f1'));
  assert.throws(() => mod.assertLancamentoNoRetiroAtivo({ pasto_id: 'old-pasto' }, [{ id: 'p1' }], 'r2', 'f2'), /mistura/);
  assert.throws(() => mod.assertLancamentoNoRetiroAtivo({ pasto_id: 'p1' }, [{ id: 'p1' }], '', 'f1'), /mistura/);
});
