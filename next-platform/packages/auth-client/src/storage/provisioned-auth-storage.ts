export interface ProvisionedCredential {
  email: string;
  deviceId: string;
  salt: Uint8Array;
  verifier: Uint8Array;
  iv: Uint8Array;
  ciphertext: Uint8Array;
  integrity: Uint8Array;
  storedAt: string;
}

export interface IProvisionedAuthStorage {
  getOrCreateDeviceId(): Promise<string>;
  getOrCreateIntegrityKey(deviceId: string): Promise<CryptoKey>;
  getCredential(email: string, deviceId: string): Promise<ProvisionedCredential | null>;
  saveCredential(record: ProvisionedCredential, isCurrent?: () => boolean): Promise<void>;
  removeCredential(email: string, deviceId: string): Promise<void>;
  /** Compare and remove in one transaction; a later online grant must survive an older revocation. */
  removeCredentialIfMatches(record: ProvisionedCredential): Promise<boolean>;
}

const DEFAULT_DATABASE_NAME = 'consubov-auth-local-v1';
const DATABASE_VERSION = 1;
const METADATA_STORE = 'metadata';
const CREDENTIAL_STORE = 'credentials';

export class IndexedDbProvisionedAuthStorage implements IProvisionedAuthStorage {
  private databasePromise: Promise<IDBDatabase> | null = null;
  private readonly databaseName: string;

  constructor(options: { databaseName?: string } = {}) {
    this.databaseName = options.databaseName ?? DEFAULT_DATABASE_NAME;
  }

  async close(): Promise<void> {
    const databasePromise = this.databasePromise;
    this.databasePromise = null;
    if (databasePromise) await databasePromise.then(database => database.close()).catch(() => {});
  }

  async getOrCreateDeviceId(): Promise<string> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(METADATA_STORE, 'readwrite');
      const store = tx.objectStore(METADATA_STORE);
      const request = store.get('device-id');
      let deviceId = '';
      request.onsuccess = () => {
        deviceId = typeof request.result?.value === 'string' ? request.result.value : crypto.randomUUID();
        if (!request.result) store.put({ key: 'device-id', value: deviceId });
      };
      request.onerror = () => reject(request.error ?? new Error('Não foi possível ler o identificador local do dispositivo.'));
      tx.oncomplete = () => resolve(deviceId);
      tx.onerror = () => reject(tx.error ?? new Error('Não foi possível persistir o identificador local do dispositivo.'));
      tx.onabort = () => reject(tx.error ?? new Error('A transação de autenticação local foi cancelada.'));
    });
  }

  async getCredential(email: string, deviceId: string): Promise<ProvisionedCredential | null> {
    const db = await this.openDatabase();
    return requestValue<ProvisionedCredential | undefined>(db.transaction(CREDENTIAL_STORE, 'readonly').objectStore(CREDENTIAL_STORE).get(credentialKey(email, deviceId)))
      .then(record => record ?? null);
  }

  async getOrCreateIntegrityKey(deviceId: string): Promise<CryptoKey> {
    const db = await this.openDatabase();
    const keyName = `device-integrity-key:${deviceId}`;
    const existing = await requestValue<{ key: string; value: CryptoKey } | undefined>(db.transaction(METADATA_STORE, 'readonly').objectStore(METADATA_STORE).get(keyName));
    if (existing?.value) return existing.value;
    const generated = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(METADATA_STORE, 'readwrite');
      const store = tx.objectStore(METADATA_STORE);
      let chosen: CryptoKey = generated;
      const request = store.get(keyName);
      request.onsuccess = () => {
        chosen = request.result?.value ?? generated;
        if (!request.result?.value) store.put({ key: keyName, value: generated });
      };
      request.onerror = () => reject(request.error ?? new Error('Não foi possível carregar a chave local do dispositivo.'));
      tx.oncomplete = () => resolve(chosen);
      tx.onerror = () => reject(tx.error ?? new Error('Não foi possível persistir a chave local do dispositivo.'));
      tx.onabort = () => reject(tx.error ?? new Error('A transação da chave local foi cancelada.'));
    });
  }

  async saveCredential(record: ProvisionedCredential, isCurrent: () => boolean = () => true): Promise<void> {
    const db = await this.openDatabase();
    if (!isCurrent()) throw new Error('A autenticação foi cancelada antes de persistir a autorização local.');
    const tx = db.transaction(CREDENTIAL_STORE, 'readwrite');
    tx.objectStore(CREDENTIAL_STORE).put({ ...record, id: credentialKey(record.email, record.deviceId) });
    await transactionComplete(tx);
  }

  async removeCredential(email: string, deviceId: string): Promise<void> {
    const db = await this.openDatabase();
    const tx = db.transaction(CREDENTIAL_STORE, 'readwrite');
    tx.objectStore(CREDENTIAL_STORE).delete(credentialKey(email, deviceId));
    await transactionComplete(tx);
  }

  async removeCredentialIfMatches(record: ProvisionedCredential): Promise<boolean> {
    const db = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CREDENTIAL_STORE, 'readwrite');
      const store = tx.objectStore(CREDENTIAL_STORE);
      const key = credentialKey(record.email, record.deviceId);
      const request = store.get(key);
      let removed = false;
      request.onsuccess = () => {
        if (sameProvisionedCredential(request.result, record)) { store.delete(key); removed = true; }
      };
      request.onerror = () => reject(request.error ?? new Error('Não foi possível verificar a autorização local.'));
      tx.oncomplete = () => resolve(removed);
      tx.onerror = () => reject(tx.error ?? new Error('Não foi possível bloquear a autorização local.'));
      tx.onabort = () => reject(tx.error ?? new Error('O bloqueio da autorização local foi cancelado.'));
    });
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB indisponível para autenticação local.'));
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.databaseName, DATABASE_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(METADATA_STORE)) db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
          if (!db.objectStoreNames.contains(CREDENTIAL_STORE)) db.createObjectStore(CREDENTIAL_STORE, { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o armazenamento local de autenticação.'));
        request.onblocked = () => reject(new Error('O armazenamento local de autenticação está bloqueado por outra versão aberta.'));
      });
    }
    return this.databasePromise;
  }
}

export class InMemoryProvisionedAuthStorage implements IProvisionedAuthStorage {
  private deviceId: string | null = null;
  private credentials = new Map<string, ProvisionedCredential>();
  private integrityKeys = new Map<string, CryptoKey>();

  async getOrCreateDeviceId(): Promise<string> {
    this.deviceId ??= crypto.randomUUID();
    return this.deviceId;
  }
  async getCredential(email: string, deviceId: string): Promise<ProvisionedCredential | null> {
    const record = this.credentials.get(credentialKey(email, deviceId));
    return record ? structuredClone(record) : null;
  }
  async getOrCreateIntegrityKey(deviceId: string): Promise<CryptoKey> {
    let key = this.integrityKeys.get(deviceId);
    if (!key) {
      key = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
      this.integrityKeys.set(deviceId, key);
    }
    return key;
  }
  async saveCredential(record: ProvisionedCredential, isCurrent: () => boolean = () => true): Promise<void> {
    if (!isCurrent()) throw new Error('A autenticação foi cancelada antes de persistir a autorização local.');
    this.credentials.set(credentialKey(record.email, record.deviceId), structuredClone(record));
  }
  async removeCredential(email: string, deviceId: string): Promise<void> {
    this.credentials.delete(credentialKey(email, deviceId));
  }
  async removeCredentialIfMatches(record: ProvisionedCredential): Promise<boolean> {
    const key = credentialKey(record.email, record.deviceId);
    if (!sameProvisionedCredential(this.credentials.get(key), record)) return false;
    this.credentials.delete(key);
    return true;
  }
}

/** Equality of the complete signed/encrypted record, excluding IndexedDB's internal row key. */
export function sameProvisionedCredential(left: ProvisionedCredential | null | undefined, right: ProvisionedCredential): boolean {
  if (!left || left.email !== right.email || left.deviceId !== right.deviceId || left.storedAt !== right.storedAt) return false;
  return (['salt', 'verifier', 'iv', 'ciphertext', 'integrity'] as const).every(field => {
    const a = left[field], b = right[field];
    return a instanceof Uint8Array && b instanceof Uint8Array && a.length === b.length && a.every((byte, index) => byte === b[index]);
  });
}

function credentialKey(email: string, deviceId: string): string {
  return `${email.trim().toLowerCase()}\u0000${deviceId}`;
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha ao consultar autenticação local.'));
  });
}

function transactionComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha ao gravar autenticação local.'));
    tx.onabort = () => reject(tx.error ?? new Error('Gravação de autenticação local cancelada.'));
  });
}
