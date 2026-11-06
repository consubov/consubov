import { webLocksLeader, type PartitionLeader } from './SilentSyncRunner';

interface Lease { key: string; owner: string; fence: number; expiresAt: number; }

/** A short durable lease is the explicit fallback where Web Locks is absent.
 * Fencing is verified at every side-effect boundary; idempotency protects an
 * already dispatched HTTP request if a suspended tab outlives its lease. */
export class IndexedDbPartitionLeader implements PartitionLeader {
  constructor(private readonly ttlMs = 15_000, private readonly now = Date.now) {
    if (ttlMs < 300) throw new Error('Lease TTL too short');
  }

  private async change<T>(key: string, action: (current: Lease | undefined, store: IDBObjectStore) => T): Promise<T> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('consubov-shell-sync-leases-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('leases', { keyPath: 'key' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Sync lease database blocked'));
    });
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction('leases', 'readwrite');
      const store = tx.objectStore('leases');
      let result: T;
      let failure: unknown;
      const request = store.get(key);
      request.onsuccess = () => {
        try { result = action(request.result as Lease | undefined, store); }
        catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onabort = () => { db.close(); reject(failure ?? tx.error ?? new Error('Sync lease transaction aborted')); };
      tx.onerror = () => undefined;
    });
  }

  async run(key: string, signal: AbortSignal, work: (assertLeadership: () => Promise<void>, isLeadershipCurrent?: () => boolean) => Promise<void>): Promise<boolean> {
    if (signal.aborted) return false;
    const owner = crypto.randomUUID();
    const acquired = await this.change(key, (current, store) => {
      if (signal.aborted || (current && current.expiresAt > this.now())) return null;
      const lease: Lease = { key, owner, fence: (current?.fence ?? 0) + 1, expiresAt: this.now() + this.ttlMs };
      store.put(lease);
      return lease;
    });
    if (!acquired) return false;
    let lost = false;
    let expiresAt = acquired.expiresAt;
    let renewing = false;
    const assertLeadership = async () => {
      if (lost || signal.aborted) throw new DOMException('Sync lease ended', 'AbortError');
      expiresAt = await this.change(key, (current, store) => {
        if (signal.aborted || !current || current.owner !== owner || current.fence !== acquired.fence || current.expiresAt <= this.now()) {
          lost = true;
          throw new DOMException('Sync lease lost', 'AbortError');
        }
        const nextExpiry = this.now() + this.ttlMs;
        store.put({ ...current, expiresAt: nextExpiry });
        return nextExpiry;
      });
    };
    const timer = setInterval(() => {
      if (renewing || lost) return;
      renewing = true;
      void assertLeadership().catch(() => { lost = true; }).finally(() => { renewing = false; });
    }, Math.floor(this.ttlMs / 3));
    try {
      await assertLeadership();
      await work(assertLeadership, () => !lost && !signal.aborted && this.now() < expiresAt);
      return true;
    } finally {
      clearInterval(timer);
      await this.change(key, (current, store) => {
        // Retain the fence on release; the next leader always gets a higher fence.
        if (current?.owner === owner && current.fence === acquired.fence) store.put({ ...current, expiresAt: 0 });
      });
    }
  }
}

export function browserPartitionLeader(): PartitionLeader {
  return globalThis.navigator?.locks ? webLocksLeader() : new IndexedDbPartitionLeader();
}
