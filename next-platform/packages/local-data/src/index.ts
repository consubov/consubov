import {
  commandApiResponseSchema,
  isProfileAuthorizedForCommand,
  moduleExecutionContextSchema,
  syncDeltaItemSchema,
  operationIssueSchema,
  type AtomicCommandEnvelope,
  type CommandApiResponse,
  type LocalDataAPI,
  type LocalMutation,
  type LocalMutationResult,
  type LocalPendingCommand,
  type LocalPullCommit,
  type LocalSnapshot,
  type ModuleAccountPartition,
  type ModuleExecutionContext,
  type OperationIssue,
  type SyncDeltaItem
} from '@consubov/contracts';

const DB_VERSION = 2;
const MAX_LIST_SNAPSHOTS = 500;
const STORES = ['snapshots', 'outbox', 'attachments', 'cursors', 'acks', 'conflicts', 'meta'] as const;
type StoreName = typeof STORES[number];

interface StoredCommand { commandId: string; command: AtomicCommandEnvelope<unknown>; attachmentRefs: LocalPendingCommand['attachmentRefs']; sequence?: number; }
interface StoredAttachment { attachmentId: string; ref: LocalMutation['attachments'][number]['ref']; bytes?: ArrayBuffer; blob?: Blob; }
interface StoredCursor { name: 'pull'; value: string; }
interface StoredMeta { name: string; value: unknown; }

function identityKey(value: ModuleAccountPartition): string {
  return JSON.stringify([
    value.productId,
    value.moduleId,
    value.userId,
    value.tenantId,
    value.farmId,
    value.retreatId
  ]);
}

function openDatabase(partition: ModuleAccountPartition): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB indisponível neste ambiente.'));
  const name = `consubov-local-${encodeURIComponent(identityKey(partition))}`;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DB_VERSION);
    request.onupgradeneeded = event => {
      const db = request.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          const keyPath = store === 'snapshots' ? 'key'
            : store === 'outbox' ? 'commandId'
            : store === 'attachments' ? 'attachmentId'
            : store === 'cursors' ? 'name'
            : store === 'meta' ? 'name'
            : store === 'acks' ? 'commandId'
            : 'commandId';
          db.createObjectStore(store, { keyPath });
        }
      }
      const snapshots = request.transaction?.objectStore('snapshots');
      if (snapshots && !snapshots.indexNames.contains('byModifiedAt')) {
        snapshots.createIndex('byModifiedAt', 'modifiedAt');
      }
      if ((event as IDBVersionChangeEvent).oldVersion < 2 && snapshots) {
        const cursorRequest = snapshots.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          const snapshot = cursor.value as LocalSnapshot & { key: string };
          const migratedKey = snapshotKey(snapshot.aggregateType, snapshot.aggregateId);
          if (cursor.primaryKey !== migratedKey) {
            // IndexedDB forbids changing an inline primary key through cursor.update.
            snapshots.put({ ...snapshot, key: migratedKey });
            cursor.delete();
          }
          cursor.continue();
        };
      }
      request.transaction?.objectStore('meta').put({ name: 'schemaVersion', value: DB_VERSION } satisfies StoredMeta);
    };
    request.onerror = () => reject(request.error ?? new Error('Falha ao abrir IndexedDB.'));
    request.onblocked = () => reject(new Error('Migração IndexedDB bloqueada por outra aba.'));
    request.onsuccess = () => resolve(request.result);
  });
}

function runTransaction<T>(partition: ModuleAccountPartition, stores: StoreName[], mode: IDBTransactionMode, action: (tx: IDBTransaction, setResult: (value: T) => void, abortWith: (error: Error) => void) => void): Promise<T> {
  return openDatabase(partition).then(db => new Promise<T>((resolve, reject) => {
    let result: T;
    let hasResult = false;
    let settled = false;
    let abortReason: Error | null = null;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      db.close();
      reject(error instanceof Error ? error : new Error('Transação IndexedDB falhou.'));
    };
    let tx!: IDBTransaction;
    try {
      tx = db.transaction(stores, mode);
      action(tx, value => { result = value; hasResult = true; }, error => {
        abortReason = error;
        try { tx.abort(); }
        catch { fail(error); }
      });
    } catch (error) {
      // A synchronous request error must roll back requests already queued in this transaction.
      try { tx?.abort(); } catch { /* An already finished transaction cannot be aborted. */ }
      db.close();
      reject(error);
      return;
    }
    tx.oncomplete = () => {
      db.close();
      if (!hasResult) {
        if (result === undefined) {
          settled = true;
          resolve(undefined as T);
          return;
        }
        return reject(new Error('Transação concluída sem resultado.'));
      }
      settled = true;
      resolve(result!);
    };
    tx.onabort = () => fail(abortReason ?? tx.error ?? new Error('Transação IndexedDB cancelada.'));
    // IndexedDB emits `error` before the final `abort`; wait for `abort` so an
    // explicit abortWith reason is preserved across browser implementations.
    tx.onerror = () => undefined;
  }));
}

function assertContext(context: ModuleExecutionContext, partition?: ModuleAccountPartition): ModuleExecutionContext {
  const parsed = moduleExecutionContextSchema.parse(context);
  if (partition && identityKey(parsed) !== identityKey(partition)) throw new Error('Contexto não autorizado para esta partição local.');
  return parsed;
}

function snapshotKey(aggregateType: string, aggregateId: string): string { return JSON.stringify([aggregateType, aggregateId]); }
function assertCommandScope(command: AtomicCommandEnvelope<unknown>, context: ModuleExecutionContext): void {
  if (command.user_id !== context.userId || command.tenant_id !== context.tenantId || command.fazenda_id !== context.farmId || command.retiro_id !== context.retreatId || command.profile_id !== context.profileId || command.product_id !== context.productId || command.device_id !== context.deviceId) {
    throw new Error('Comando fora do contexto autenticado da partição local.');
  }
}

async function verifyAttachment(ref: LocalMutation['attachments'][number]['ref'], blob: Blob): Promise<void> {
  if (blob.size !== ref.size_bytes || blob.type !== ref.mime_type) throw new Error('Anexo diverge dos metadados declarados.');
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== ref.hash_sha256.toLowerCase()) throw new Error('Integridade SHA-256 do anexo inválida.');
}

const STALE_MODULE_STATE = 'Estado local desatualizado; os dados foram recarregados. Revise e tente salvar novamente.';

function wholeStateRevision(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null;
  const state = data as Record<string, any>;
  const wrapped = state.schema === 'escritorio-state-v1';
  const known = wrapped || ('pastos' in state && 'leiturasQr' in state) ||
    ('gmdConfig' in state && 'lotes' in state) || ('misturadores' in state && 'formulas' in state);
  if (!known) return null;
  const revision = wrapped ? state.revision : (state.localRevision ?? 0);
  if (!Number.isSafeInteger(revision) || revision < 0 ||
      (wrapped && state.state?.localRevision !== revision)) throw new Error('Revisão do estado local inválida.');
  return revision;
}

function isValidModuleState(moduleId: ModuleExecutionContext['moduleId'], data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const wrapped = data as Record<string, any>;
  const state = moduleId === 'escritorio' ? wrapped.state : wrapped;
  if (!state || typeof state !== 'object' || !state.baseVersions || typeof state.baseVersions !== 'object' ||
      !Array.isArray(state.outbox)) return false;
  const arrays = moduleId === 'capataz' ? ['pastos', 'lotes', 'produtos', 'leiturasCocho', 'leiturasQr', 'contagens', 'syncedCommands', 'conflitos']
    : moduleId === 'gerente' ? ['lotes', 'custos', 'auditoriasCocho']
    : moduleId === 'fabrica' ? ['misturadores', 'formulas', 'batidas', 'silos', 'calibracoes']
    : ['notasFiscais', 'pedidosCompra', 'lotes', 'fechamentos'];
  if (!arrays.every(key => Array.isArray(state[key]))) return false;
  if (moduleId === 'capataz' && (!state.fotos || typeof state.fotos !== 'object' || !Number.isSafeInteger(state.localRevision) || state.localRevision < 0)) return false;
  if (moduleId !== 'capataz' && (!state.kpis || typeof state.kpis !== 'object')) return false;
  if (moduleId === 'gerente' && (!state.gmdConfig || typeof state.gmdConfig !== 'object')) return false;
  if (moduleId === 'escritorio' && wrapped.schema !== 'escritorio-state-v1') return false;
  try { return wholeStateRevision(data) !== null; } catch { return false; }
}

function verifyPhotoDependencies(tx: IDBTransaction, moduleId: ModuleExecutionContext['moduleId'], data: unknown, supplied: readonly StoredAttachment[], ready: () => void, abortWith: (error: Error) => void): void {
  const photos = moduleId === 'capataz' ? (data as Record<string, any>).fotos as Record<string, any> : {};
  const entries = Object.entries(photos);
  let remaining = entries.length;
  let failed = false;
  if (!remaining) { ready(); return; }
  for (const [id, metadata] of entries) {
    if (failed) break;
    const verify = (attachment: StoredAttachment | undefined) => {
      if (failed) return;
      if (!attachment || attachment.ref.attachment_id !== id || metadata.attachment_id !== id || attachment.ref.mime_type !== metadata.mimeType || attachment.ref.size_bytes !== metadata.compressedSizeBytes) {
        failed = true;
        abortWith(new Error('Projeção referencia foto ausente ou metadados divergentes.'));
        return;
      }
      if (--remaining === 0) ready();
    };
    const candidate = supplied.find(item => item.attachmentId === id);
    if (candidate) verify(candidate);
    else {
      const request = tx.objectStore('attachments').get(id);
      request.onsuccess = () => verify(request.result as StoredAttachment | undefined);
    }
  }
}

async function preparePullAttachments(attachments: LocalPullCommit['attachments']): Promise<StoredAttachment[]> {
  const records: StoredAttachment[] = [];
  const seen = new Set<string>();
  for (const attachment of attachments ?? []) {
    if (seen.has(attachment.ref.attachment_id)) throw new Error('Anexo duplicado no pull.');
    seen.add(attachment.ref.attachment_id);
    await verifyAttachment(attachment.ref, attachment.blob);
    records.push({ attachmentId: attachment.ref.attachment_id, ref: attachment.ref, bytes: await attachment.blob.arrayBuffer() });
  }
  return records;
}

export class IndexedDbLocalData implements LocalDataAPI {
  private partition: ModuleAccountPartition;
  constructor(partition: ModuleAccountPartition, private isContextActive: () => boolean = () => true) { this.partition = { ...partition }; }

  private assertActive(): void {
    if (!this.isContextActive()) throw new Error('Contexto local encerrado.');
  }

  async provisionInitialSnapshot(context: ModuleExecutionContext, snapshot: LocalSnapshot, attachments?: LocalPullCommit['attachments']): Promise<void> {
    assertContext(context, this.partition);
    const data = snapshot.data as Record<string, any>;
    const matchesModule = isValidModuleState(context.moduleId, data);
    const initialRevision = wholeStateRevision(data);
    if (!matchesModule || initialRevision === null || !Number.isSafeInteger(snapshot.version) || snapshot.version < 0 ||
        !snapshot.aggregateType || !snapshot.aggregateId || !Number.isFinite(Date.parse(snapshot.modifiedAt))) {
      throw new Error('Snapshot inicial inválido para o módulo autorizado.');
    }
    const binaries = await preparePullAttachments(attachments);
    await runTransaction(this.partition, ['snapshots', 'meta', 'outbox', 'attachments'], 'readwrite', (tx, _set, abortWith) => {
      this.assertActive();
      const store = tx.objectStore('snapshots');
      const count = store.count();
      count.onsuccess = () => {
        if (count.result > 0) {
          const cursorRequest = store.openCursor();
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) { abortWith(new Error('Os dados locais existentes estão inválidos; o provisionamento foi bloqueado para preservar os registros.')); return; }
            if (isValidModuleState(context.moduleId, cursor.value.data)) return;
            cursor.continue();
          };
          return;
        }
        const pending = tx.objectStore('outbox').count();
        pending.onsuccess = () => {
          // A missing projection with durable pending work is corruption, not a
          // first provisioning. A fresh seed would conceal those local changes.
          if (pending.result > 0) { abortWith(new Error('Existem operações locais sem snapshot válido; o provisionamento foi bloqueado para preservar os registros.')); return; }
          verifyPhotoDependencies(tx, context.moduleId, snapshot.data, binaries, () => { try {
            this.assertActive();
            for (const attachment of binaries) tx.objectStore('attachments').put(attachment);
            store.add({ ...snapshot, key: snapshotKey(snapshot.aggregateType, snapshot.aggregateId) });
            tx.objectStore('meta').put({ name: 'moduleStateRevision', value: initialRevision } satisfies StoredMeta);
            tx.objectStore('meta').put({ name: 'serverModuleRevision', value: snapshot.version } satisfies StoredMeta);
          } catch (error) { abortWith(error instanceof Error ? error : new Error('Falha ao provisionar dados.')); } }, abortWith);
        };
      };
    });
  }

  async readSnapshot<T>(context: ModuleExecutionContext, aggregateType: string, aggregateId: string): Promise<LocalSnapshot<T> | null> {
    assertContext(context, this.partition);
    return runTransaction(this.partition, ['snapshots'], 'readonly', (tx, set) => {
      const request = tx.objectStore('snapshots').get(snapshotKey(aggregateType, aggregateId));
      request.onsuccess = () => set((request.result as LocalSnapshot<T> | undefined) ?? null);
    });
  }

  async listSnapshots(context: ModuleExecutionContext, aggregateType?: string): Promise<readonly LocalSnapshot[]> {
    assertContext(context, this.partition);
    if (aggregateType !== undefined && (typeof aggregateType !== 'string' || aggregateType.length === 0 || aggregateType.length > 128)) {
      throw new Error('Tipo de agregado inválido para listar snapshots.');
    }
    return runTransaction(this.partition, ['snapshots'], 'readonly', (tx, set) => {
      const cursorRequest = tx.objectStore('snapshots').index('byModifiedAt').openCursor(null, 'prev');
      const records: LocalSnapshot[] = [];
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor || records.length >= MAX_LIST_SNAPSHOTS) {
          set(records);
          return;
        }
        const { key: _key, ...snapshot } = cursor.value as LocalSnapshot & { key: string };
        if (aggregateType === undefined || snapshot.aggregateType === aggregateType) records.push(snapshot);
        cursor.continue();
      };
    });
  }

  async commitMutation<T>(context: ModuleExecutionContext, mutation: LocalMutation<T>): Promise<LocalMutationResult> {
    assertContext(context, this.partition);
    assertCommandScope(mutation.command as AtomicCommandEnvelope<unknown>, context);
    if (!isProfileAuthorizedForCommand(context.profileId, mutation.command.command_type)) {
      throw new Error('Comando não autorizado para o perfil desta partição.');
    }
    if (mutation.snapshot.aggregateId !== mutation.command.aggregate_id || mutation.snapshot.aggregateType !== mutation.command.aggregate_type) throw new Error('Snapshot não corresponde ao agregado do comando.');
    const refs = new Map(mutation.attachments.map(attachment => [attachment.ref.attachment_id, attachment]));
    if (refs.size !== mutation.attachments.length || refs.size !== mutation.command.attachment_refs.length || mutation.command.attachment_refs.some(ref => !refs.has(ref.attachment_id))) throw new Error('Referência de anexo ausente ou duplicada na mutação.');
    const commandAttachmentIds = new Set(mutation.command.attachment_refs.map(ref => ref.attachment_id));
    if (commandAttachmentIds.size !== mutation.command.attachment_refs.length || mutation.command.attachment_refs.some(ref => {
      const actual = refs.get(ref.attachment_id)!.ref;
      return actual.mime_type !== ref.mime_type || actual.size_bytes !== ref.size_bytes ||
        actual.hash_sha256.toLowerCase() !== ref.hash_sha256.toLowerCase() || actual.local_blob_ref !== ref.local_blob_ref;
    })) throw new Error('Metadados do anexo divergem da referência do comando.');
    for (const attachment of mutation.attachments) await verifyAttachment(attachment.ref, attachment.blob);
    const persistedAttachments = await Promise.all(mutation.attachments.map(async attachment => ({
      attachmentId: attachment.ref.attachment_id,
      ref: attachment.ref,
      bytes: await attachment.blob.arrayBuffer()
    } satisfies StoredAttachment)));

    if (!Number.isSafeInteger(mutation.command.base_version) || mutation.command.base_version < 0 ||
        !Number.isSafeInteger(mutation.snapshot.version) || mutation.snapshot.version !== mutation.command.base_version + 1) {
      throw new Error('Versão do snapshot deve ser a próxima versão da base do comando.');
    }

    const snapshot = { ...mutation.snapshot, key: snapshotKey(mutation.snapshot.aggregateType, mutation.snapshot.aggregateId) };
    const stored: StoredCommand = { commandId: mutation.command.command_id, command: mutation.command as AtomicCommandEnvelope<unknown>, attachmentRefs: mutation.command.attachment_refs };
    const nextModuleRevision = wholeStateRevision(mutation.snapshot.data);
    return runTransaction(this.partition, ['snapshots', 'outbox', 'attachments', 'acks', 'conflicts', 'meta'], 'readwrite', (tx, set, abortWith) => {
      this.assertActive();
      const commandId = mutation.command.command_id;
      const snapshotStore = tx.objectStore('snapshots');
      const existingSnapshotRequest = snapshotStore.get(snapshot.key);
      existingSnapshotRequest.onsuccess = () => {
        const existingSnapshot = existingSnapshotRequest.result as (LocalSnapshot & { key: string }) | undefined;
        const duplicateStores = ['outbox', 'acks', 'conflicts'] as const;
        let remaining = duplicateStores.length + 1;
        let currentModuleRevision = 0;
        let duplicateFound = false;
        const continueCommit = () => {
          if (--remaining !== 0) return;
          if (duplicateFound) {
            abortWith(new Error('ID de comando já utilizado nesta partição local.'));
            return;
          }
          const expected = mutation.expectedModuleRevision;
          if ((nextModuleRevision !== null && expected === undefined) ||
              (expected !== undefined && (!Number.isSafeInteger(expected) || expected < 0 ||
                (nextModuleRevision !== null && nextModuleRevision !== expected + 1)))) {
            abortWith(new Error('Mutação de estado completo exige revisão de módulo explícita e sequencial.'));
            return;
          }
          if (expected !== undefined && expected !== currentModuleRevision) {
            const error = new Error(STALE_MODULE_STATE);
            error.name = 'StaleModuleStateError';
            abortWith(error);
            return;
          }
          // A pending local write is the current base for the next local write on this aggregate.
          if (existingSnapshot && existingSnapshot.version !== mutation.command.base_version) {
            abortWith(new Error('Versão local do agregado desatualizada para este comando.'));
            return;
          }

          try {
            this.assertActive();
            snapshotStore.put(snapshot);
            if (expected !== undefined) tx.objectStore('meta').put({ name: 'moduleStateRevision', value: expected + 1 } satisfies StoredMeta);
            // `add` preserves immutable outbox identity; unlike `put`, retries cannot replace an entry.
            tx.objectStore('outbox').add({ ...stored, sequence: expected === undefined ? undefined : expected + 1 });
            for (const attachment of persistedAttachments) tx.objectStore('attachments').put(attachment);
            set({ commandId, committed: true });
          } catch (error) {
            abortWith(error instanceof Error ? error : new Error('Falha ao gravar mutação local.'));
          }
        };
        const revisionRequest = tx.objectStore('meta').get('moduleStateRevision');
        revisionRequest.onsuccess = () => {
          if (revisionRequest.result !== undefined) {
            const value = (revisionRequest.result as StoredMeta).value;
            if (!Number.isSafeInteger(value) || Number(value) < 0) { abortWith(new Error('Revisão persistida inválida.')); return; }
            currentModuleRevision = Number(value);
            continueCommit();
          } else {
            // Existing databases predate module-level CAS. Derive their actual latest
            // state inside the same transaction instead of resetting the revision.
            const snapshotsRequest = snapshotStore.openCursor();
            snapshotsRequest.onsuccess = () => {
              const cursor = snapshotsRequest.result;
              if (!cursor) { continueCommit(); return; }
              try { currentModuleRevision = Math.max(currentModuleRevision, wholeStateRevision(cursor.value.data) ?? 0); }
              catch (error) { abortWith(error instanceof Error ? error : new Error('Estado local inválido.')); return; }
              cursor.continue();
            };
          }
        };
        for (const storeName of duplicateStores) {
          const request = tx.objectStore(storeName).get(commandId);
          request.onsuccess = () => {
            if (request.result !== undefined) duplicateFound = true;
            continueCommit();
          };
        }
      };
    });
  }

  async readAttachment(context: ModuleExecutionContext, attachmentId: string): Promise<{ ref: LocalMutation['attachments'][number]['ref']; blob: Blob } | null> {
    assertContext(context, this.partition);
    const attachment = await runTransaction<{ ref: LocalMutation['attachments'][number]['ref']; blob: Blob } | null>(this.partition, ['attachments'], 'readonly', (tx, set) => {
      const request = tx.objectStore('attachments').get(attachmentId);
      request.onsuccess = () => {
        const record = request.result as StoredAttachment | undefined;
        if (!record) { set(null); return; }
        // Older partitions stored Blob values directly; retain those while new writes use portable bytes.
        const blob = record.bytes instanceof ArrayBuffer
          ? new Blob([record.bytes], { type: record.ref.mime_type })
          : record.blob;
        if (!(blob instanceof Blob)) { tx.abort(); return; }
        set({ ref: record.ref, blob });
      };
    });
    if (attachment) await verifyAttachment(attachment.ref, attachment.blob);
    return attachment;
  }

  async listPendingCommands(context: ModuleExecutionContext, limit: number): Promise<readonly LocalPendingCommand[]> {
    assertContext(context, this.partition);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('Limite de outbox inválido.');
    return runTransaction(this.partition, ['outbox'], 'readonly', (tx, set) => {
      const request = tx.objectStore('outbox').getAll();
      request.onsuccess = () => set((request.result as StoredCommand[]).sort((a, b) => {
        if (a.sequence !== undefined && b.sequence !== undefined) return a.sequence - b.sequence;
        // Legacy rows lack module CAS; same-aggregate base versions still order
        // dependent commands when the device timestamp has millisecond ties.
        if (a.command.aggregate_type === b.command.aggregate_type && a.command.aggregate_id === b.command.aggregate_id) return a.command.base_version - b.command.base_version;
        return a.command.occurred_at_local.localeCompare(b.command.occurred_at_local) || a.command.command_id.localeCompare(b.command.command_id);
      }).slice(0, limit).map(({ command, attachmentRefs }) => ({ command: command as AtomicCommandEnvelope, attachmentRefs })));
    });
  }

  async listOperationIssues(context: ModuleExecutionContext, limit = 500): Promise<readonly OperationIssue[]> {
    assertContext(context, this.partition);
    this.assertActive();
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('Limite de problemas de operação inválido.');
    return runTransaction(this.partition, ['conflicts', 'outbox'], 'readonly', (tx, set, abortWith) => {
      this.assertActive();
      const issues: OperationIssue[] = [];
      let scanned = 0;
      const finish = () => set(issues.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || a.commandId.localeCompare(b.commandId)));
      const request = tx.objectStore('conflicts').openCursor();
      request.onsuccess = () => {
        try {
          this.assertActive();
          const cursor = request.result;
          if (!cursor || scanned >= limit) {
            finish();
            return;
          }
          scanned++;
          const row = cursor.value as { commandId?: unknown; recordedAt?: unknown; response?: unknown };
          if (typeof row.commandId !== 'string' || row.commandId !== cursor.primaryKey) throw new Error('Registro de problema de operação inválido.');
          const response = commandApiResponseSchema.parse(row.response);
          if (response.success) throw new Error('Registro de problema não pode conter confirmação.');
          const responseId = 'conflict' in response ? response.conflict.command_id : 'validation' in response ? response.validation.command_id : response.security.command_id;
          if (responseId !== row.commandId) throw new Error('Problema de operação não corresponde ao comando.');
          const pending = tx.objectStore('outbox').get(row.commandId);
          pending.onsuccess = () => {
            try {
              this.assertActive();
              const stored = pending.result as StoredCommand | undefined;
              // Historical resolved records cannot become a current operation issue.
              const advance = () => { if (scanned >= limit) finish(); else cursor.continue(); };
              if (!stored) { advance(); return; }
              if (stored.commandId !== row.commandId || stored.command.command_id !== row.commandId) throw new Error('Identidade do comando pendente inválida.');
              assertCommandScope(stored.command, context);
              if (!isProfileAuthorizedForCommand(context.profileId, stored.command.command_type)) throw new Error('Operação fora do perfil autorizado.');
              const common = {
                commandId: stored.commandId, commandType: stored.command.command_type,
                aggregateType: stored.command.aggregate_type, aggregateId: stored.command.aggregate_id,
                occurredAt: stored.command.occurred_at_local, recordedAt: row.recordedAt,
                baseVersion: stored.command.base_version
              };
              if ('conflict' in response) {
                if (response.conflict.aggregate_id !== stored.command.aggregate_id || response.conflict.base_version !== stored.command.base_version) throw new Error('Conflito fora do agregado ou versão do comando pendente.');
                issues.push(operationIssueSchema.parse({ ...common, kind: 'conflict', currentVersion: response.conflict.current_version }));
              } else if ('validation' in response) {
                issues.push(operationIssueSchema.parse({ ...common, kind: 'validation', violations: response.validation.violations.map(({ field, code, message }) => ({ field, code, message })) }));
              } else issues.push(operationIssueSchema.parse({ ...common, kind: 'security' }));
              advance();
            } catch { abortWith(new Error('Registro de problema de operação inválido para este contexto.')); }
          };
        } catch { abortWith(new Error('Registro de problema de operação inválido para este contexto.')); }
      };
    });
  }

  async applyCommandResponse(context: ModuleExecutionContext, response: CommandApiResponse, canCommit: () => boolean = () => true): Promise<void> {
    assertContext(context, this.partition);
    const parsed = commandApiResponseSchema.parse(response);
    const commandId = parsed.success ? parsed.ack.command_id : 'conflict' in parsed ? parsed.conflict.command_id : 'validation' in parsed ? parsed.validation.command_id : parsed.security.command_id;
    if (!commandId) throw new Error('Resposta de comando sem identificador.');
    await runTransaction(this.partition, ['outbox', 'acks', 'conflicts'], 'readwrite', (tx, _set, abortWith) => {
      this.assertActive();
      if (!canCommit()) throw new Error('Lease de sincronização encerrado.');
      const request = tx.objectStore('outbox').get(commandId);
      request.onsuccess = () => {
        try {
          this.assertActive();
          if (!canCommit()) throw new Error('Lease de sincronização encerrado.');
          const stored = request.result as StoredCommand | undefined;
          if (!stored) {
            const previous = tx.objectStore('acks').get(commandId);
            previous.onsuccess = () => {
              try {
                this.assertActive();
                if (!canCommit()) throw new Error('Lease de sincronização encerrado.');
                if (!parsed.success || JSON.stringify(previous.result?.response) !== JSON.stringify(parsed)) abortWith(new Error('Resposta sem comando pendente correspondente.'));
              } catch (error) { abortWith(error instanceof Error ? error : new Error('Contexto encerrado.')); }
            };
            return;
          }
          assertCommandScope(stored.command, context);
          if (parsed.success) {
            if (parsed.ack.aggregate_id !== stored.command.aggregate_id || parsed.ack.aggregate_version !== stored.command.base_version + 1 || parsed.ack.correlation_id !== stored.command.correlation_id) {
              abortWith(new Error('ACK não corresponde ao agregado, versão ou correlação do comando pendente.'));
              return;
            }
            tx.objectStore('outbox').delete(commandId);
            tx.objectStore('acks').put({ commandId, response: parsed });
            tx.objectStore('conflicts').delete(commandId);
          } else {
            if ('conflict' in parsed && (parsed.conflict.aggregate_id !== stored.command.aggregate_id || parsed.conflict.base_version !== stored.command.base_version)) {
              abortWith(new Error('Conflito não corresponde ao comando pendente.'));
              return;
            }
            tx.objectStore('conflicts').put({ commandId, response: parsed, recordedAt: new Date().toISOString() });
          }
        } catch (error) { abortWith(error instanceof Error ? error : new Error('Resposta inválida.')); }
      };
    });
  }

  async commitPull(context: ModuleExecutionContext, pull: LocalPullCommit, canCommit: () => boolean = () => true): Promise<void> {
    assertContext(context, this.partition);
    if (typeof pull.nextCursor !== 'string' || !pull.nextCursor.trim() || pull.nextCursor.length > 512 || pull.deltas.length > 500) throw new Error('Pull inválido.');
    const deltas = pull.deltas.map(delta => syncDeltaItemSchema.parse(delta));
    let latest: SyncDeltaItem | undefined;
    for (const delta of deltas) {
      // Stores consume complete module projections. Entity payloads cannot safely
      // replace their snapshots, and no generic domain merge is authorized.
      if (delta.aggregate_type !== 'module-state' || delta.aggregate_id !== 'bootstrap' || delta.operation !== 'UPSERT' || !isValidModuleState(context.moduleId, delta.data) || (latest && delta.version <= latest.version)) throw new Error('Pull exige projeção completa de módulo em ordem de revisão.');
      latest = delta;
    }
    const attachments = await preparePullAttachments(pull.attachments);
    await runTransaction(this.partition, ['snapshots', 'cursors', 'meta', 'outbox', 'attachments'], 'readwrite', (tx, _set, abortWith) => {
      this.assertActive();
      if (!canCommit()) throw new Error('Lease de sincronização encerrado.');
      const pending = tx.objectStore('outbox').count();
      pending.onsuccess = () => {
        if (pending.result > 0) { abortWith(new Error('Pull adiado para preservar operações locais pendentes.')); return; }
        const localRevision = tx.objectStore('meta').get('moduleStateRevision');
        localRevision.onsuccess = () => {
          const serverRevision = tx.objectStore('meta').get('serverModuleRevision');
          serverRevision.onsuccess = () => {
            const commit = () => { try {
              this.assertActive();
              if (!canCommit()) throw new Error('Lease de sincronização encerrado.');
              for (const attachment of attachments) tx.objectStore('attachments').put(attachment);
              if (latest) {
                const previousServer = Number(serverRevision.result?.value ?? 0);
                if (latest.version < previousServer) throw new Error('Projeção remota desatualizada.');
                if (serverRevision.result && latest.version === previousServer) {
                  tx.objectStore('cursors').put({ name: 'pull', value: pull.nextCursor } satisfies StoredCursor);
                  return;
                }
                const nextLocal = Number(localRevision.result?.value ?? 0) + 1;
                if (!Number.isSafeInteger(nextLocal) || nextLocal < 1) throw new Error('Revisão local inválida.');
                const data = structuredClone(latest.data) as Record<string, any>;
                if (context.moduleId === 'escritorio') { data.revision = nextLocal; data.state.localRevision = nextLocal; }
                else data.localRevision = nextLocal;
                // No pending operations remain; all authoritative projections are
                // replaced together so listSnapshots cannot hydrate an older row.
                const snapshots = tx.objectStore('snapshots');
                snapshots.clear();
                snapshots.put({ key: snapshotKey('module-state', 'bootstrap'), aggregateType: 'module-state', aggregateId: 'bootstrap', version: latest.version, data, modifiedAt: latest.modified_at });
                tx.objectStore('meta').put({ name: 'moduleStateRevision', value: nextLocal } satisfies StoredMeta);
                tx.objectStore('meta').put({ name: 'serverModuleRevision', value: latest.version } satisfies StoredMeta);
              }
              tx.objectStore('cursors').put({ name: 'pull', value: pull.nextCursor } satisfies StoredCursor);
            } catch (error) { abortWith(error instanceof Error ? error : new Error('Pull inválido.')); } };
            if (latest) verifyPhotoDependencies(tx, context.moduleId, latest.data, attachments, commit, abortWith);
            else commit();
          };
        };
      };
    });
  }

  async getCursor(context: ModuleExecutionContext): Promise<string | null> {
    assertContext(context, this.partition);
    return runTransaction(this.partition, ['cursors'], 'readonly', (tx, set) => {
      const request = tx.objectStore('cursors').get('pull');
      request.onsuccess = () => set((request.result as StoredCursor | undefined)?.value ?? null);
    });
  }

  async getSchemaVersion(partition: ModuleAccountPartition): Promise<number> {
    if (identityKey(partition) !== identityKey(this.partition)) throw new Error('Partição não corresponde à instância IndexedDB.');
    return runTransaction(this.partition, ['meta'], 'readonly', (tx, set) => {
      const request = tx.objectStore('meta').get('schemaVersion');
      request.onsuccess = () => set(Number((request.result as StoredMeta | undefined)?.value ?? 0));
    });
  }
}


