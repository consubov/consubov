import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { IndexedDbLocalData } from '../src';
import type { LocalMutation, ModuleAccountPartition, ModuleExecutionContext } from '@consubov/contracts';
import { INITIAL_MODULE_STATES } from '../../../api/src/fixtures/initial-module-states';
import { IndexedDbPartitionLeader } from '../../../apps/fazenda/shell/src/sync/IndexedDbPartitionLeader';

const supported = typeof indexedDB !== 'undefined' && typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
const suite = supported ? describe : describe.skip;

suite('IndexedDbLocalData browser persistence', () => {
  let context: ModuleExecutionContext;
  let partition: ModuleAccountPartition;
  let dbName: string;
  let data: IndexedDbLocalData;

  beforeEach(() => {
    const nonce = crypto.randomUUID();
    context = {
      userId: `user-${nonce}`, tenantId: 'tenant-test', farmId: 'farm-test', retreatId: null,
      moduleId: 'capataz', profileId: 'capataz', deviceId: `device-${nonce}`, productId: 'consubov'
    };
    partition = {
      userId: context.userId, tenantId: context.tenantId, farmId: context.farmId, retreatId: null,
      moduleId: context.moduleId, profileId: context.profileId, productId: context.productId
    };
    dbName = `consubov-local-${encodeURIComponent(JSON.stringify([
      partition.productId, partition.moduleId, partition.userId, partition.tenantId, partition.farmId, partition.retreatId
    ]))}`;
    data = new IndexedDbLocalData(partition);
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Test database deletion was blocked.'));
    });
  });

  async function mutation(commandId: string, aggregateId: string, withAttachment = true, baseVersion = 0): Promise<LocalMutation> {
    const bytes = new TextEncoder().encode('local photo bytes');
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const ref = {
      attachment_id: `attachment-${commandId}`, mime_type: blob.type, size_bytes: blob.size,
      hash_sha256: hash, local_blob_ref: `blob:${commandId}`
    };
    return {
      command: {
        command_id: commandId, idempotency_key: `idempotency-${commandId}`, command_type: 'capataz.cocho.registrar_escore',
        aggregate_type: 'cocho', aggregate_id: aggregateId, base_version: baseVersion, user_id: context.userId,
        tenant_id: context.tenantId, product_id: context.productId, fazenda_id: context.farmId,
        retiro_id: context.retreatId, profile_id: context.profileId, device_id: context.deviceId,
        schema_version: 1, payload: { score: 2 }, correlation_id: `correlation-${commandId}`,
        attachment_refs: withAttachment ? [ref] : [], occurred_at_local: new Date().toISOString(),
        status: 'PENDENTE', attempts: 0, last_attempt_at: null, error_message: null
      },
      snapshot: { aggregateType: 'cocho', aggregateId, version: baseVersion + 1, data: { score: 2 }, modifiedAt: new Date().toISOString() },
      attachments: withAttachment ? [{ ref, blob }] : []
    };
  }

  async function storedMutation(commandId: string, aggregateId: string, withAttachment = true) {
    const candidate = await mutation(commandId, aggregateId, withAttachment);
    await data.commitMutation(context, candidate);
    return candidate;
  }

  async function readStored<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  }

  async function writeStored(storeName: string, value: unknown): Promise<void> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  }

  it('migrates legacy snapshot keys without losing persisted state', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('snapshots', { keyPath: 'key' }).put({
          key: 'cocho::legacy', aggregateType: 'cocho', aggregateId: 'legacy',
          version: 3, data: { score: 4 }, modifiedAt: new Date().toISOString()
        });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { request.result.close(); resolve(); };
    });
    expect(await data.readSnapshot(context, 'cocho', 'legacy')).toMatchObject({ version: 3, data: { score: 4 } });
    expect(await data.listSnapshots(context)).toHaveLength(1);
    expect(await data.getSchemaVersion(partition)).toBe(2);
  });

  it('commits snapshot, outbox command, attachment reference and Blob for a fresh instance', async () => {
    const candidate = await storedMutation('command-atomic', 'aggregate-atomic');
    const reopened = new IndexedDbLocalData(partition);
    expect(await reopened.readSnapshot(context, 'cocho', 'aggregate-atomic')).toMatchObject({ version: 1, data: { score: 2 } });
    expect(await reopened.listPendingCommands(context, 10)).toHaveLength(1);
    const storedAttachment = await reopened.readAttachment(context, 'attachment-command-atomic');
    expect(storedAttachment?.ref).toEqual(candidate.attachments[0]!.ref);
    expect(await storedAttachment?.blob.text()).toBe('local photo bytes');
  });

  it('allows sequential pending local versions but rejects a stale base without partial writes', async () => {
    const first = await storedMutation('command-pending-v1', 'aggregate-pending', false);
    const second = await mutation('command-pending-v2', 'aggregate-pending', false, 1);
    await data.commitMutation(context, second);
    expect(await data.readSnapshot(context, 'cocho', 'aggregate-pending')).toMatchObject({ version: 2, data: { score: 2 } });
    expect(await data.listPendingCommands(context, 10)).toHaveLength(2);

    const stale = await mutation('command-pending-stale', 'aggregate-pending', false, 1);
    stale.snapshot.data = { score: 99 };
    await expect(data.commitMutation(context, stale)).rejects.toThrow('Versão local do agregado desatualizada');
    expect(await data.readSnapshot(context, 'cocho', 'aggregate-pending')).toMatchObject({ version: 2, data: { score: 2 } });
    expect((await data.listPendingCommands(context, 10)).map(item => item.command.command_id)).toEqual([
      first.command.command_id, second.command.command_id
    ]);
  });

  it('rejects a duplicate command ID without overwriting an append-only outbox entry', async () => {
    const original = await storedMutation('command-immutable-id', 'aggregate-immutable-id', false);
    const duplicate = await mutation('command-immutable-id', 'aggregate-immutable-id', false, 1);
    duplicate.snapshot.data = { score: 99 };
    await expect(data.commitMutation(context, duplicate)).rejects.toThrow('ID de comando já utilizado');
    expect(await data.readSnapshot(context, 'cocho', 'aggregate-immutable-id')).toMatchObject({ version: 1, data: { score: 2 } });
    expect((await data.listPendingCommands(context, 10)).map(item => [item.command.command_id, item.command.base_version])).toEqual([
      [original.command.command_id, 0]
    ]);
  });

  it('does not allow a previously acknowledged command ID to be reused', async () => {
    const original = await storedMutation('command-acked-id', 'aggregate-acked-id', false);
    await data.applyCommandResponse(context, {
      success: true,
      ack: { command_id: original.command.command_id, status: 'COMMITTED', aggregate_id: original.command.aggregate_id,
        aggregate_version: 1, committed_at: new Date().toISOString(), correlation_id: original.command.correlation_id }
    });
    const reused = await mutation(original.command.command_id, 'aggregate-acked-id', false, 1);
    await expect(data.commitMutation(context, reused)).rejects.toThrow('ID de comando já utilizado');
    expect(await data.listPendingCommands(context, 10)).toHaveLength(0);
    expect(await data.readSnapshot(context, 'cocho', 'aggregate-acked-id')).toMatchObject({ version: 1, data: { score: 2 } });
  });

  it('rejects a snapshot version that does not follow its command base version', async () => {
    const candidate = await mutation('command-version-mismatch', 'aggregate-version-mismatch', false);
    candidate.snapshot.version = 2;
    await expect(data.commitMutation(context, candidate)).rejects.toThrow('próxima versão da base');
    expect(await data.readSnapshot(context, 'cocho', 'aggregate-version-mismatch')).toBeNull();
    expect(await data.listPendingCommands(context, 10)).toHaveLength(0);
  });

  it('removes an ACKed command but retains a conflicted command and its attachment', async () => {
    const acked = await storedMutation('command-acked', 'aggregate-acked');
    const conflicted = await storedMutation('command-conflict', 'aggregate-conflict');
    await data.applyCommandResponse(context, {
      success: true,
      ack: { command_id: 'command-acked', status: 'COMMITTED', aggregate_id: 'aggregate-acked', aggregate_version: 1, committed_at: new Date().toISOString(), correlation_id: 'correlation-command-acked' }
    });
    await data.applyCommandResponse(context, {
      success: false,
      conflict: { error: 'CONFLICT_409', command_id: 'command-conflict', aggregate_id: 'aggregate-conflict', base_version: 0, current_version: 1, conflict_reason: 'Version changed', resolution_strategy: 'MANUAL_RESOLUTION_REQUIRED' }
    });
    expect(await readStored('acks', 'command-acked')).toMatchObject({ commandId: 'command-acked' });
    expect(await readStored('conflicts', 'command-conflict')).toMatchObject({ commandId: 'command-conflict' });
    expect((await data.listPendingCommands(context, 10)).map(item => item.command.command_id)).toEqual(['command-conflict']);
    expect((await data.listSnapshots(context)).map(snapshot => snapshot.aggregateId).sort()).toEqual(['aggregate-acked', 'aggregate-conflict']);
    expect(await data.listSnapshots(context, 'cocho')).toHaveLength(2);
    expect(await data.readAttachment(context, acked.attachments[0]!.ref.attachment_id)).not.toBeNull();
    expect(await data.readAttachment(context, conflicted.attachments[0]!.ref.attachment_id)).not.toBeNull();
  });

  it('rejects corrupted persisted attachment bytes on read', async () => {
    const candidate = await storedMutation('command-corrupt-attachment', 'aggregate-corrupt');
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('attachments', 'readwrite');
        const original = candidate.attachments[0]!;
        tx.objectStore('attachments').put({ attachmentId: original.ref.attachment_id, ref: original.ref, bytes: new Uint8Array(original.ref.size_bytes).buffer });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    });
    await expect(data.readAttachment(context, 'attachment-command-corrupt-attachment')).rejects.toThrow('Integridade SHA-256');
    expect(await data.listPendingCommands(context, 10)).toHaveLength(1);
  });

  it('rejects mismatched command attachment metadata without partial writes', async () => {
    const candidate = await mutation('command-ref-mismatch', 'aggregate-ref-mismatch');
    candidate.command.attachment_refs = candidate.command.attachment_refs.map(ref => ({ ...ref, hash_sha256: 'f'.repeat(64) }));
    await expect(data.commitMutation(context, candidate)).rejects.toThrow('Metadados do anexo');
    expect(await data.readSnapshot(context, 'cocho', 'aggregate-ref-mismatch')).toBeNull();
    expect(await data.listPendingCommands(context, 10)).toHaveLength(0);
  });

  it('rejects another profile command before changing the local partition', async () => {
    const candidate = await mutation('command-wrong-profile', 'aggregate-forbidden', false);
    candidate.command.command_type = 'fabrica.formulas.salvar';
    await expect(data.commitMutation(context, candidate)).rejects.toThrow('Comando não autorizado');
    expect(await data.readSnapshot(context, 'cocho', 'aggregate-forbidden')).toBeNull();
    expect(await data.listPendingCommands(context, 10)).toHaveLength(0);
  });

  it('does not enumerate snapshots through a mismatched module context', async () => {
    await storedMutation('command-context', 'aggregate-context', false);
    await expect(data.listSnapshots({ ...context, userId: 'other-user' })).rejects.toThrow('Contexto não autorizado');
  });

  it('keeps aggregate type and id pairs distinct when either contains the old delimiter', async () => {
    const left = await mutation('command-collision-left', 'z', false);
    left.command.aggregate_type = 'x::y';
    left.snapshot.aggregateType = 'x::y';
    await data.commitMutation(context, left);

    const right = await mutation('command-collision-right', 'y::z', false);
    right.command.aggregate_type = 'x';
    right.snapshot.aggregateType = 'x';
    await data.commitMutation(context, right);

    expect(await data.readSnapshot(context, 'x::y', 'z')).toMatchObject({ data: { score: 2 } });
    expect(await data.readSnapshot(context, 'x', 'y::z')).toMatchObject({ data: { score: 2 } });
  });

  it('commits pull deltas and the opaque cursor together', async () => {
    await data.commitPull(context, {
      nextCursor: 'cursor-opaque-2',
      deltas: [{ delta_id: 'delta-pull-2', aggregate_type: 'module-state', aggregate_id: 'bootstrap', version: 2, operation: 'UPSERT', data: structuredClone(INITIAL_MODULE_STATES.capataz!), modified_at: new Date().toISOString() }]
    });
    expect(await data.getCursor(context)).toBe('cursor-opaque-2');
    expect(await data.readSnapshot(context, 'module-state', 'bootstrap')).toMatchObject({ version: 2, data: { localRevision: 1 } });
  });

  it('rejects foreign, wrong-version and wrong-correlation ACKs without removing durable work', async () => {
    const candidate = await storedMutation('strict-ack', 'strict-aggregate');
    const ack = { command_id: candidate.command.command_id, status: 'COMMITTED' as const, aggregate_id: candidate.command.aggregate_id, aggregate_version: 1, committed_at: new Date().toISOString(), correlation_id: candidate.command.correlation_id };
    for (const change of [{ command_id: 'unknown-command' }, { aggregate_id: 'other-aggregate' }, { aggregate_version: 2 }, { correlation_id: 'foreign-correlation' }]) {
      await expect(data.applyCommandResponse(context, { success: true, ack: { ...ack, ...change } })).rejects.toBeDefined();
      expect(await data.listPendingCommands(context, 10)).toHaveLength(1);
    }
    await data.applyCommandResponse(context, { success: true, ack });
    await data.applyCommandResponse(context, { success: true, ack });
    expect(await data.listPendingCommands(context, 10)).toHaveLength(0);
    expect(await data.readAttachment(context, candidate.attachments[0]!.ref.attachment_id)).not.toBeNull();
  });

  it('defers full projections over pending local commands without advancing cursor', async () => {
    await storedMutation('pending-pull', 'optimistic-aggregate', false);
    await expect(data.commitPull(context, { nextCursor: 'must-not-advance', deltas: [{ delta_id: 'pending-delta', aggregate_type: 'module-state', aggregate_id: 'bootstrap', operation: 'UPSERT', version: 99, data: structuredClone(INITIAL_MODULE_STATES.capataz!), modified_at: new Date().toISOString() }] })).rejects.toThrow('Pull adiado');
    expect(await data.getCursor(context)).toBeNull();
    expect(await data.readSnapshot(context, 'cocho', 'optimistic-aggregate')).toMatchObject({ data: { score: 2 } });
  });

  it('rejects unsafe entity deltas without changing the durable cursor', async () => {
    await expect(data.commitPull(context, { nextCursor: 'unsafe', deltas: [{ delta_id: 'entity', aggregate_type: 'cocho', aggregate_id: 'entity', operation: 'UPSERT', version: 1, data: { score: 4 }, modified_at: new Date().toISOString() }] })).rejects.toThrow('projeção completa');
    expect(await data.getCursor(context)).toBeNull();
  });

  it('commits downloaded photos with full projection and cursor, and rejects incomplete photo pulls', async () => {
    const photo = (await mutation('download-photo', 'photo', true)).attachments[0]!;
    const state = structuredClone(INITIAL_MODULE_STATES.capataz!);
    state.fotos = { [photo.ref.attachment_id]: { attachment_id: photo.ref.attachment_id, mimeType: photo.ref.mime_type, compressedSizeBytes: photo.ref.size_bytes } };
    const pull = { nextCursor: 'with-photo', deltas: [{ delta_id: 'photo-delta', aggregate_type: 'module-state', aggregate_id: 'bootstrap', operation: 'UPSERT' as const, version: 5, data: state, modified_at: new Date().toISOString() }] };
    await expect(data.commitPull(context, pull)).rejects.toThrow('foto ausente');
    expect(await data.getCursor(context)).toBeNull();
    await data.commitPull(context, { ...pull, attachments: [photo] });
    expect(await data.getCursor(context)).toBe('with-photo');
    expect(await data.readAttachment(context, photo.ref.attachment_id)).not.toBeNull();
    expect(await data.readSnapshot(context, 'module-state', 'bootstrap')).toMatchObject({ version: 5, data: { localRevision: 1 } });
  });

  it('rolls back photo, projection and cursor together on quota failure', async () => {
    const photo = (await mutation('quota-photo', 'photo', true)).attachments[0]!;
    const state = structuredClone(INITIAL_MODULE_STATES.capataz!);
    state.fotos = { [photo.ref.attachment_id]: { attachment_id: photo.ref.attachment_id, mimeType: photo.ref.mime_type, compressedSizeBytes: photo.ref.size_bytes } };
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value: unknown, key?: IDBValidKey) {
      if (this.name === 'cursors') throw new DOMException('Pull quota exhausted', 'QuotaExceededError');
      return originalPut.call(this, value, key);
    };
    try {
      await expect(data.commitPull(context, { nextCursor: 'never', attachments: [photo], deltas: [{ delta_id: 'photo-quota', aggregate_type: 'module-state', aggregate_id: 'bootstrap', operation: 'UPSERT', version: 1, data: state, modified_at: new Date().toISOString() }] })).rejects.toThrow('Pull quota exhausted');
    } finally { IDBObjectStore.prototype.put = originalPut; }
    expect(await data.getCursor(context)).toBeNull();
    expect(await data.readSnapshot(context, 'module-state', 'bootstrap')).toBeNull();
    expect(await data.readAttachment(context, photo.ref.attachment_id)).toBeNull();
  });

  it('seeds a new device with current server revision and verified photos atomically', async () => {
    const photo = (await mutation('bootstrap-photo', 'photo', true)).attachments[0]!;
    const state = structuredClone(INITIAL_MODULE_STATES.capataz!);
    state.localRevision = 8;
    state.fotos = { [photo.ref.attachment_id]: { attachment_id: photo.ref.attachment_id, mimeType: photo.ref.mime_type, compressedSizeBytes: photo.ref.size_bytes } };
    const snapshot = { aggregateType: 'module-state', aggregateId: 'bootstrap', version: 8, data: state, modifiedAt: new Date().toISOString() };
    await expect(data.provisionInitialSnapshot(context, snapshot)).rejects.toThrow('foto ausente');
    await data.provisionInitialSnapshot(context, snapshot, [photo]);
    expect(await readStored('meta', 'moduleStateRevision')).toMatchObject({ value: 8 });
    expect(await readStored('meta', 'serverModuleRevision')).toMatchObject({ value: 8 });
    expect(await data.readAttachment(context, photo.ref.attachment_id)).not.toBeNull();
  });

  it('uses one durable lease per partition and fences an expired leader', async () => {
    let now = 1000;
    const first = new IndexedDbPartitionLeader(3000, () => now);
    const second = new IndexedDbPartitionLeader(3000, () => now);
    const signal = new AbortController().signal;
    const key = `test-lease-${crypto.randomUUID()}`;
    await first.run(key, signal, async check => {
      expect(await second.run(key, signal, async () => { throw new Error('Second leader must not enter'); })).toBe(false);
      now += 3001;
      expect(await second.run(key, signal, async verify => { await verify(); })).toBe(true);
      await expect(check()).rejects.toThrow('lease lost');
    });
    expect(await second.run(key, signal, async verify => { await verify(); })).toBe(true);
  });

  it('preserves CAS and optimistic work when a full pull races a module write', async () => {
    const state = structuredClone(INITIAL_MODULE_STATES.capataz!);
    await data.provisionInitialSnapshot(context, { aggregateType: 'module-state', aggregateId: 'bootstrap', version: 0, data: state, modifiedAt: new Date().toISOString() });
    const candidate = await mutation('race-local', 'race', false);
    candidate.expectedModuleRevision = 0;
    candidate.snapshot.data = { ...state, localRevision: 1 };
    const results = await Promise.allSettled([
      data.commitMutation(context, candidate),
      data.commitPull(context, { nextCursor: 'race-pull', deltas: [{ delta_id: 'race-delta', aggregate_type: 'module-state', aggregate_id: 'bootstrap', version: 1, operation: 'UPSERT', data: state, modified_at: new Date().toISOString() }] })
    ]);
    if (results[0]!.status === 'fulfilled') {
      expect(results[1]!.status).toBe('rejected');
      expect(await data.listPendingCommands(context, 10)).toHaveLength(1);
      expect(await data.getCursor(context)).toBeNull();
      expect(await data.readSnapshot(context, 'cocho', 'race')).toMatchObject({ data: { localRevision: 1 } });
    } else {
      expect(results[1]!.status).toBe('fulfilled');
      expect(await data.listPendingCommands(context, 10)).toHaveLength(0);
      expect(await data.getCursor(context)).toBe('race-pull');
    }
  });

  it('does not invalidate module CAS for an unchanged server projection', async () => {
    const state = structuredClone(INITIAL_MODULE_STATES.capataz!);
    await data.provisionInitialSnapshot(context, { aggregateType: 'module-state', aggregateId: 'bootstrap', version: 3, data: { ...state, localRevision: 7 }, modifiedAt: new Date().toISOString() });
    await data.commitPull(context, { nextCursor: 'same-revision-cursor', deltas: [{ delta_id: 'same-state', aggregate_type: 'module-state', aggregate_id: 'bootstrap', version: 3, operation: 'UPSERT', data: state, modified_at: new Date().toISOString() }] });
    expect(await readStored('meta', 'moduleStateRevision')).toMatchObject({ value: 7 });
    expect(await data.getCursor(context)).toBe('same-revision-cursor');
  });

  it('rechecks the trusted lease guard after IndexedDB waits before ACK deletion or pull replacement', async () => {
    const candidate = await storedMutation('fence-ack', 'fence', false);
    let checks = 0;
    const ack = { command_id: candidate.command.command_id, status: 'COMMITTED' as const, aggregate_id: candidate.command.aggregate_id, aggregate_version: 1, committed_at: new Date().toISOString(), correlation_id: candidate.command.correlation_id };
    await expect(data.applyCommandResponse(context, { success: true, ack }, () => ++checks === 1)).rejects.toThrow('Lease');
    expect(await data.listPendingCommands(context, 10)).toHaveLength(1);
    await data.applyCommandResponse(context, { success: true, ack });
    checks = 0;
    await expect(data.commitPull(context, { nextCursor: 'lost-lease', deltas: [{ delta_id: 'fence-pull', aggregate_type: 'module-state', aggregate_id: 'bootstrap', version: 1, operation: 'UPSERT', data: structuredClone(INITIAL_MODULE_STATES.capataz!), modified_at: new Date().toISOString() }] }, () => ++checks === 1)).rejects.toThrow('Lease');
    expect(await data.getCursor(context)).toBeNull();
    expect(await data.readSnapshot(context, 'cocho', 'fence')).not.toBeNull();
  });

  it('reads only sanitized durable issues joined to pending commands without mutating commands or photos', async () => {
    const candidate = await storedMutation('issue-conflict', 'issue-aggregate');
    await data.applyCommandResponse(context, { success: false, conflict: { error: 'CONFLICT_409', command_id: candidate.command.command_id, aggregate_id: candidate.command.aggregate_id, base_version: 0, current_version: 2, conflict_reason: 'never-expose-server-message', resolution_strategy: 'MANUAL_RESOLUTION_REQUIRED', details: { secret: 'never-expose-details' } } });
    const issues = await new IndexedDbLocalData(partition).listOperationIssues(context);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ commandId: 'issue-conflict', commandType: candidate.command.command_type, aggregateType: 'cocho', aggregateId: 'issue-aggregate', kind: 'conflict', baseVersion: 0, currentVersion: 2, occurredAt: candidate.command.occurred_at_local });
    expect(JSON.stringify(issues).includes('never-expose')).toBe(false);
    expect(Object.keys(issues[0]!).sort()).toEqual(['aggregateId', 'aggregateType', 'baseVersion', 'commandId', 'commandType', 'currentVersion', 'kind', 'occurredAt', 'recordedAt']);
    expect((await data.listPendingCommands(context, 10))[0]!.command).toEqual(candidate.command);
    expect(await data.readAttachment(context, candidate.attachments[0]!.ref.attachment_id)).not.toBeNull();
  });

  it('reads validation and security issues without exposing security reason or raw response objects', async () => {
    const validation = await storedMutation('issue-validation', 'validation-aggregate', false);
    const security = await storedMutation('issue-security', 'security-aggregate', false);
    await data.applyCommandResponse(context, { success: false, validation: { error: 'UNPROCESSABLE_ENTITY_422', command_id: validation.command.command_id, violations: [{ field: 'payload.escore', code: 'INVALID_SCORE', message: 'Revise o escore informado.' }] } });
    await data.applyCommandResponse(context, { success: false, security: { error: 'FORBIDDEN_403', command_id: security.command.command_id, reason: 'never-expose-security-reason', required_capability: 'never-expose-capability' } });
    const issues = await data.listOperationIssues(context);
    expect(issues).toHaveLength(2);
    expect(issues.find(issue => issue.kind === 'validation')).toMatchObject({ violations: [{ field: 'payload.escore', code: 'INVALID_SCORE', message: 'Revise o escore informado.' }] });
    expect(issues.find(issue => issue.kind === 'security')).toMatchObject({ commandId: security.command.command_id, baseVersion: 0 });
    expect(JSON.stringify(issues).includes('never-expose')).toBe(false);
    expect(await data.listPendingCommands(context, 10)).toHaveLength(2);
  });

  it('does not read another account partition or command scope and rejects invalid issue rows without partial results', async () => {
    const candidate = await storedMutation('issue-isolation', 'isolation-aggregate', false);
    await data.applyCommandResponse(context, { success: false, validation: { error: 'UNPROCESSABLE_ENTITY_422', command_id: candidate.command.command_id, violations: [] } });
    await expect(data.listOperationIssues({ ...context, userId: 'other-account' })).rejects.toThrow('Contexto não autorizado');
    const otherContext = { ...context, userId: `other-${crypto.randomUUID()}` };
    const other = new IndexedDbLocalData(otherContext);
    try { expect(await other.listOperationIssues(otherContext)).toHaveLength(0); }
    finally {
      const otherName = `consubov-local-${encodeURIComponent(JSON.stringify([otherContext.productId, otherContext.moduleId, otherContext.userId, otherContext.tenantId, otherContext.farmId, otherContext.retreatId]))}`;
      await new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase(otherName); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
    }
    await writeStored('outbox', { commandId: candidate.command.command_id, command: { ...candidate.command, tenant_id: 'another-tenant' }, attachmentRefs: [] });
    await expect(data.listOperationIssues(context)).rejects.toThrow('problema de operação inválido');
    await writeStored('outbox', { commandId: candidate.command.command_id, command: candidate.command, attachmentRefs: [] });
    await writeStored('conflicts', { commandId: candidate.command.command_id, recordedAt: new Date().toISOString(), response: { success: false, validation: { error: 'UNPROCESSABLE_ENTITY_422', command_id: 'foreign-command', violations: [] } } });
    await expect(data.listOperationIssues(context)).rejects.toThrow('problema de operação inválido');
    await writeStored('conflicts', { commandId: candidate.command.command_id, recordedAt: new Date().toISOString(), response: { success: false, validation: { error: 'UNPROCESSABLE_ENTITY_422', command_id: candidate.command.command_id, violations: [], 'never-expose-malformed-metadata': 'never-expose-token' } } });
    let failureMessage = '';
    try { await data.listOperationIssues(context); } catch (error) { failureMessage = (error as Error).message; }
    expect(failureMessage).toBe('Registro de problema de operação inválido para este contexto.');
    expect(await data.listPendingCommands(context, 10)).toHaveLength(1);
  });

  it('bounds issue reads with cursors, omits resolved rows and validates limits before reading', async () => {
    for (const id of ['issue-a', 'issue-b', 'issue-c']) {
      const candidate = await storedMutation(id, id, false);
      await data.applyCommandResponse(context, { success: false, validation: { error: 'UNPROCESSABLE_ENTITY_422', command_id: candidate.command.command_id, violations: [] } });
    }
    const originalGetAll = IDBObjectStore.prototype.getAll;
    const originalGet = IDBObjectStore.prototype.get;
    let pendingReads = 0;
    IDBObjectStore.prototype.getAll = function(...args: Parameters<IDBObjectStore['getAll']>) {
      if (this.name === 'conflicts' || this.name === 'outbox') throw new Error('Issue reads must use bounded cursors');
      return originalGetAll.apply(this, args);
    };
    IDBObjectStore.prototype.get = function(key: IDBValidKey | IDBKeyRange) { if (this.name === 'outbox') pendingReads++; return originalGet.call(this, key); };
    try {
      expect(await data.listOperationIssues(context, 1)).toHaveLength(1);
      expect(pendingReads).toBe(1);
      for (const limit of [0, -1, 501, 1.5]) await expect(data.listOperationIssues(context, limit)).rejects.toThrow('Limite');
    } finally { IDBObjectStore.prototype.getAll = originalGetAll; IDBObjectStore.prototype.get = originalGet; }
    await writeStored('conflicts', { commandId: 'resolved-unknown', recordedAt: new Date().toISOString(), response: { success: false, validation: { error: 'UNPROCESSABLE_ENTITY_422', command_id: 'resolved-unknown', violations: [] } } });
    expect(await data.listOperationIssues(context)).toHaveLength(3);
  });

  it('does not commit after context ends while attachment validation is pending', async () => {
    let active = true;
    const guarded = new IndexedDbLocalData(partition, () => active);
    const candidate = await mutation('command-ended-context', 'aggregate-ended');
    const pendingCommit = guarded.commitMutation(context, candidate);
    active = false;
    await expect(pendingCommit).rejects.toThrow('Contexto local encerrado');
    expect(await data.readSnapshot(context, 'cocho', 'aggregate-ended')).toBeNull();
    expect(await data.listPendingCommands(context, 10)).toHaveLength(0);
  });

  it('rejects quota failure and rolls back requests queued before it', async () => {
    await storedMutation('command-before-quota', 'aggregate-quota', false);
    const originalAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function(value: unknown, key?: IDBValidKey) {
      if (this.name === 'outbox') throw new DOMException('Test quota exhausted', 'QuotaExceededError');
      return originalAdd.call(this, value, key);
    };
    try {
      const candidate = await mutation('command-quota-failed', 'aggregate-quota', false, 1);
      candidate.snapshot.data = { score: 99 };
      await expect(data.commitMutation(context, candidate)).rejects.toThrow('Test quota exhausted');
    } finally {
      IDBObjectStore.prototype.add = originalAdd;
    }
    expect(await data.readSnapshot(context, 'cocho', 'aggregate-quota')).toMatchObject({ data: { score: 2 } });
    expect((await data.listPendingCommands(context, 10)).map(item => item.command.command_id)).toEqual(['command-before-quota']);
  });

  it('rejects an aborted real readwrite transaction without partial snapshot or outbox writes', async () => {
    const baseline = await storedMutation('command-baseline', 'aggregate-failure', false);
    const prototype = IDBObjectStore.prototype;
    const originalAdd = prototype.add;
    let injected = false;
    prototype.add = function(value: unknown, key?: IDBValidKey) {
      const request = originalAdd.call(this, value, key);
      if (!injected && this.name === 'outbox') {
        injected = true;
        this.transaction.abort();
      }
      return request;
    };
    try {
      await expect(data.commitMutation(context, await mutation('command-aborted', 'aggregate-failure', false, 1))).rejects.toBeDefined();
    } finally {
      prototype.add = originalAdd;
    }
    expect(injected).toBe(true);
    expect(await data.readSnapshot(context, 'cocho', 'aggregate-failure')).toMatchObject({ data: { score: 2 } });
    expect((await data.listPendingCommands(context, 10)).map(item => item.command.command_id)).toEqual([baseline.command.command_id]);
  });
});
