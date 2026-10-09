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
  // The inventory reports metadata only. It never opens a readwrite transaction.
};

function inspectKnownDatabase(factory: IDBFactory, name: string, expectedStores: readonly string[], expectedVersion: number): Promise<LegacyDatabaseInspection> {
  return new Promise((resolve) => {
    const request = factory.open(name); // version omitted: do not upgrade an existing database
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
          return { name: storeName, keyPath: store.keyPath, indices: Array.from(store.indexNames) };
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

/**
 * Does not enumerate records, export tokens, mutate stores or infer tenant ownership.
 * When IDBFactory.databases() is unavailable, it refuses to probe missing names:
 * calling indexedDB.open(name) without a known existing name could create a DB.
 */
export async function inspectLegacyOffline(
  factory: IDBFactory | undefined = typeof indexedDB !== 'undefined' ? indexedDB : undefined,
  localStorageReader: Pick<Storage, 'getItem'> | undefined = typeof localStorage !== 'undefined' ? localStorage : undefined,
): Promise<LegacyOfflineInventory> {
  const present: string[] = [];
  for (const key of LEGACY_LOCAL_STORAGE_KEYS) {
    try {
      if (localStorageReader?.getItem(key) != null) present.push(key);
    } catch {
      // Disabled storage must not prevent a read-only inspection.
    }
  }
  if (!factory) return { status: 'unavailable', databases: [], localStorageKeysPresent: present };
  if (typeof factory.databases !== 'function') return { status: 'unsupported', databases: [], localStorageKeysPresent: present };
  try {
    const existing = await factory.databases();
    const names = new Set(existing.map((db) => db.name).filter((name): name is string => typeof name === 'string'));
    const results: LegacyDatabaseInspection[] = [];
    for (const expected of LEGACY_OFFLINE_DATABASES) {
      if (!names.has(expected.name)) continue;
      results.push(await inspectKnownDatabase(factory, expected.name, expected.stores, expected.version));
    }
    return { status: 'ok', databases: results, localStorageKeysPresent: present };
  } catch {
    return { status: 'error', databases: [], localStorageKeysPresent: present };
  }
}
