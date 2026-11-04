export type CriticalOperationType =
  | 'CAMERA_ACTIVE'
  | 'QR_SCANNING'
  | 'FORM_DIRTY'
  | 'LOCAL_DB_TRANSACTION'
  | 'OUTBOX_SYNCING';

export class QuiescenceRegistry {
  private activeLocks = new Map<string, { type: CriticalOperationType; registeredAt: number }>();
  private listeners = new Set<(isQuiescent: boolean) => void>();

  public acquireLock(id: string, type: CriticalOperationType): () => void {
    this.activeLocks.set(id, { type, registeredAt: Date.now() });
    this.notify();

    // Retorna função para liberar o lock
    return () => {
      this.activeLocks.delete(id);
      this.notify();
    };
  }

  public isQuiescent(): boolean {
    return this.activeLocks.size === 0;
  }

  public getActiveLocks(): ReadonlyArray<{ id: string; type: CriticalOperationType }> {
    return Array.from(this.activeLocks.entries()).map(([id, lock]) => ({ id, type: lock.type }));
  }

  public subscribe(listener: (isQuiescent: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public async whenQuiescent(timeoutMs: number = 60000): Promise<boolean> {
    if (this.isQuiescent()) return true;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        unsubscribe();
        resolve(this.isQuiescent());
      }, timeoutMs);

      const unsubscribe = this.subscribe((quiescent) => {
        if (quiescent) {
          clearTimeout(timer);
          unsubscribe();
          resolve(true);
        }
      });
    });
  }

  private notify(): void {
    const quiescent = this.isQuiescent();
    this.listeners.forEach((fn) => fn(quiescent));
  }
}
