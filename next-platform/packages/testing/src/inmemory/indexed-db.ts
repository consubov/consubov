export class StorageQuotaExceededError extends Error {
  constructor() {
    super('QUOTA_EXCEEDED: Armazenamento local do dispositivo atingiu o limite.');
    this.name = 'StorageQuotaExceededError';
  }
}

export class InMemoryIndexedDbStore<T extends { id: string }> {
  private data = new Map<string, T>();
  private failNextWriteWithQuota: boolean = false;

  public injectQuotaFailure(enable: boolean = true): void {
    this.failNextWriteWithQuota = enable;
  }

  public async put(item: T): Promise<void> {
    if (this.failNextWriteWithQuota) {
      throw new StorageQuotaExceededError();
    }
    this.data.set(item.id, JSON.parse(JSON.stringify(item)));
  }

  public async get(id: string): Promise<T | null> {
    const item = this.data.get(id);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  public async getAll(): Promise<T[]> {
    return Array.from(this.data.values()).map(item => JSON.parse(JSON.stringify(item)));
  }

  public async delete(id: string): Promise<void> {
    this.data.delete(id);
  }

  public async clear(): Promise<void> {
    this.data.clear();
  }

  public count(): number {
    return this.data.size;
  }
}
