import type { LocalDatabase } from "../contracts";

/**
 * PWA next-generation key/value store. It uses its own database and never
 * upgrades or deletes any of the six existing field-work databases.
 *
 * This is a storage boundary, NOT an authentication or authorization check.
 * Tenant/user identity must come from a verified session before construction.
 */
export const NEXT_LOCAL_DB_NAME = "consubov-vnext-local";
const NEXT_LOCAL_DB_VERSION = 1;
const STORE_NAME = "kv";

type StoredValue = { id: string; value: unknown };

export type LocalOwner = Readonly<{ tenantId: string; userId: string }>;

function validPart(value: string, name: string): string {
  if (typeof value !== "string" || !value.trim() || value.trim() !== value) {
    throw new TypeError(name + " is required and must be normalized");
  }
  return value;
}

export class IndexedDbLocalDatabase implements LocalDatabase {
  private connection: Promise<IDBDatabase> | null = null;
  private readonly tenantId: string;
  private readonly userId: string;

  constructor(
    owner: LocalOwner,
    private readonly factory: IDBFactory | undefined = typeof indexedDB === "undefined" ? undefined : indexedDB,
  ) {
    this.tenantId = validPart(owner.tenantId, "tenantId");
    this.userId = validPart(owner.userId, "userId");
  }

  private scopedKey(key: string) {
    return JSON.stringify([this.tenantId, this.userId, validPart(key, "key")]);
  }

  private async db(): Promise<IDBDatabase> {
    if (!this.factory) throw new Error("IndexedDB indisponivel; dados nao foram gravados");
    if (!this.connection) {
      this.connection = new Promise<IDBDatabase>((resolve, reject) => {
        let request: IDBOpenDBRequest;
        let failed = false;
        const fail = (error: unknown) => { failed = true; reject(error); };
        try {
          request = this.factory!.open(NEXT_LOCAL_DB_NAME, NEXT_LOCAL_DB_VERSION);
        } catch (error) {
          fail(error);
          return;
        }
        request.onupgradeneeded = () => {
          if (failed) { request.transaction?.abort(); return; }
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "id" });
          }
        };
        request.onsuccess = () => {
          const db = request.result;
          // An open request can still succeed after onblocked rejected it.
          // Close that abandoned connection instead of leaking an upgrade blocker.
          if (failed) { db.close(); return; }
          try {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              throw new Error("IndexedDB schema incompatible: missing kv store");
            }
            const store = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME);
            if (store.keyPath !== "id" || store.autoIncrement) {
              throw new Error("IndexedDB schema incompatible: kv must use the scoped id key");
            }
          } catch (error) {
            db.close();
            fail(error);
            return;
          }
          db.onversionchange = () => {
            db.close();
            this.connection = null;
          };
          resolve(db);
        };
        request.onerror = () => fail(request.error ?? new Error("IndexedDB open failed"));
        request.onblocked = () => fail(new Error("IndexedDB blocked by another tab"));
      }).catch((error) => {
        this.connection = null;
        throw error;
      });
    }
    return this.connection;
  }

  private async operation<T>(
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => IDBRequest,
    decode: (result: unknown) => T,
  ): Promise<T> {
    const db = await this.db();
    return new Promise<T>((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        let result: unknown;
        tx.oncomplete = () => resolve(decode(result));
        tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
        tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
        const request = callback(store);
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
      } catch (error) {
        reject(error);
      }
    });
  }

  async get<T>(key: string): Promise<T | undefined> {
    const id = this.scopedKey(key);
    return this.operation("readonly", (store) => store.get(id), (value) =>
      (value as StoredValue | undefined)?.value as T | undefined,
    );
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (value === undefined) throw new TypeError("undefined cannot be persisted reliably");
    const id = this.scopedKey(key);
    // Capture exactly what the caller accepted, before opening storage yields.
    // Uncloneable input fails before a database or transaction is created.
    const snapshot = structuredClone(value);
    await this.operation("readwrite", (store) => store.put({ id, value: snapshot } satisfies StoredValue), () => undefined);
  }

  async delete(key: string): Promise<void> {
    const id = this.scopedKey(key);
    await this.operation("readwrite", (store) => store.delete(id), () => undefined);
  }

  /** Only closes this adapter; no records/databases are removed. */
  async close(): Promise<void> {
    if (this.connection) {
      const db = await this.connection;
      db.close();
      this.connection = null;
    }
  }
}
