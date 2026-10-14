import type { IndexedDbLocalDatabase, LocalOwner } from "../adapters/IndexedDbLocalDatabase";
import type { IndexedDbAtomicCommandQueue } from "../adapters/IndexedDbAtomicCommandQueue";
import { makePendingCommand, type LocalCommand } from "../offline/commandPolicy";
import { LEGACY_OFFLINE_DATABASES, LEGACY_LOCAL_STORAGE_KEYS } from "../../lib/legacyOfflineInventory";

export type MigrationUnitStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";

export interface MigrationCheckpoint {
  unitId: string;
  databaseName: string;
  storeName: string;
  targetCategory: "command_queue" | "local_database";
  status: MigrationUnitStatus;
  recordsTotal: number;
  recordsMigrated: number;
  lastMigratedKey?: IDBValidKey;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface MigrationState {
  version: 1;
  tenantId: string;
  userId: string;
  deviceId: string;
  overallStatus: "idle" | "running" | "completed" | "partial_error";
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  checkpoints: Record<string, MigrationCheckpoint>;
  stats: {
    totalDatabasesFound: number;
    totalStoresFound: number;
    commandsEnqueued: number;
    kvRecordsMigrated: number;
    blobsPreserved: number;
    failures: number;
  };
}

export interface MigrationContext {
  tenantId: string;
  userId: string;
  deviceId: string;
  dryRun?: boolean;
}

export interface MigrationOptions {
  batchSize?: number;
  dryRun?: boolean;
  onProgress?: (progress: MigrationProgressEvent) => void;
}

export interface MigrationProgressEvent {
  unitId: string;
  databaseName: string;
  storeName: string;
  recordsMigrated: number;
  recordsTotal: number;
  percent: number;
}

export interface MigrationSummary {
  success: boolean;
  tenantId: string;
  userId: string;
  startedAt: string;
  completedAt: string;
  totalDatabasesInspected: number;
  totalStoresMigrated: number;
  commandsEnqueued: number;
  kvRecordsMigrated: number;
  blobsPreserved: number;
  errors: Array<{ unitId: string; message: string }>;
}

const MIGRATION_STATE_KEY = "__migration_state__";
const DEFAULT_BATCH_SIZE = 50;

function deepCloneBinary<T>(val: T): T {
  if (val === null || typeof val !== "object") return val;
  if (typeof Blob !== "undefined" && val instanceof Blob) {
    return val.slice(0, val.size, val.type) as unknown as T;
  }
  if (typeof ArrayBuffer !== "undefined" && val instanceof ArrayBuffer) {
    return val.slice(0) as unknown as T;
  }
  if (ArrayBuffer.isView(val)) {
    const view = val as ArrayBufferView;
    const copy = new Uint8Array(view.byteLength);
    copy.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
    return copy.buffer as unknown as T;
  }
  if (Array.isArray(val)) {
    return val.map((item) => deepCloneBinary(item)) as unknown as T;
  }
  const copy: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val)) {
    copy[k] = deepCloneBinary(v);
  }
  return copy as T;
}

function countBlobsAndBuffers(obj: unknown): number {
  if (!obj || typeof obj !== "object") return 0;
  let count = 0;
  if (typeof Blob !== "undefined" && obj instanceof Blob) count++;
  if (typeof ArrayBuffer !== "undefined" && obj instanceof ArrayBuffer) count++;
  if (ArrayBuffer.isView(obj)) count++;
  if (Array.isArray(obj)) {
    for (const item of obj) count += countBlobsAndBuffers(item);
  } else {
    for (const v of Object.values(obj)) {
      count += countBlobsAndBuffers(v);
    }
  }
  return count;
}

export class LegacyMigrationEngine {
  private readonly owner: LocalOwner;
  private readonly factory: IDBFactory | undefined;
  private readonly storage: Pick<Storage, "getItem"> | undefined;

  constructor(
    private readonly context: MigrationContext,
    private readonly localDb: IndexedDbLocalDatabase,
    private readonly commandQueue: IndexedDbAtomicCommandQueue,
    factory?: IDBFactory,
    storage?: Pick<Storage, "getItem">,
  ) {
    if (!context.tenantId?.trim() || !context.userId?.trim() || !context.deviceId?.trim()) {
      throw new TypeError("MigrationContext requires normalized tenantId, userId and deviceId");
    }
    this.owner = { tenantId: context.tenantId.trim(), userId: context.userId.trim() };
    this.factory = factory ?? (typeof indexedDB !== "undefined" ? indexedDB : undefined);
    this.storage = storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
  }

  async getStatus(): Promise<MigrationState | null> {
    const state = await this.localDb.get<MigrationState>(MIGRATION_STATE_KEY);
    return state ?? null;
  }

  async dryRunAudit(): Promise<MigrationSummary> {
    return this.runMigration({ dryRun: true });
  }

  async runMigration(options?: MigrationOptions): Promise<MigrationSummary> {
    const startedAt = new Date().toISOString();
    const dryRun = options?.dryRun ?? this.context.dryRun ?? false;
    const batchSize = Math.max(1, options?.batchSize ?? DEFAULT_BATCH_SIZE);

    let state = await this.getStatus();
    if (!state) {
      state = {
        version: 1,
        tenantId: this.owner.tenantId,
        userId: this.owner.userId,
        deviceId: this.context.deviceId,
        overallStatus: "running",
        startedAt,
        updatedAt: startedAt,
        checkpoints: {},
        stats: {
          totalDatabasesFound: 0,
          totalStoresFound: 0,
          commandsEnqueued: 0,
          kvRecordsMigrated: 0,
          blobsPreserved: 0,
          failures: 0,
        },
      };
    } else {
      state.overallStatus = "running";
      state.updatedAt = startedAt;
    }

    const errors: Array<{ unitId: string; message: string }> = [];

    // 1. Inspect existing legacy databases without creating any new ones
    const availableDbs = await this.listExistingDatabases();
    state.stats.totalDatabasesFound = availableDbs.length;

    // 2. Process databases
    for (const expectedDb of LEGACY_OFFLINE_DATABASES) {
      if (!availableDbs.includes(expectedDb.name)) {
        continue;
      }

      for (const storeName of expectedDb.stores) {
        const unitId = `${expectedDb.name}:${storeName}`;
        let checkpoint = state.checkpoints[unitId];

        if (checkpoint && checkpoint.status === "completed") {
          continue;
        }

        if (!checkpoint) {
          checkpoint = {
            unitId,
            databaseName: expectedDb.name,
            storeName,
            targetCategory: this.inferTargetCategory(expectedDb.name, storeName),
            status: "pending",
            recordsTotal: 0,
            recordsMigrated: 0,
            startedAt: new Date().toISOString(),
          };
          state.checkpoints[unitId] = checkpoint;
        }

        checkpoint.status = "in_progress";
        if (!dryRun) {
          await this.saveState(state);
        }

        try {
          await this.migrateStore(expectedDb.name, storeName, checkpoint, state, batchSize, dryRun, options?.onProgress);
          checkpoint.status = "completed";
          checkpoint.completedAt = new Date().toISOString();
          state.stats.totalStoresFound++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          checkpoint.status = "failed";
          checkpoint.error = msg;
          state.stats.failures++;
          errors.push({ unitId, message: msg });
        }

        if (!dryRun) {
          await this.saveState(state);
        }
      }
    }

    // 3. Process LocalStorage keys
    for (const key of LEGACY_LOCAL_STORAGE_KEYS) {
      const unitId = `localStorage:${key}`;
      let checkpoint = state.checkpoints[unitId];

      if (checkpoint && checkpoint.status === "completed") {
        continue;
      }

      if (!checkpoint) {
        checkpoint = {
          unitId,
          databaseName: "localStorage",
          storeName: key,
          targetCategory: "local_database",
          status: "pending",
          recordsTotal: 1,
          recordsMigrated: 0,
          startedAt: new Date().toISOString(),
        };
        state.checkpoints[unitId] = checkpoint;
      }

      try {
        const value = this.storage?.getItem(key);
        if (value != null) {
          if (!dryRun) {
            let targetKey: string;
            if (key === "pending_backup") targetKey = "backup:pending_backup";
            else if (key === "pending_backup_at") targetKey = "backup:pending_backup_at";
            else if (key === "ma-offline-mode") targetKey = "mais_arrobas:offline_state";
            else targetKey = `legacy:ls:${key}`;

            await this.localDb.set(targetKey, value);
            state.stats.kvRecordsMigrated++;
          }
          checkpoint.recordsMigrated = 1;
        }
        checkpoint.status = "completed";
        checkpoint.completedAt = new Date().toISOString();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        checkpoint.status = "failed";
        checkpoint.error = msg;
        state.stats.failures++;
        errors.push({ unitId, message: msg });
      }

      if (!dryRun) {
        await this.saveState(state);
      }
    }

    const completedAt = new Date().toISOString();
    state.overallStatus = errors.length > 0 ? "partial_error" : "completed";
    state.completedAt = completedAt;
    state.updatedAt = completedAt;

    if (!dryRun) {
      await this.saveState(state);
    }

    return {
      success: errors.length === 0,
      tenantId: this.owner.tenantId,
      userId: this.owner.userId,
      startedAt,
      completedAt,
      totalDatabasesInspected: state.stats.totalDatabasesFound,
      totalStoresMigrated: state.stats.totalStoresFound,
      commandsEnqueued: state.stats.commandsEnqueued,
      kvRecordsMigrated: state.stats.kvRecordsMigrated,
      blobsPreserved: state.stats.blobsPreserved,
      errors,
    };
  }

  private async saveState(state: MigrationState): Promise<void> {
    await this.localDb.set(MIGRATION_STATE_KEY, state);
  }

  private inferTargetCategory(dbName: string, storeName: string): "command_queue" | "local_database" {
    if (dbName === "consubov-capataz") {
      if (storeName === "syncQueue" || storeName === "lancamentos" || storeName === "observacoesOffline" || storeName === "pesagensPendentes") {
        return "command_queue";
      }
      return "local_database";
    }
    if (dbName === "consubov-consultor-offline") {
      if (storeName === "foto_queue" || storeName === "text_mutations") return "command_queue";
      return "local_database";
    }
    if (dbName === "mais-arrobas-sync") {
      if (storeName === "queue") return "command_queue";
      return "local_database";
    }
    if (dbName === "consubov-fotos-salga") {
      if (storeName === "fotos") return "command_queue";
      return "local_database";
    }
    return "local_database";
  }

  private async listExistingDatabases(): Promise<string[]> {
    if (!this.factory) return [];
    const legacyNames = new Set<string>(LEGACY_OFFLINE_DATABASES.map((d) => d.name));
    if (typeof this.factory.databases === "function") {
      try {
        const dbs = await this.factory.databases();
        return dbs
          .map((d) => d.name)
          .filter((n): n is string => typeof n === "string" && legacyNames.has(n));
      } catch {
        return [];
      }
    }
    // If databases() is not supported, probe safely without onupgradeneeded mutation
    const found: string[] = [];
    for (const expected of LEGACY_OFFLINE_DATABASES) {
      const exists = await new Promise<boolean>((resolve) => {
        let req: IDBOpenDBRequest;
        try {
          req = this.factory!.open(expected.name);
        } catch {
          resolve(false);
          return;
        }
        let aborted = false;
        req.onupgradeneeded = () => {
          aborted = true;
          req.transaction?.abort();
          resolve(false);
        };
        req.onsuccess = () => {
          if (!aborted) {
            req.result.close();
            resolve(true);
          }
        };
        req.onerror = () => resolve(false);
        req.onblocked = () => resolve(false);
      });
      if (exists) found.push(expected.name);
    }
    return found;
  }

  private async openLegacyReadonly(dbName: string): Promise<IDBDatabase | null> {
    if (!this.factory) return null;
    return new Promise<IDBDatabase | null>((resolve, reject) => {
      let req: IDBOpenDBRequest;
      try {
        req = this.factory!.open(dbName);
      } catch (err) {
        reject(err);
        return;
      }
      let created = false;
      req.onupgradeneeded = () => {
        created = true;
        req.transaction?.abort();
      };
      req.onsuccess = () => {
        if (created) {
          req.result.close();
          resolve(null);
        } else {
          resolve(req.result);
        }
      };
      req.onerror = () => {
        if (created) resolve(null);
        else reject(req.error ?? new Error("Failed to open legacy database"));
      };
      req.onblocked = () => reject(new Error(`Opening legacy database ${dbName} blocked`));
    });
  }

  private async migrateStore(
    dbName: string,
    storeName: string,
    checkpoint: MigrationCheckpoint,
    state: MigrationState,
    batchSize: number,
    dryRun: boolean,
    onProgress?: (progress: MigrationProgressEvent) => void,
  ): Promise<void> {
    const db = await this.openLegacyReadonly(dbName);
    if (!db) return;

    try {
      if (!db.objectStoreNames.contains(storeName)) {
        return;
      }

      // Count total records in store
      const count = await new Promise<number>((res, rej) => {
        try {
          const tx = db.transaction(storeName, "readonly");
          const req = tx.objectStore(storeName).count();
          req.onsuccess = () => res(req.result);
          req.onerror = () => rej(req.error);
        } catch (e) {
          rej(e);
        }
      });
      checkpoint.recordsTotal = count;

      if (count === 0) {
        return;
      }

      // Read records in batches using cursor
      let hasMore = true;
      while (hasMore) {
        const batch = await this.readBatch(db, storeName, checkpoint.lastMigratedKey, batchSize);
        if (batch.length === 0) {
          break;
        }

        for (const entry of batch) {
          const { key, value } = entry;
          await this.processItem(dbName, storeName, key, value, state, dryRun);
          checkpoint.recordsMigrated++;
          checkpoint.lastMigratedKey = key;
        }

        if (onProgress) {
          onProgress({
            unitId: checkpoint.unitId,
            databaseName: dbName,
            storeName,
            recordsMigrated: checkpoint.recordsMigrated,
            recordsTotal: count,
            percent: Math.min(100, Math.round((checkpoint.recordsMigrated / count) * 100)),
          });
        }

        if (!dryRun) {
          await this.saveState(state);
        }

        if (batch.length < batchSize) {
          hasMore = false;
        }
      }
    } finally {
      db.close();
    }
  }

  private async readBatch(
    db: IDBDatabase,
    storeName: string,
    lastKey: IDBValidKey | undefined,
    batchSize: number,
  ): Promise<Array<{ key: IDBValidKey; value: unknown }>> {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const range = lastKey !== undefined ? IDBKeyRange.lowerBound(lastKey, true) : undefined;
        const req = store.openCursor(range);
        const results: Array<{ key: IDBValidKey; value: unknown }> = [];

        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor && results.length < batchSize) {
            results.push({ key: cursor.key, value: cursor.value });
            cursor.continue();
          } else {
            resolve(results);
          }
        };
        req.onerror = () => reject(req.error ?? new Error("Cursor read failed"));
      } catch (err) {
        reject(err);
      }
    });
  }

  private async processItem(
    dbName: string,
    storeName: string,
    rawKey: IDBValidKey,
    rawValue: unknown,
    state: MigrationState,
    dryRun: boolean,
  ): Promise<void> {
    const value = deepCloneBinary(rawValue);
    const keyStr = String(rawKey);
    const blobsCount = countBlobsAndBuffers(value);
    state.stats.blobsPreserved += blobsCount;

    // Helper to enqueue pending command idempotently
    const enqueuePending = async (
      commandId: string,
      idempotencyKey: string,
      kind: string,
      createdAt: string,
      payload: unknown,
    ) => {
      if (dryRun) {
        state.stats.commandsEnqueued++;
        return;
      }
      const existing = await this.commandQueue.get(this.owner, commandId);
      if (!existing) {
        const command = makePendingCommand({
          commandId,
          idempotencyKey,
          tenantId: this.owner.tenantId,
          userId: this.owner.userId,
          deviceId: this.context.deviceId,
          kind,
          createdAt,
          payload,
        });
        try {
          await this.commandQueue.enqueue(this.owner, command);
          state.stats.commandsEnqueued++;
        } catch (err: unknown) {
          // If already enqueued due to duplicate key or concurrent run, ignore gracefully
          const errStr = String(err);
          if (
            (err as { name?: string })?.name === "ConstraintError" ||
            errStr.includes("idempotency") ||
            errStr.includes("Constraint") ||
            errStr.includes("key")
          ) {
            // Already present, idempotent
          } else {
            throw err;
          }
        }
      }
    };

    // Helper to save KV to local database
    const saveKv = async (scopedKey: string, data: unknown) => {
      if (dryRun) {
        state.stats.kvRecordsMigrated++;
        return;
      }
      await this.localDb.set(scopedKey, data);
      state.stats.kvRecordsMigrated++;
    };

    // 1. consubov-capataz
    if (dbName === "consubov-capataz") {
      const item = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
      const itemId = String(item.id ?? keyStr);

      if (storeName === "lancamentos") {
        const isPendente = item.status === "pendente" || !item.status;
        if (isPendente) {
          await enqueuePending(
            itemId,
            `urn:consubov:capataz:lancamento:${itemId}`,
            "capataz_lancamento",
            String(item.criado_em || item.data || new Date().toISOString()),
            item,
          );
        } else {
          await saveKv(`capataz:lancamento:${itemId}`, item);
        }
      } else if (storeName === "observacoesOffline") {
        const isPendente = item.status === "pendente" || !item.sincronizado;
        if (isPendente) {
          await enqueuePending(
            itemId,
            `urn:consubov:capataz:obs:${itemId}`,
            "capataz_obs",
            String(item.criado_em || new Date().toISOString()),
            item,
          );
        } else {
          await saveKv(`capataz:obs:${itemId}`, item);
        }
      } else if (storeName === "pesagensPendentes") {
        const isPendente = item.status === "pendente" || !item.sincronizado;
        if (isPendente) {
          await enqueuePending(
            itemId,
            `urn:consubov:capataz:pesagem:${itemId}`,
            "capataz_pesagem",
            String(item.created_at || item.data || new Date().toISOString()),
            item,
          );
        } else {
          await saveKv(`capataz:pesagem:${itemId}`, item);
        }
      } else if (storeName === "syncQueue") {
        await enqueuePending(
          itemId,
          `urn:consubov:capataz:syncqueue:${itemId}`,
          "capataz_syncqueue",
          String(item.queued_at || item.created_at || new Date().toISOString()),
          item,
        );
      } else if (storeName === "syncErrors") {
        await saveKv(`capataz:sync_errors:${itemId}`, item);
      } else if (storeName === "lastPdfs") {
        await saveKv(`capataz:pdf:${itemId}`, item);
      } else if (storeName === "pastos") {
        await saveKv(`capataz:ref:pasto:${itemId}`, item);
      } else if (storeName === "retiro") {
        await saveKv(`capataz:ref:retiro:${itemId}`, item);
      } else if (storeName === "ciclos") {
        await saveKv(`capataz:ref:ciclo:${itemId}`, item);
      } else if (storeName === "produtoAtivo") {
        await saveKv(`capataz:ref:produto:${itemId}`, item);
      } else if (storeName === "fazendaCache") {
        await saveKv(`capataz:ref:fazenda:${itemId}`, item);
      } else if (storeName === "config") {
        const configKey = String(item.key ?? itemId);
        await saveKv(`capataz:config:${configKey}`, item);
      } else {
        await saveKv(`capataz:${storeName}:${itemId}`, item);
      }
      return;
    }

    // 2. consubov-session
    if (dbName === "consubov-session") {
      if (storeName === "auth_session") {
        await saveKv("session:auth_current", value);
      } else if (storeName === "offline_data") {
        await saveKv("session:offline_reference", value);
      } else {
        await saveKv(`session:${storeName}:${keyStr}`, value);
      }
      return;
    }

    // 3. consubov-consultor-offline
    if (dbName === "consubov-consultor-offline") {
      const item = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
      if (storeName === "foto_queue") {
        const localId = String(item.localId ?? keyStr);
        await enqueuePending(
          localId,
          `urn:consubov:consultor:foto:${localId}`,
          "consultor_foto",
          String(item.queuedAt || item.timestamp || new Date().toISOString()),
          item,
        );
      } else if (storeName === "text_mutations") {
        const mutationId = String(item.id ?? keyStr);
        await enqueuePending(
          mutationId,
          `urn:consubov:consultor:mutation:${mutationId}`,
          "consultor_mutation",
          String(item.timestamp || new Date().toISOString()),
          item,
        );
      } else if (storeName === "snapshots") {
        const visitaId = String(item.visitaId ?? keyStr);
        await saveKv(`consultor:snapshot:${visitaId}`, item);
      } else {
        await saveKv(`consultor:${storeName}:${keyStr}`, item);
      }
      return;
    }

    // 4. mais-arrobas-offline
    if (dbName === "mais-arrobas-offline") {
      if (storeName === "tables") {
        await saveKv(`mais_arrobas:table:${keyStr}`, value);
      } else {
        await saveKv(`mais_arrobas:${storeName}:${keyStr}`, value);
      }
      return;
    }

    // 5. mais-arrobas-sync
    if (dbName === "mais-arrobas-sync") {
      const item = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
      if (storeName === "queue") {
        const itemId = String(item.id ?? keyStr);
        await enqueuePending(
          itemId,
          `urn:consubov:mais_arrobas:queue:${itemId}`,
          "mais_arrobas_queue",
          String(item.created_at || new Date().toISOString()),
          item,
        );
      } else if (storeName === "acknowledged-inserts") {
        const ackKey = String(item.key ?? keyStr);
        await saveKv(`mais_arrobas:ack_insert:${ackKey}`, item);
      } else {
        await saveKv(`mais_arrobas_sync:${storeName}:${keyStr}`, item);
      }
      return;
    }

    // 6. consubov-fotos-salga
    if (dbName === "consubov-fotos-salga") {
      const item = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
      if (storeName === "fotos") {
        const lancId = String(item.lancamento_id ?? keyStr);
        await enqueuePending(
          lancId,
          `urn:consubov:salga:foto:${lancId}`,
          "salga_foto",
          String(item.tirada_em || new Date().toISOString()),
          item,
        );
      } else if (storeName === "feitos") {
        const lancId = String(item.lancamento_id ?? keyStr);
        await saveKv(`salga:foto_feita:${lancId}`, item);
      } else {
        await saveKv(`salga:${storeName}:${keyStr}`, item);
      }
      return;
    }

    // Generic fallback
    await saveKv(`legacy:${dbName}:${storeName}:${keyStr}`, value);
  }
}
