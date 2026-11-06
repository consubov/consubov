import { expect, test } from 'bun:test';
import { QuiescenceRegistry } from '@consubov/module-release';
import type { ModuleAccountPartition, ModuleExecutionContext } from '@consubov/contracts';
import { QuiescentLocalData } from './QuiescentLocalData';

const partition: ModuleAccountPartition = { moduleId: 'capataz', profileId: 'capataz', productId: 'consubov', userId: 'user-test', tenantId: 'tenant-test', farmId: 'farm-test', retreatId: null };
const context: ModuleExecutionContext = { ...partition, deviceId: 'device-test' };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('real host read keeps its lock from database open until transaction completion, including RPC caller abandonment', async () => {
  // A controllable browser driver exposes request success separately from commit.
  // The real superclass opens the database and owns the transaction handlers.
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  const registry = new QuiescenceRegistry();
  const request = {} as IDBOpenDBRequest;
  const get = { result: { value: 2 } } as IDBRequest;
  let closed = false;
  const tx = { objectStore: () => ({ get: () => get }) } as unknown as IDBTransaction;
  const db = { transaction: () => tx, close: () => { closed = true; } } as unknown as IDBDatabase;
  Object.defineProperty(request, 'result', { value: db });
  let opens = 0;
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: { open: () => { opens++; return request; } } });
  try {
    const data = new QuiescentLocalData(partition, () => true, registry);
    const reading = data.getSchemaVersion(partition);
    expect(registry.hasLockType('LOCAL_DB_TRANSACTION')).toBe(true);
    expect(registry.prepareActivation()).toBeNull();
    request.onsuccess!(new Event('success'));
    await tick();
    get.onsuccess!(new Event('success'));
    await tick();
    expect(registry.isQuiescent()).toBe(false);
    expect(closed).toBe(false);
    tx.oncomplete!(new Event('complete'));
    expect(await reading).toBe(2);
    expect(closed).toBe(true);
    expect(registry.isQuiescent()).toBe(true);
    const lease = registry.prepareActivation()!;
    await expect(data.getSchemaVersion(partition)).rejects.toThrow('ACTIVATION_PREPARED');
    expect(opens).toBe(1);
    registry.releaseActivation(lease.leaseId);
    await expect(data.readSnapshot({ ...context, tenantId: 'foreign' }, 'x', 'y')).rejects.toThrow();
    expect(registry.isQuiescent()).toBe(true);
    expect(opens).toBe(1);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'indexedDB', previous);
    else Reflect.deleteProperty(globalThis, 'indexedDB');
  }
});

test('failed database opening releases actual host operation lock', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  const registry = new QuiescenceRegistry();
  const request = { error: new Error('blocked driver') } as unknown as IDBOpenDBRequest;
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: { open: () => request } });
  try {
    const data = new QuiescentLocalData(partition, () => true, registry);
    const reading = data.getCursor(context);
    expect(registry.isQuiescent()).toBe(false);
    request.onerror!(new Event('error'));
    await expect(reading).rejects.toThrow('blocked driver');
    expect(registry.isQuiescent()).toBe(true);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'indexedDB', previous);
    else Reflect.deleteProperty(globalThis, 'indexedDB');
  }
});
