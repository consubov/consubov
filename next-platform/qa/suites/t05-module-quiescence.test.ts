import { describe, expect, test } from 'bun:test';
import { QuiescenceRegistry } from '../../packages/module-release/src/quiescence/registry';
import { installModuleQuiescenceBridge } from '../../packages/module-release/src/quiescence/module-bridge';
import { moduleQuiescenceMessageSchema } from '../../packages/contracts/src/runtime/quiescence';

const tick = () => new Promise(resolve => setTimeout(resolve, 10));
describe('T05 module private-port activation barrier', () => {
  test('busy preparation does not freeze or interrupt existing work; quiet lease blocks writes synchronously', () => {
    const registry = new QuiescenceRegistry();
    const release = registry.acquireLock('private-form-id', 'FORM_DIRTY', { value: 'never transmitted' });
    expect(registry.prepareActivation()).toBeNull();
    expect(registry.isFrozen()).toBe(false);
    release();
    const lease = registry.prepareActivation()!;
    expect(registry.validateActivationLease(lease.leaseId)).toBe(true);
    expect(() => registry.acquireLock('commit', 'LOCAL_DB_TRANSACTION')).toThrow('ACTIVATION_PREPARED');
    registry.releaseActivation(crypto.randomUUID());
    expect(registry.isFrozen()).toBe(true);
    registry.releaseActivation(lease.leaseId);
    expect(registry.validateActivationLease(lease.leaseId)).toBe(false);
    registry.acquireLock('commit', 'LOCAL_DB_TRANSACTION')();
  });

  test('expired leases invalidate at the boundary and auto-release the input barrier', async () => {
    const registry = new QuiescenceRegistry();
    const lease = registry.prepareActivation(5)!;
    await tick();
    expect(registry.validateActivationLease(lease.leaseId)).toBe(false);
    expect(registry.isFrozen()).toBe(false);
  });

  test('private MessageChannel sends counts only, rejects foreign/malformed control and supports prepare/verify/release/dispose', async () => {
    const registry = new QuiescenceRegistry();
    const channel = new MessageChannel();
    const nonce = crypto.randomUUID();
    const received: unknown[] = [];
    channel.port1.onmessage = event => received.push(event.data);
    const dispose = installModuleQuiescenceBridge(channel.port2, { moduleId: 'capataz', nonce, registry });
    const identity = { protocolVersion: 1, moduleId: 'capataz', nonce };
    const send = (data: object) => channel.port1.postMessage({ ...identity, ...data });
    await tick();
    expect(received).toHaveLength(1);
    const release = registry.acquireLock('sensitive-lock-id', 'FORM_DIRTY', { secret: 'sensitive-field' });
    send({ kind: 'shell:prepare-activation', requestId: crypto.randomUUID() });
    await tick();
    expect(received.at(-1)).toMatchObject({ prepared: false, leaseId: null, expiresAt: null });
    expect(JSON.stringify(received)).not.toContain('sensitive');
    release();
    for (const invalid of [{ nonce: crypto.randomUUID() }, { moduleId: 'gerente' }, { protocolVersion: 2 }, { fieldValues: 'forbidden' }]) {
      send({ kind: 'shell:prepare-activation', requestId: crypto.randomUUID(), ...invalid });
    }
    await tick();
    expect(registry.isFrozen()).toBe(false);
    send({ kind: 'shell:prepare-activation', requestId: crypto.randomUUID() });
    await tick();
    const prepared = received.at(-1) as { leaseId: string };
    expect(registry.validateActivationLease(prepared.leaseId)).toBe(true);
    send({ kind: 'shell:verify-activation', requestId: crypto.randomUUID(), leaseId: prepared.leaseId });
    await tick();
    expect(received.at(-1)).toMatchObject({ kind: 'module:activation-verified', valid: true });
    send({ kind: 'shell:release-activation', leaseId: prepared.leaseId });
    await tick();
    expect(registry.isFrozen()).toBe(false);
    send({ kind: 'shell:prepare-activation', requestId: crypto.randomUUID() });
    await tick();
    expect(registry.isFrozen()).toBe(true);
    expect(received.every(message => moduleQuiescenceMessageSchema.safeParse(message).success)).toBe(true);
    dispose();
    expect(registry.isFrozen()).toBe(false);
    channel.port1.close();
    channel.port2.close();
  });
});
