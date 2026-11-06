export type CriticalOperationType =
  | 'FORM_DIRTY'
  | 'CAMERA_ACTIVE'
  | 'WEIGHING_ACTIVE'
  | 'OUTBOX_SYNCING'
  | 'QR_SCANNING'
  | 'LOCAL_DB_TRANSACTION';

export interface QuiescenceLockInfo {
  id: string;
  type: CriticalOperationType;
  registeredAt: number;
  metadata?: Record<string, unknown>;
}

export class QuiescenceRegistry {
  private activeLocks = new Map<string, QuiescenceLockInfo>();
  private listeners = new Set<(isQuiescent: boolean) => void>();
  private lease: { leaseId: string; expiresAt: number } | null = null;
  private leaseTimer: ReturnType<typeof setTimeout> | undefined;

  public isFrozen(): boolean {
    if (this.lease && this.lease.expiresAt <= Date.now()) this.releaseActivation(this.lease.leaseId);
    return this.lease !== null;
  }

  public prepareActivation(ttlMs = 30000): { leaseId: string; expiresAt: number } | null {
    if (!this.isQuiescent() || this.isFrozen()) return null;
    const boundedTtl = Number.isFinite(ttlMs) ? Math.ceil(Math.max(1, Math.min(ttlMs, 30000))) : 30000;
    const lease = { leaseId: crypto.randomUUID(), expiresAt: Date.now() + boundedTtl };
    this.lease = lease;
    this.leaseTimer = setTimeout(() => this.releaseActivation(lease.leaseId), lease.expiresAt - Date.now());
    this.notify();
    return { ...lease };
  }

  public validateActivationLease(leaseId: string): boolean {
    return this.isFrozen() && this.lease?.leaseId === leaseId && this.isQuiescent();
  }

  public releaseActivation(leaseId: string): void {
    if (this.lease?.leaseId !== leaseId) return;
    clearTimeout(this.leaseTimer);
    this.lease = null;
    this.notify();
  }

  public acquireLock(
    id: string,
    type: CriticalOperationType,
    metadata?: Record<string, unknown>
  ): () => void {
    if (this.isFrozen()) throw new Error('ACTIVATION_PREPARED');
    this.activeLocks.set(id, {
      id,
      type,
      registeredAt: Date.now(),
      metadata
    });
    this.notify();

    // Retorna função para liberar o lock
    return () => {
      this.releaseLock(id);
    };
  }

  public releaseLock(id: string): void {
    if (this.activeLocks.delete(id)) {
      this.notify();
    }
  }

  public isQuiescent(): boolean {
    return this.activeLocks.size === 0;
  }

  public getActiveLocks(): ReadonlyArray<QuiescenceLockInfo> {
    return Array.from(this.activeLocks.values());
  }

  public hasLockType(type: CriticalOperationType): boolean {
    for (const lock of this.activeLocks.values()) {
      if (lock.type === type) return true;
    }
    return false;
  }

  public clearAllLocks(): void {
    if (this.activeLocks.size > 0) {
      this.activeLocks.clear();
      this.notify();
    }
  }

  public subscribe(listener: (isQuiescent: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async whenQuiescent(timeoutMs: number = 60000): Promise<boolean> {
    if (this.isQuiescent()) return true;

    return new Promise((resolve) => {
      let timer: NodeJS.Timeout | number;

      const unsubscribe = this.subscribe((quiescent) => {
        if (quiescent) {
          clearTimeout(timer);
          unsubscribe();
          resolve(true);
        }
      });

      timer = setTimeout(() => {
        unsubscribe();
        resolve(this.isQuiescent());
      }, timeoutMs);
    });
  }

  private notify(): void {
    const quiescent = this.isQuiescent();
    this.listeners.forEach((fn) => fn(quiescent));
  }
}

// Instância singleton global da aplicação
export const globalQuiescenceRegistry = new QuiescenceRegistry();
