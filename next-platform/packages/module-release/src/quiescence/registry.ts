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

  public acquireLock(
    id: string,
    type: CriticalOperationType,
    metadata?: Record<string, unknown>
  ): () => void {
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
