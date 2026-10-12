/** Read-only inventory for upgrade planning. Never migrates, deletes, or reads records. */
export const LEGACY_OFFLINE_DATABASES = [
  { name: 'consubov-capataz', version: 7, stores: ['lancamentos', 'pastos', 'retiro', 'ciclos', 'config', 'observacoesOffline', 'produtoAtivo', 'fazendaCache', 'pesagensPendentes', 'syncQueue', 'syncErrors', 'lastPdfs'] },
  { name: 'consubov-session', version: 1, stores: ['auth_session', 'offline_data'] },
  { name: 'consubov-consultor-offline', version: 2, stores: ['foto_queue', 'snapshots', 'text_mutations'] },
  { name: 'mais-arrobas-offline', version: 1, stores: ['tables'] },
  { name: 'mais-arrobas-sync', version: 2, stores: ['queue', 'acknowledged-inserts'] },
  { name: 'consubov-fotos-salga', version: 1, stores: ['fotos', 'feitos'] },
] as const;

export const LEGACY_LOCAL_STORAGE_KEYS = ['pending_backup', 'pending_backup_at', 'ma-offline-mode'] as const;

type StoreDescription = {
  name: string;
  keyPath: string | string[] | null;
  indices: string[];
  autoIncrement: boolean;
  indexDefinitions: { name: string; keyPath: string | string[]; unique: boolean; multiEntry: boolean }[];
};

export type LegacyDatabaseInspection = {
  name: string;
  expectedVersion: number;
  actualVersion: number;
  stores: StoreDescription[];
  missingExpectedStores: string[];
  error?: string;
};

export type LegacyOfflineInventory = {
  status: 'ok' | 'unsupported' | 'unavailable' | 'error';
  databases: LegacyDatabaseInspection[];
  localStorageKeysPresent: string[];
  localStorageStatus: 'available' | 'unavailable';
  // The inventory reports metadata only. It never opens a readwrite transaction.
};

function inspectKnownDatabase(factory: IDBFactory, name: string, expectedStores: readonly string[], expectedVersion: number): Promise<LegacyDatabaseInspection> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(name); // version omitted: never upgrade an existing database
    } catch {
      // One inaccessible DB must not discard metadata already gathered from other DBs.
      resolve({ name, expectedVersion, actualVersion: 0, stores: [], missingExpectedStores: [...expectedStores], error: 'open-unavailable' });
      return;
    }
    request.onupgradeneeded = () => {
      // A database deleted between databases() and open() must not be recreated.
      request.transaction?.abort();
    };
    request.onerror = () => {
      resolve({ name, expectedVersion, actualVersion: 0, stores: [], missingExpectedStores: [...expectedStores], error: 'open-failed-or-raced-with-delete' });
    };
    request.onsuccess = () => {
      const db = request.result;
      try {
        const stores: StoreDescription[] = Array.from(db.objectStoreNames, (storeName) => {
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const indices = Array.from(store.indexNames);
          return {
            name: storeName, keyPath: store.keyPath, indices, autoIncrement: store.autoIncrement,
            indexDefinitions: indices.map((name) => {
              const index = store.index(name);
              return { name, keyPath: index.keyPath, unique: index.unique, multiEntry: index.multiEntry };
            }),
          };
        });
        resolve({
          name,
          expectedVersion,
          actualVersion: db.version,
          stores,
          missingExpectedStores: expectedStores.filter((storeName) => !stores.some((store) => store.name === storeName)),
        });
      } catch {
        resolve({ name, expectedVersion, actualVersion: db.version, stores: [], missingExpectedStores: [...expectedStores], error: 'metadata-read-failed' });
      } finally {
        db.close();
      }
    };
  });
}

function defaultFactory(): IDBFactory | undefined {
  try { return globalThis.indexedDB; } catch { return undefined; }
}

function defaultLocalStorage(): Pick<Storage, 'getItem'> | undefined {
  try { return globalThis.localStorage; } catch { return undefined; }
}

/**
 * Does not enumerate records, export tokens, mutate stores or infer tenant ownership.
 * When IDBFactory.databases() is unavailable, it refuses to probe missing names:
 * calling indexedDB.open(name) without a known existing name could create a DB.
 */
export async function inspectLegacyOffline(
  factory: IDBFactory | undefined = defaultFactory(),
  localStorageReader: Pick<Storage, 'getItem'> | undefined = defaultLocalStorage(),
): Promise<LegacyOfflineInventory> {
  const present: string[] = [];
  let localStorageStatus: LegacyOfflineInventory['localStorageStatus'] = localStorageReader ? 'available' : 'unavailable';
  for (const key of LEGACY_LOCAL_STORAGE_KEYS) {
    try {
      if (localStorageReader?.getItem(key) != null) present.push(key);
    } catch {
      // Absence of a readable value is not proof that a local backup does not exist.
      localStorageStatus = 'unavailable';
    }
  }
  const report = (status: LegacyOfflineInventory['status'], databases: LegacyDatabaseInspection[] = []): LegacyOfflineInventory =>
    ({ status, databases, localStorageKeysPresent: present, localStorageStatus });
  if (!factory) return report('unavailable');
  try {
    if (typeof factory.databases !== 'function') return report('unsupported');
    const existing = await factory.databases();
    const names = new Set(existing.map((db) => db.name).filter((name): name is string => typeof name === 'string'));
    const results: LegacyDatabaseInspection[] = [];
    for (const expected of LEGACY_OFFLINE_DATABASES) {
      if (!names.has(expected.name)) continue;
      results.push(await inspectKnownDatabase(factory, expected.name, expected.stores, expected.version));
    }
    return report('ok', results);
  } catch {
    return report('error');
  }
}
