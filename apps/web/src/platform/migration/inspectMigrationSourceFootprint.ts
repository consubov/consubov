import { LEGACY_OFFLINE_DATABASES } from "../../lib/legacyOfflineInventory";
import { LEGACY_APP_ORIGIN, type LegacyDatabase } from "./oneTouchMigrationFlow";

/**
 * Metadata-only preflight intended for the still-installed v1 PWA.
 * No reads of record values, no copy of auth_session, no writes, no deletion.
 * A complete inventory is NOT a backup or a durable server ACK.
 */
export interface MigrationSourceStoreFootprint {
  storeName: string;
  recordCount: number;
}

export interface MigrationSourceDatabaseFootprint {
  name: LegacyDatabase;
  present: boolean;
  expectedVersion: number;
  actualVersion: number | null;
  stores: MigrationSourceStoreFootprint[];
}

export type MigrationSourceInspection =
  | {
      status: "inventory-complete";
      databases: MigrationSourceDatabaseFootprint[];
      totalRecords: number;
      /** Intentionally never grants a migration/redirect. */
      readyToHandoff: false;
    }
  | {
      status: "blocked";
      reason:
        | "WRONG_ORIGIN"
        | "DATABASE_ENUMERATION_UNAVAILABLE"
        | "DATABASE_ACCESS_FAILED"
        | "SCHEMA_UNRECOGNIZED";
      /** Do not treat partial counts as an authoritative backup. */
      databases: MigrationSourceDatabaseFootprint[];
      readyToHandoff: false;
    };

async function openExistingReadonly(
  factory: IDBFactory,
  name: string,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let changed = false;
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(name);
    } catch {
      reject(new Error("DATABASE_ACCESS_FAILED"));
      return;
    }
    request.onupgradeneeded = () => {
      changed = true;
      // This can only happen if it was removed between enumeration/open.
      // Abort immediately: never create a legacy DB while inspecting it.
      request.transaction?.abort();
      reject(new Error("DATABASE_ACCESS_FAILED"));
    };
    request.onsuccess = () => {
      if (changed) {
        request.result.close();
        reject(new Error("DATABASE_ACCESS_FAILED"));
      } else {
        resolve(request.result);
      }
    };
    request.onerror = () => reject(new Error("DATABASE_ACCESS_FAILED"));
    request.onblocked = () => reject(new Error("DATABASE_ACCESS_FAILED"));
  });
}

async function countReadOnly(db: IDBDatabase, storeName: string): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).count();
      request.onsuccess = () => {
        if (!Number.isSafeInteger(request.result) || request.result < 0) {
          reject(new Error("DATABASE_ACCESS_FAILED"));
          return;
        }
        resolve(request.result);
      };
      request.onerror = () => reject(new Error("DATABASE_ACCESS_FAILED"));
      transaction.onabort = () => reject(new Error("DATABASE_ACCESS_FAILED"));
    } catch {
      reject(new Error("DATABASE_ACCESS_FAILED"));
    }
  });
}

/**
 * Fail closed on unsupported Safari/indexedDB.databases(), inaccessible DBs,
 * missing/extra stores or unknown schema versions.
 *
 * Absent DBs are listed explicitly (a particular profile may never have used
 * a module), not silently opened or manufactured.
 */
export async function inspectMigrationSourceFootprint(
  origin: string,
  factory: IDBFactory | undefined = typeof indexedDB === "undefined" ? undefined : indexedDB,
): Promise<MigrationSourceInspection> {
  const databases: MigrationSourceDatabaseFootprint[] = [];
  const blocked = (
    reason: Extract<MigrationSourceInspection, { status: "blocked" }>["reason"],
  ): MigrationSourceInspection => ({
    status: "blocked",
    reason,
    databases,
    readyToHandoff: false,
  });

  if (origin !== LEGACY_APP_ORIGIN) return blocked("WRONG_ORIGIN");
  if (!factory || typeof factory.databases !== "function") {
    return blocked("DATABASE_ENUMERATION_UNAVAILABLE");
  }

  let knownNames: Set<string>;
  try {
    const available = await factory.databases();
    if (!Array.isArray(available)) return blocked("DATABASE_ENUMERATION_UNAVAILABLE");
    knownNames = new Set(
      available.map((item) => item.name).filter((name): name is string => typeof name === "string"),
    );
  } catch {
    return blocked("DATABASE_ENUMERATION_UNAVAILABLE");
  }

  for (const expected of LEGACY_OFFLINE_DATABASES) {
    const name = expected.name as LegacyDatabase;
    if (!knownNames.has(name)) {
      databases.push({
        name,
        present: false,
        expectedVersion: expected.version,
        actualVersion: null,
        stores: [],
      });
      continue;
    }

    let db: IDBDatabase;
    try {
      db = await openExistingReadonly(factory, name);
    } catch {
      return blocked("DATABASE_ACCESS_FAILED");
    }

    try {
      const actualStores = Array.from(db.objectStoreNames);
      const exactStores =
        actualStores.length === expected.stores.length &&
        expected.stores.every((store) => actualStores.includes(store));
      if (db.version !== expected.version || !exactStores) {
        return blocked("SCHEMA_UNRECOGNIZED");
      }

      const stores: MigrationSourceStoreFootprint[] = [];
      for (const storeName of expected.stores) {
        stores.push({
          storeName,
          recordCount: await countReadOnly(db, storeName),
        });
      }
      databases.push({
        name,
        present: true,
        expectedVersion: expected.version,
        actualVersion: db.version,
        stores,
      });
    } catch {
      return blocked("DATABASE_ACCESS_FAILED");
    } finally {
      db.close();
    }
  }

  return {
    status: "inventory-complete",
    databases,
    totalRecords: databases.reduce(
      (total, db) => total + db.stores.reduce((storeTotal, store) => storeTotal + store.recordCount, 0),
      0,
    ),
    readyToHandoff: false,
  };
}
