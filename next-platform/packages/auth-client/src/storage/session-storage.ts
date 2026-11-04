import { SyntheticUserSession } from '../identity/context';
import { TokenPair } from '../identity/credentials';

export interface StoredSessionData {
  session: SyntheticUserSession;
  tokens: TokenPair | null;
  partitionKey: string;
  storedAt: string;
}

export interface ISessionStorage {
  getItem(key: string): StoredSessionData | null;
  setItem(key: string, data: StoredSessionData): void;
  removeItem(key: string): void;
  clear(): void;
}

export class InMemorySessionStorage implements ISessionStorage {
  private store = new Map<string, StoredSessionData>();

  public getItem(key: string): StoredSessionData | null {
    return this.store.get(key) ?? null;
  }

  public setItem(key: string, data: StoredSessionData): void {
    this.store.set(key, data);
  }

  public removeItem(key: string): void {
    this.store.delete(key);
  }

  public clear(): void {
    this.store.clear();
  }
}

export class LocalStorageSessionStorage implements ISessionStorage {
  private memoryFallback = new InMemorySessionStorage();
  private prefix = 'consubov:auth:session:';

  private isAvailable(): boolean {
    try {
      return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    } catch {
      return false;
    }
  }

  public getItem(key: string): StoredSessionData | null {
    if (!this.isAvailable()) {
      return this.memoryFallback.getItem(key);
    }
    try {
      const raw = window.localStorage.getItem(this.prefix + key);
      return raw ? (JSON.parse(raw) as StoredSessionData) : null;
    } catch {
      return this.memoryFallback.getItem(key);
    }
  }

  public setItem(key: string, data: StoredSessionData): void {
    if (!this.isAvailable()) {
      this.memoryFallback.setItem(key, data);
      return;
    }
    try {
      window.localStorage.setItem(this.prefix + key, JSON.stringify(data));
    } catch {
      this.memoryFallback.setItem(key, data);
    }
  }

  public removeItem(key: string): void {
    if (!this.isAvailable()) {
      this.memoryFallback.removeItem(key);
      return;
    }
    try {
      window.localStorage.removeItem(this.prefix + key);
    } catch {
      this.memoryFallback.removeItem(key);
    }
  }

  public clear(): void {
    if (!this.isAvailable()) {
      this.memoryFallback.clear();
      return;
    }
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(this.prefix)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => window.localStorage.removeItem(k));
    } catch {
      this.memoryFallback.clear();
    }
  }
}
