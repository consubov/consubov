import { moduleSeedSnapshot } from './module-seed';
import type {
  AttachmentRef,
  AtomicCommandEnvelope,
  LocalMutation,
  LocalMutationResult,
  LocalPendingCommand,
  LocalSnapshot,
  ModuleExecutionContext,
  ModuleLocalDataAPI
} from '@consubov/contracts';
import { CapatazStore, getCapatazStore } from '../../apps/fazenda/capataz/src/store/capatazStore';

interface TestDatabase {
  snapshots: Map<string, LocalSnapshot>;
  commands: Map<string, LocalPendingCommand>;
  attachments: Map<string, { ref: AttachmentRef; blob: Blob }>;
}

const databases = new Map<string, TestDatabase>();

export function resetCapatazTestData(): void { databases.clear(); }

export function createCapatazTestRuntime(key: string): { context: ModuleExecutionContext; localData: ModuleLocalDataAPI } {
  const parts = key.split(':');
  const legacyPrefix = parts[0] === 'consubov';
  const [tenantId, userId, farmId] = legacyPrefix ? parts.slice(1, 4) : parts.slice(0, 3);
  const context: ModuleExecutionContext = {
    userId: userId || 'test-user', tenantId: tenantId || 'test-tenant', farmId: farmId || 'test-farm',
    retreatId: null, moduleId: 'capataz', profileId: 'capataz', deviceId: 'device-capataz-test', productId: 'consubov'
  };
  const databaseKey = JSON.stringify([context.productId, context.moduleId, context.userId, context.tenantId, context.farmId, context.retreatId]);
  let database = databases.get(databaseKey);
  if (!database) {
    database = { snapshots: new Map([[JSON.stringify(['module-state', 'bootstrap']), moduleSeedSnapshot('capataz')]]), commands: new Map(), attachments: new Map() };
    databases.set(databaseKey, database);
  }
  const db = database;
  const localData: ModuleLocalDataAPI = {
    async readSnapshot<T>(aggregateType: string, aggregateId: string) {
      return (db.snapshots.get(JSON.stringify([aggregateType, aggregateId])) as LocalSnapshot<T> | undefined) ?? null;
    },
    async listSnapshots<T>(aggregateType?: string) {
      return Array.from(db.snapshots.values()).filter(snapshot => !aggregateType || snapshot.aggregateType === aggregateType) as LocalSnapshot<T>[];
    },
    async commitMutation<T>(mutation: LocalMutation<T>): Promise<LocalMutationResult> {
      const { command, snapshot, attachments } = mutation;
      if (snapshot.aggregateType !== command.aggregate_type || snapshot.aggregateId !== command.aggregate_id) {
        throw new Error('Snapshot and command aggregate do not match.');
      }
      db.snapshots.set(JSON.stringify([snapshot.aggregateType, snapshot.aggregateId]), snapshot);
      db.commands.set(command.command_id, { command: command as AtomicCommandEnvelope, attachmentRefs: command.attachment_refs });
      for (const attachment of attachments) db.attachments.set(attachment.ref.attachment_id, attachment);
      return { commandId: command.command_id, committed: true };
    },
    async readAttachment(attachmentId) { return db.attachments.get(attachmentId) ?? null; },
    async listPendingCommands(limit) { return Array.from(db.commands.values()).slice(0, limit); },
    async getCursor() { return null; },
    async getSchemaVersion() { return 1; }
  };
  return { context, localData };
}

export function createCapatazTestStore(key: string): CapatazStore {
  const { context, localData } = createCapatazTestRuntime(key);
  return new CapatazStore(context, localData);
}

export function getCapatazTestStore(key: string): CapatazStore {
  const { context, localData } = createCapatazTestRuntime(key);
  return getCapatazStore(context, localData);
}
