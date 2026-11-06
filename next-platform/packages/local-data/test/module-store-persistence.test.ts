import { mountModuleView } from '../../../qa/harness/module-view-browser';
import { moduleSeedSnapshot } from '../../../qa/harness/module-seed';
import { afterEach, describe, expect, it } from 'bun:test';
import { IndexedDbLocalData } from '../src';
import type { LocalMutation, ModuleAccountPartition, ModuleExecutionContext, ModuleLocalDataAPI } from '@consubov/contracts';
import { CapatazStore, resetCapatazStoresForTesting } from '../../../apps/fazenda/capataz/src/store/capatazStore';
import { GerenteStore } from '../../../apps/fazenda/gerente/src/store/gerenteStore';
import { EscritorioStore } from '../../../apps/fazenda/escritorio/src/store/escritorioStore';
import { FabricaStore } from '../../../apps/fazenda/fabrica/src/store/fabricaStore';

type StoreHandle = {
  ready: Promise<void>;
  state(): Record<string, any>;
  mutate(marker: string): Promise<{ command: { command_id: string; aggregate_type: string; aggregate_id: string } }>;
  contains(marker: string): boolean;
  dispose(): void;
};
type StoreDefinition = {
  profile: ModuleExecutionContext['profileId'];
  create(context: ModuleExecutionContext, api: ModuleLocalDataAPI): StoreHandle;
};

const activeStores: StoreHandle[] = [];
const databaseNames = new Set<string>();
const supported = typeof indexedDB !== 'undefined' && typeof crypto?.subtle !== 'undefined';
const suite = supported ? describe : describe.skip;

function makeContext(profile: ModuleExecutionContext['profileId'], account: string): ModuleExecutionContext {
  return {
    userId: `user-${account}`, tenantId: `tenant-${account}`, farmId: `farm-${account}`, retreatId: null,
    moduleId: profile, profileId: profile, deviceId: `device-${account}`, productId: 'consubov'
  };
}

function partitionOf(context: ModuleExecutionContext): ModuleAccountPartition {
  const { userId, tenantId, farmId, retreatId, moduleId, profileId, productId } = context;
  return { userId, tenantId, farmId, retreatId, moduleId, profileId, productId };
}

function dbName(context: ModuleExecutionContext): string {
  return `consubov-local-${encodeURIComponent(JSON.stringify([
    context.productId, context.moduleId, context.userId, context.tenantId, context.farmId, context.retreatId
  ]))}`;
}

function createHost(context: ModuleExecutionContext): { data: IndexedDbLocalData; api: ModuleLocalDataAPI } {
  const partition = partitionOf(context);
  databaseNames.add(dbName(context));
  const data = new IndexedDbLocalData(partition);
  const api: ModuleLocalDataAPI = {
    readSnapshot: <T,>(aggregateType: string, aggregateId: string) => data.readSnapshot<T>(context, aggregateType, aggregateId),
    listSnapshots: (aggregateType?: string) => data.listSnapshots(context, aggregateType),
    commitMutation: <T,>(mutation: LocalMutation<T>) => data.commitMutation(context, mutation),
    readAttachment: (attachmentId: string) => data.readAttachment(context, attachmentId),
    listPendingCommands: (limit: number) => data.listPendingCommands(context, limit),
    getCursor: () => data.getCursor(context),
    getSchemaVersion: () => data.getSchemaVersion(partition)
  };
  return { data, api };
}

async function provisionHost(context: ModuleExecutionContext) {
  const host = createHost(context);
  await host.data.provisionInitialSnapshot(context, moduleSeedSnapshot(context.moduleId));
  return host;
}

const definitions: StoreDefinition[] = [
  {
    profile: 'capataz',
    create(context, api) {
      const store = new CapatazStore(context, api);
      const handle: StoreHandle = {
        ready: store.ready,
        state: () => store.getState() as unknown as Record<string, any>,
        async mutate(marker) {
          const result = await store.registrarLeituraQrPasto({ pasto_id: marker, altura_media_cm: 71, qr_code_lido: `QR-${marker}` });
          return { command: result.envelope };
        },
        contains: marker => store.getState().leiturasQr.some(reading => reading.pasto_id === marker),
        dispose: () => store.destroy()
      };
      activeStores.push(handle);
      return handle;
    }
  },
  {
    profile: 'gerente',
    create(context, api) {
      const store = new GerenteStore(context, api);
      const handle: StoreHandle = {
        ready: store.ready,
        state: () => store.getState() as unknown as Record<string, any>,
        async mutate(marker) {
          const command = await store.definirMetas({
            lote_id: marker, gmd_alvo_kg_dia: 1.4, peso_final_alvo_kg: 500, data_alvo_abate: new Date().toISOString()
          });
          return { command };
        },
        contains: marker => marker in store.getState().baseVersions,
        dispose: () => undefined
      };
      activeStores.push(handle);
      return handle;
    }
  },
  {
    profile: 'escritorio',
    create(context, api) {
      const store = new EscritorioStore(context, api);
      const handle: StoreHandle = {
        ready: store.ready,
        state: () => store.getState() as unknown as Record<string, any>,
        async mutate(marker) {
          const command = await store.registrarNotaFiscal({
            nota_fiscal_id: marker, numero_nf: '90001', serie: '1', chave_acesso_nfe: '35261100000000000000550010001029381000000018',
            fornecedor_cnpj_cpf: '12345678000195', fornecedor_nome: 'Fornecedor QA', valor_total_brl: 100,
            data_emissao: new Date().toISOString(), itens: [{ produto_descricao: 'Insumo QA', quantidade: 1, unidade_medida: 'kg', valor_unitario_brl: 100, valor_total_item_brl: 100 }]
          });
          return { command };
        },
        contains: marker => store.getState().notasFiscais.some(invoice => invoice.nota_fiscal_id === marker),
        dispose: () => undefined
      };
      activeStores.push(handle);
      return handle;
    }
  },
  {
    profile: 'fabrica',
    create(context, api) {
      const store = new FabricaStore(context, api);
      const handle: StoreHandle = {
        ready: store.ready,
        state: () => store.getState() as unknown as Record<string, any>,
        async mutate(marker) {
          const command = await store.salvarFormula({
            formula_id: marker, nome_formula: 'Formula QA', tipo_raca_destino: 'nucleo', tamanho_batida_padrao_kg: 1000,
            ativo: true, ingredientes: [{ materia_prima_id: 'mp-qa', nome_ingrediente: 'Insumo QA', porcentagem_inclusao: 100 }]
          });
          return { command };
        },
        contains: marker => store.getState().formulas.some(formula => formula.formula_id === marker),
        dispose: () => undefined
      };
      activeStores.push(handle);
      return handle;
    }
  }
];

async function deleteDatabase(name: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`Could not delete ${name}.`));
    request.onblocked = () => reject(new Error(`Deletion blocked for ${name}.`));
  });
}

afterEach(async () => {
  for (const store of activeStores.splice(0)) store.dispose();
  resetCapatazStoresForTesting();
  for (const name of databaseNames) await deleteDatabase(name);
  databaseNames.clear();
});

suite('browser persistence through actual module stores and IndexedDB', () => {
  for (const definition of definitions) {
    it(`${definition.profile}: commits a real mutation, hydrates a fresh store, and isolates another account`, async () => {
      const account = crypto.randomUUID();
      const context = makeContext(definition.profile, account);
      const { data, api } = await provisionHost(context);
      const marker = `persist-${definition.profile}-${account}`;
      const first = definition.create(context, api);
      await first.ready;
      const { command } = await first.mutate(marker);

      expect(first.contains(marker)).toBe(true);
      expect((await data.listPendingCommands(context, 50)).map(item => item.command.command_id)).toContain(command.command_id);
      expect(await data.readSnapshot(context, command.aggregate_type, command.aggregate_id)).not.toBeNull();

      const committedCommand = (await data.listPendingCommands(context, 50)).find(item => item.command.command_id === command.command_id)?.command;
      const committedSnapshot = await data.readSnapshot(context, command.aggregate_type, command.aggregate_id);
      if (!committedCommand || !committedSnapshot) throw new Error('Persisted module mutation is missing from IndexedDB.');
      await expect(data.commitMutation(context, { command: committedCommand, snapshot: committedSnapshot, attachments: [] }))
        .rejects.toThrow('ID de comando já utilizado');
      expect((await data.listPendingCommands(context, 50)).map(item => item.command.command_id)).toEqual([command.command_id]);
      expect(await data.readSnapshot(context, command.aggregate_type, command.aggregate_id)).toEqual(committedSnapshot);

      const withoutRevision = {
        command: { ...committedCommand, command_id: crypto.randomUUID(), base_version: committedSnapshot.version },
        snapshot: { ...committedSnapshot, version: committedSnapshot.version + 1 },
        attachments: []
      };
      await expect(data.commitMutation(context, withoutRevision)).rejects.toThrow('revisão de módulo explícita');
      expect(await data.listPendingCommands(context, 50)).toHaveLength(1);

      const reopenedHost = createHost(context);
      const reopened = definition.create(context, reopenedHost.api);
      await reopened.ready;
      expect(reopened.contains(marker)).toBe(true);
      expect(reopened.state().outbox.map((item: { command_id: string }) => item.command_id)).toContain(command.command_id);

      const otherContext = makeContext(definition.profile, `other-${account}`);
      const otherHost = await provisionHost(otherContext);
      const other = definition.create(otherContext, otherHost.api);
      await other.ready;
      expect(other.contains(marker)).toBe(false);
      expect(await otherHost.data.listPendingCommands(otherContext, 50)).toHaveLength(0);
    });

    for (const legacy of [false, true]) {
    it(`${definition.profile}: rejects stale cross-aggregate state (${legacy ? 'legacy migration' : 'module revision'}) and reloads before retry`, async () => {
      const context = makeContext(definition.profile, `concurrent-${crypto.randomUUID()}`);
      const firstHost = await provisionHost(context);
      const first = definition.create(context, firstHost.api);
      const second = definition.create(context, createHost(context).api);
      await Promise.all([first.ready, second.ready]);
      // Simulate a delayed/missed broadcast: correctness must rely on the durable CAS.
      second.dispose();
      const markerA = `first-${crypto.randomUUID()}`;
      const markerB = `second-${crypto.randomUUID()}`;
      const { command: firstCommand } = await first.mutate(markerA);
      if (legacy) {
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.open(dbName(context));
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('meta', 'readwrite');
            tx.objectStore('meta').delete('moduleStateRevision');
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onabort = () => { db.close(); reject(tx.error); };
          };
        });
      }
      await expect(second.mutate(markerB)).rejects.toBeDefined();
      expect(second.contains(markerA)).toBe(true);
      expect(second.contains(markerB)).toBe(false);
      expect(await firstHost.data.listPendingCommands(context, 50)).toHaveLength(1);
      expect((await firstHost.data.listSnapshots(context)).filter(item => item.aggregateId !== 'bootstrap').map(item => item.aggregateId)).toEqual([firstCommand.aggregate_id]);
      const { command: secondCommand } = await second.mutate(markerB);
      const reopened = definition.create(context, createHost(context).api);
      await reopened.ready;
      expect(reopened.contains(markerA)).toBe(true);
      expect(reopened.contains(markerB)).toBe(true);
      const ids = (await firstHost.data.listPendingCommands(context, 50)).map(item => item.command.command_id);
      expect(ids).toHaveLength(2);
      expect(ids).toContain(firstCommand.command_id);
      expect(ids).toContain(secondCommand.command_id);
    });

    }

    for (const damage of ['missing', 'invalid']) {
      it(`${definition.profile}: ${damage} durable state blocks hydration, writes and misleading reseeding`, async () => {
        const context = makeContext(definition.profile, `${damage}-${crypto.randomUUID()}`);
        const host = await provisionHost(context);
        const original = definition.create(context, host.api);
        await original.ready;
        const marker = `before-damage-${crypto.randomUUID()}`;
        const { command } = await original.mutate(marker);
        original.dispose();
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.open(dbName(context));
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('snapshots', 'readwrite');
            const store = tx.objectStore('snapshots');
            store.clear();
            if (damage === 'invalid') store.put({ key: 'damaged', aggregateType: 'module-state', aggregateId: 'damaged', version: 1, data: {}, modifiedAt: new Date().toISOString() });
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onabort = () => { db.close(); reject(tx.error); };
          };
        });
        const snapshotsBefore = await host.data.listSnapshots(context);
        const failed = definition.create(context, createHost(context).api);
        await expect(failed.ready).rejects.toBeDefined();
        expect(failed.contains(marker)).toBe(false);
        expect(failed.state().lotes ?? failed.state().formulas).toHaveLength(0);
        await expect(failed.mutate(`blocked-${crypto.randomUUID()}`)).rejects.toBeDefined();
        await expect(host.data.provisionInitialSnapshot(context, moduleSeedSnapshot(context.moduleId))).rejects.toBeDefined();
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = mountModuleView(container, context, host.api);
        try {
          const deadline = Date.now() + 2000;
          while (!container.querySelector('[role="alert"]') && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
          expect(container.querySelector('[role="alert"]')).not.toBeNull();
          expect(container.querySelector('form')).toBeNull();
        } finally { root.unmount(); container.remove(); }
        expect(await host.data.listSnapshots(context)).toEqual(snapshotsBefore);
        expect((await host.data.listPendingCommands(context, 50)).map(item => item.command.command_id)).toEqual([command.command_id]);
      });
    }

    it(`${definition.profile}: trusted bootstrap persists initial data without replacing existing work`, async () => {
      const context = makeContext(definition.profile, `bootstrap-${crypto.randomUUID()}`);
      const host = createHost(context);
      const seed = moduleSeedSnapshot(context.moduleId);
      await host.data.provisionInitialSnapshot(context, seed);
      expect(await host.data.readSnapshot(context, 'module-state', 'bootstrap')).not.toBeNull();
      expect(await host.data.listPendingCommands(context, 50)).toHaveLength(0);
      const reopened = definition.create(context, createHost(context).api);
      await reopened.ready;
      const marker = `after-seed-${crypto.randomUUID()}`;
      await reopened.mutate(marker);
      await host.data.provisionInitialSnapshot(context, seed);
      const after = definition.create(context, createHost(context).api);
      await after.ready;
      expect(after.contains(marker)).toBe(true);
      expect(await host.data.listPendingCommands(context, 50)).toHaveLength(1);
    });

    it(`${definition.profile}: quota failure rejects the store mutation and rolls back snapshot and outbox`, async () => {
      const account = `quota-${crypto.randomUUID()}`;
      const context = makeContext(definition.profile, account);
      const { data, api } = await provisionHost(context);
      const store = definition.create(context, api);
      await store.ready;
      const originalAdd = IDBObjectStore.prototype.add;
      const originalPut = IDBObjectStore.prototype.put;
      let capturedSnapshot: { aggregateType: string; aggregateId: string } | null = null;
      let quotaInjected = false;
      IDBObjectStore.prototype.put = function(value: unknown, key?: IDBValidKey) {
        if (this.name === 'snapshots' && value && typeof value === 'object') {
          const record = value as { aggregateType?: string; aggregateId?: string };
          if (record.aggregateType && record.aggregateId) capturedSnapshot = { aggregateType: record.aggregateType, aggregateId: record.aggregateId };
        }
        return originalPut.call(this, value, key);
      };
      IDBObjectStore.prototype.add = function(value: unknown, key?: IDBValidKey) {
        if (this.name === 'outbox') {
          quotaInjected = true;
          throw new DOMException('Browser quota exhausted by persistence test.', 'QuotaExceededError');
        }
        return originalAdd.call(this, value, key);
      };
      try {
        await expect(store.mutate(`quota-mutation-${definition.profile}-${account}`)).rejects.toBeDefined();
      } finally {
        IDBObjectStore.prototype.add = originalAdd;
        IDBObjectStore.prototype.put = originalPut;
      }
      expect(quotaInjected).toBe(true);
      expect(capturedSnapshot).not.toBeNull();
      const key = capturedSnapshot!;
      expect(await data.readSnapshot(context, key.aggregateType, key.aggregateId)).toBeNull();
      expect(await data.listPendingCommands(context, 50)).toHaveLength(0);
    });
  }
});
