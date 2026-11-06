import { expect, test } from 'bun:test';
import { QuiescenceRegistry, installModuleQuiescenceBridge } from '@consubov/module-release';
import { createWindowActivationBarrier } from './activationBarrier';
import { createModuleQuiescenceHost } from './moduleQuiescenceHost';

const tick = () => new Promise(resolve => setTimeout(resolve, 10));
const nonce = () => crypto.randomUUID();

test('real private module bridge requires proof, proxies critical work, verifies fresh lease and releases', async () => {
  const channel = new MessageChannel();
  const root = new QuiescenceRegistry();
  const module = new QuiescenceRegistry();
  const options = { moduleId: 'capataz' as const, nonce: nonce() };
  const host = createModuleQuiescenceHost(channel.port1, { ...options, registry: root, isCurrent: () => true });
  expect(host.isVerifiedQuiet()).toBe(false);
  const dispose = installModuleQuiescenceBridge(channel.port2, { ...options, registry: module });
  try {
    await tick();
    const busy = module.acquireLock('private field identity', 'FORM_DIRTY', { secret: 'never shared' });
    await tick();
    expect(host.isVerifiedQuiet()).toBe(false);
    expect(root.getActiveLocks().map(lock => lock.type)).toEqual(['FORM_DIRTY']);
    expect(JSON.stringify(root.getActiveLocks())).not.toContain('secret');
    expect(await host.prepare()).toBeNull();
    busy();
    await tick();
    const lease = await host.prepare();
    expect(lease).not.toBeNull();
    expect(await lease!.verify()).toBe(true);
    expect(() => module.acquireLock('new', 'FORM_DIRTY')).toThrow('ACTIVATION_PREPARED');
    lease!.release();
    await tick();
    expect(module.isFrozen()).toBe(false);
  } finally { host.dispose(); dispose(); channel.port1.close(); channel.port2.close(); }
});

test('foreign nonce, incoherent status, expired lease and disposal fail closed', async () => {
  const channel = new MessageChannel();
  const registry = new QuiescenceRegistry();
  const identity = { protocolVersion: 1, moduleId: 'gerente' as const, nonce: nonce() };
  const counts = { FORM_DIRTY: 0, CAMERA_ACTIVE: 0, WEIGHING_ACTIVE: 0, OUTBOX_SYNCING: 0, QR_SCANNING: 0, LOCAL_DB_TRANSACTION: 0 };
  const host = createModuleQuiescenceHost(channel.port1, { ...identity, registry, isCurrent: () => true, timeoutMs: 30 });
  const status = { ...identity, kind: 'module:quiescence', counts, quiescent: true, frozen: false };
  channel.port2.postMessage({ ...status, nonce: nonce() });
  await tick();
  expect(host.isVerifiedQuiet()).toBe(false);
  channel.port2.postMessage(status);
  await tick();
  channel.port2.onmessage = event => {
    channel.port2.postMessage({ ...identity, kind: 'module:activation-prepared', requestId: event.data.requestId, prepared: true, leaseId: nonce(), expiresAt: Date.now() - 1 });
  };
  expect(await host.prepare()).toBeNull();
  channel.port2.postMessage({ ...status, counts: { ...counts, FORM_DIRTY: 1 } });
  await tick();
  expect(host.isVerifiedQuiet()).toBe(false);
  host.dispose();
  expect(registry.isQuiescent()).toBe(true);
  channel.port1.close(); channel.port2.close();
});

test('prepare timeout and dispose settle pending promises; changed context cannot verify', async () => {
  const channel = new MessageChannel();
  const registry = new QuiescenceRegistry();
  let current = true;
  const identity = { moduleId: 'capataz' as const, nonce: nonce() };
  const host = createModuleQuiescenceHost(channel.port1, { ...identity, registry, isCurrent: () => current, timeoutMs: 15 });
  const dispose = installModuleQuiescenceBridge(channel.port2, { ...identity, registry: new QuiescenceRegistry() });
  await tick();
  const lease = await host.prepare();
  current = false;
  expect(await lease!.verify()).toBe(false);
  current = true;
  dispose();
  expect(await host.prepare()).toBeNull();
  const pending = host.prepare();
  host.dispose();
  expect(await pending).toBeNull();
  channel.port1.close(); channel.port2.close();
});

test('root work arriving during module prepare prevents freeze without interrupting it', async () => {
  const registry = new QuiescenceRegistry();
  const barrier = createWindowActivationBarrier({ registry });
  let resolve!: (lease: { expiresAt: number; verify(): Promise<boolean>; release(): void }) => void;
  let released = false;
  barrier.registerModuleActivationParticipant({ isVerifiedQuiet: () => true, prepare: () => new Promise(done => { resolve = done; }) });
  const pending = barrier.prepareWindowActivation();
  const busy = registry.acquireLock('actual operation', 'LOCAL_DB_TRANSACTION');
  resolve({ expiresAt: Date.now() + 1000, verify: async () => true, release: () => { released = true; } });
  expect(await pending).toBeNull();
  expect(released).toBe(true);
  expect(registry.hasLockType('LOCAL_DB_TRANSACTION')).toBe(true);
  busy();
});

test('changing module during preparation or verification releases both leases', async () => {
  const registry = new QuiescenceRegistry();
  const barrier = createWindowActivationBarrier({ registry });
  let finish!: (valid: boolean) => void;
  let released = false;
  const unregister = barrier.registerModuleActivationParticipant({
    isVerifiedQuiet: () => true,
    prepare: async () => ({ expiresAt: Date.now() + 1000, verify: () => new Promise(resolve => { finish = resolve; }), release: () => { released = true; } })
  });
  const lease = await barrier.prepareWindowActivation();
  const verifying = lease!.verify();
  unregister();
  finish(true);
  expect(await verifying).toBe(false);
  expect(released).toBe(true);
  expect(registry.isFrozen()).toBe(false);
});

test('quiet root freezes new input and operations only for lease lifetime', async () => {
  const registry = new QuiescenceRegistry();
  const target = new EventTarget();
  const barrier = createWindowActivationBarrier({ registry, document: target as Document, ttlMs: 30 });
  const lease = await barrier.prepareWindowActivation();
  expect(await lease!.verify()).toBe(true);
  const input = new Event('beforeinput', { cancelable: true });
  target.dispatchEvent(input);
  expect(input.defaultPrevented).toBe(true);
  expect(() => registry.acquireLock('op', 'LOCAL_DB_TRANSACTION')).toThrow();
  await new Promise(resolve => setTimeout(resolve, 40));
  expect(registry.isFrozen()).toBe(false);
  expect(await lease!.verify()).toBe(false);
  const resumed = new Event('click', { cancelable: true });
  target.dispatchEvent(resumed);
  expect(resumed.defaultPrevented).toBe(false);
});

test('late module critical status while root is frozen invalidates safely', async () => {
  const channel = new MessageChannel();
  const registry = new QuiescenceRegistry();
  const identity = { protocolVersion: 1, moduleId: 'fabrica' as const, nonce: nonce() };
  const host = createModuleQuiescenceHost(channel.port1, { ...identity, registry, isCurrent: () => true });
  const counts = { FORM_DIRTY: 0, CAMERA_ACTIVE: 0, WEIGHING_ACTIVE: 0, OUTBOX_SYNCING: 0, QR_SCANNING: 0, LOCAL_DB_TRANSACTION: 0 };
  const status = { ...identity, kind: 'module:quiescence', counts, quiescent: true, frozen: false };
  channel.port2.postMessage(status);
  await tick();
  const rootLease = registry.prepareActivation()!;
  channel.port2.postMessage({ ...status, quiescent: false, counts: { ...counts, CAMERA_ACTIVE: 1 } });
  await tick();
  expect(host.isVerifiedQuiet()).toBe(false);
  expect(await host.prepare()).toBeNull();
  registry.releaseActivation(rootLease.leaseId);
  host.dispose(); channel.port1.close(); channel.port2.close();
});
