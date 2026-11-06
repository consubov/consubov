import { describe, expect, it } from 'bun:test';
import type { AtomicCommandEnvelope, LocalDataAPI, ModuleExecutionContext } from '@consubov/contracts';
import { SilentSyncRunner, SyncAuthorizationError, webLocksLeader, type PartitionLeader, type SyncTransport } from './SilentSyncRunner';
import { QuiescenceRegistry } from '@consubov/module-release';

const context: ModuleExecutionContext = { userId: 'user', tenantId: 'tenant', farmId: 'farm', retreatId: null, profileId: 'capataz', moduleId: 'capataz', deviceId: 'device', productId: 'consubov' };
const leader: PartitionLeader = { async run(_key, _signal, work) { await work(async () => undefined); return true; } };
const command = { command_id: 'command', idempotency_key: 'stable', aggregate_id: 'aggregate', base_version: 0, correlation_id: 'correlation', attempts: 0, attachment_refs: [] } as unknown as AtomicCommandEnvelope;
function fixture() {
  const events: string[] = [];
  let pending = true;
  let active = true;
  const local = {
    async listPendingCommands() { return pending ? [{ command, attachmentRefs: [] }] : []; },
    async applyCommandResponse() { events.push('ack'); pending = false; },
    async getCursor() { return 'opaque'; },
    async readSnapshot() { return null; },
    async commitPull() { events.push('commit-pull'); }
  } as unknown as LocalDataAPI;
  const transport: SyncTransport = {
    async upload() { events.push('upload'); },
    async push() { events.push('push'); return { success: true, ack: { command_id: 'command', aggregate_id: 'aggregate', aggregate_version: 1, correlation_id: 'correlation', status: 'COMMITTED', committed_at: new Date().toISOString() } }; },
    async pull() { events.push('pull'); return { tenant_id: 'tenant', fazenda_id: 'farm', next_cursor: 'next', has_more: false, deltas: [], server_timestamp: new Date().toISOString() }; }
  };
  return { events, local, transport, isActive: () => active, deactivate: () => { active = false; }, pending: () => pending };
}

describe('session-scoped silent sync', () => {
  it('holds activation through network wait, stop and the final durable completion', async () => {
    const f = fixture();
    const registry = new QuiescenceRegistry();
    let finishPush!: () => void;
    let beganPush!: () => void;
    const began = new Promise<void>(resolve => { beganPush = resolve; });
    const wait = new Promise<void>(resolve => { finishPush = resolve; });
    const push = f.transport.push;
    f.transport.push = async (value, signal) => { beganPush(); await wait; return push(value, signal); };
    const runner = new SilentSyncRunner({ ...f, context, leader,
      acquireFlight: () => registry.isFrozen() ? null : registry.acquireLock('flight', 'OUTBOX_SYNCING') });
    const flight = runner.trigger();
    await began;
    expect(registry.hasLockType('OUTBOX_SYNCING')).toBe(true);
    expect(registry.prepareActivation()).toBeNull();
    runner.stop();
    expect(registry.isQuiescent()).toBe(false);
    finishPush();
    await flight;
    expect(registry.isQuiescent()).toBe(true);
    expect(f.events).toEqual(['push']);
  });

  it('defers all work while frozen and releases its flight after durable completion or failure', async () => {
    for (const fail of [false, true]) {
      const f = fixture();
      const registry = new QuiescenceRegistry();
      const lease = registry.prepareActivation()!;
      let finish!: () => void;
      let begin!: () => void;
      const began = new Promise<void>(resolve => { begin = resolve; });
      const wait = new Promise<void>(resolve => { finish = resolve; });
      f.local.commitPull = async () => { begin(); await wait; if (fail) throw new Error('durable failure'); };
      const runner = new SilentSyncRunner({ ...f, context, leader,
        acquireFlight: () => registry.isFrozen() ? null : registry.acquireLock('flight', 'OUTBOX_SYNCING') });
      await runner.trigger();
      expect(f.events).toEqual([]);
      expect(registry.validateActivationLease(lease.leaseId)).toBe(true);
      registry.releaseActivation(lease.leaseId);
      const flight = runner.trigger();
      await began;
      expect(registry.hasLockType('OUTBOX_SYNCING')).toBe(true);
      expect(registry.prepareActivation()).toBeNull();
      finish();
      await flight;
      expect(registry.isQuiescent()).toBe(true);
    }
  });

  it('coalesces concurrent triggers into one push/ACK/pull sequence', async () => {
    const f = fixture();
    const runner = new SilentSyncRunner({ ...f, context, leader });
    await Promise.all([runner.trigger(), runner.trigger(), runner.trigger()]);
    expect(f.events).toEqual(['push', 'ack', 'pull', 'commit-pull']);
  });

  it('retries the identical durable command after response loss with exponential jitter deadline', async () => {
    const f = fixture(); let now = 0; const sent: string[] = [];
    const push = f.transport.push;
    f.transport.push = async (value, signal) => { sent.push(JSON.stringify(value)); if (sent.length < 3) throw new TypeError('response lost'); return push(value, signal); };
    const runner = new SilentSyncRunner({ ...f, context, leader, now: () => now, random: () => 0 });
    await runner.trigger(); await runner.trigger();
    expect(sent).toHaveLength(1);
    now = 499; await runner.trigger(); expect(sent).toHaveLength(1);
    now = 500; await runner.trigger(); expect(sent).toHaveLength(2);
    now = 1499; await runner.trigger(); expect(sent).toHaveLength(2);
    now = 1500; await runner.trigger();
    expect(sent).toEqual([JSON.stringify(command), JSON.stringify(command), JSON.stringify(command)]);
    expect(f.pending()).toBe(false);
  });

  it('does not acknowledge a response after account/context generation ended', async () => {
    const f = fixture(); const push = f.transport.push;
    f.transport.push = async (value, signal) => { const response = await push(value, signal); f.deactivate(); return response; };
    const runner = new SilentSyncRunner({ ...f, context, leader });
    await runner.trigger();
    expect(f.events).toEqual(['push']); expect(f.pending()).toBe(true);
  });

  it('permanently pauses that session on 401/403 and retains durable command', async () => {
    const f = fixture(); let calls = 0; let suspensions = 0;
    f.transport.push = async () => { calls++; throw new SyncAuthorizationError('403'); };
    const runner = new SilentSyncRunner({ ...f, context, leader, onAuthorizationRequired: () => { suspensions++; } });
    await runner.trigger(); await runner.trigger();
    expect(calls).toBe(1); expect(f.pending()).toBe(true);
    expect(suspensions).toBe(1);
  });

  it('does not suspend authorization for unknown network failures or notify a session already ended', async () => {
    for (const ended of [false, true]) {
      const f = fixture(); let suspensions = 0;
      f.transport.push = async () => { if (ended) { f.deactivate(); throw new SyncAuthorizationError('old session'); } throw new TypeError('network unavailable'); };
      await new SilentSyncRunner({ ...f, context, leader, onAuthorizationRequired: () => { suspensions++; } }).trigger();
      expect(suspensions).toBe(0);
      expect(f.pending()).toBe(true);
    }
  });

  it('suspends after an identified security issue is persisted and remains paused if callback fails', async () => {
    const f = fixture(); let suspensions = 0;
    f.transport.push = async () => ({ success: false, security: { error: 'FORBIDDEN_403', command_id: 'command', reason: 'Revoked' } });
    f.local.applyCommandResponse = async () => { f.events.push('persisted-issue'); };
    const runner = new SilentSyncRunner({ ...f, context, leader, onCommitted: () => f.events.push('notify'), onAuthorizationRequired: () => { suspensions++; f.events.push('suspend'); throw new Error('notification failure'); } });
    await runner.trigger(); await runner.trigger();
    expect(f.events).toEqual(['persisted-issue', 'notify', 'suspend']);
    expect(suspensions).toBe(1);
    expect(f.pending()).toBe(true);
  });

  it('cannot keep a known rejected session active when issue storage or data notification fails', async () => {
    for (const persistFails of [false, true]) {
      const f = fixture(); let suspensions = 0;
      f.transport.push = async () => ({ success: false, security: { error: 'FORBIDDEN_403', command_id: 'command', reason: 'Revoked' } });
      f.local.applyCommandResponse = async () => { if (persistFails) throw new DOMException('quota', 'QuotaExceededError'); f.events.push('persisted'); };
      const runner = new SilentSyncRunner({ ...f, context, leader, onCommitted: () => { throw new Error('view notification failed'); }, onAuthorizationRequired: () => { suspensions++; } });
      await runner.trigger(); await runner.trigger();
      expect(suspensions).toBe(1);
      expect(f.pending()).toBe(true);
      expect(f.events).toEqual(persistFails ? [] : ['persisted']);
    }
  });

  it('halts dependent commands and pull on conflict', async () => {
    const f = fixture();
    f.transport.push = async () => ({ success: false, conflict: { error: 'CONFLICT_409', command_id: 'command', aggregate_id: 'aggregate', base_version: 0, current_version: 2, conflict_reason: 'changed', resolution_strategy: 'MANUAL_RESOLUTION_REQUIRED' } });
    f.local.applyCommandResponse = async () => { f.events.push('conflict'); };
    await new SilentSyncRunner({ ...f, context, leader }).trigger();
    expect(f.events).toEqual(['conflict']); expect(f.pending()).toBe(true);
  });

  it('notifies only after a conflict, validation or identified security rejection is durably recorded', async () => {
    const failures = [
      { success: false as const, conflict: { error: 'CONFLICT_409' as const, command_id: 'command', aggregate_id: 'aggregate', base_version: 0, current_version: 2, conflict_reason: 'changed', resolution_strategy: 'MANUAL_RESOLUTION_REQUIRED' as const } },
      { success: false as const, validation: { error: 'UNPROCESSABLE_ENTITY_422' as const, command_id: 'command', violations: [] } },
      { success: false as const, security: { error: 'FORBIDDEN_403' as const, command_id: 'command', reason: 'Grant revoked' } }
    ];
    for (const response of failures) {
      const f = fixture();
      f.transport.push = async () => response;
      f.local.applyCommandResponse = async () => { await Promise.resolve(); f.events.push('persisted-issue'); };
      const runner = new SilentSyncRunner({ ...f, context, leader, onCommitted: () => f.events.push('notify') });
      await runner.trigger();
      expect(f.events).toEqual(['persisted-issue', 'notify']);
      expect(f.pending()).toBe(true);
      if ('security' in response) { await runner.trigger(); expect(f.events).toEqual(['persisted-issue', 'notify']); }
    }
  });

  it('does not notify an issue when persistence fails or the context ends before commit notification', async () => {
    const response = { success: false as const, validation: { error: 'UNPROCESSABLE_ENTITY_422' as const, command_id: 'command', violations: [] } };
    for (const ended of [false, true]) {
      const f = fixture();
      f.transport.push = async () => response;
      f.local.applyCommandResponse = async () => { if (ended) f.deactivate(); else throw new DOMException('quota', 'QuotaExceededError'); };
      await new SilentSyncRunner({ ...f, context, leader, onCommitted: () => f.events.push('notify') }).trigger();
      expect(f.events).toEqual([]);
      expect(f.pending()).toBe(true);
    }
  });

  it('checks leadership after network wait before writing a local ACK', async () => {
    const f = fixture(); let lost = false; const push = f.transport.push;
    const fencing: PartitionLeader = { async run(_key, _signal, work) { await work(async () => { if (lost) throw new Error('fence lost'); }); return true; } };
    f.transport.push = async (value, signal) => { const response = await push(value, signal); lost = true; return response; };
    await new SilentSyncRunner({ ...f, context, leader: fencing }).trigger();
    expect(f.events).toEqual(['push']); expect(f.pending()).toBe(true);
  });

  it('never falls back to an in-memory cross-tab leader if Web Locks are absent', async () => {
    let ran = false;
    expect(await webLocksLeader(undefined).run('partition', new AbortController().signal, async () => { ran = true; })).toBe(false);
    expect(ran).toBe(false);
  });

  it('uploads durable dependencies before command dispatch and notifies only after pull commit', async () => {
    const f = fixture(); let pending = true;
    const blob = new Blob(['photo'], { type: 'image/jpeg' });
    const ref = { attachment_id: 'photo', mime_type: blob.type, size_bytes: blob.size, hash_sha256: 'a'.repeat(64), local_blob_ref: 'photo-local' };
    f.local.listPendingCommands = async () => pending ? [{ command, attachmentRefs: [ref] }] : [];
    f.local.readAttachment = async () => ({ ref, blob });
    f.local.applyCommandResponse = async () => { f.events.push('ack'); pending = false; };
    f.transport.pull = async () => { f.events.push('pull'); return { tenant_id: 'tenant', fazenda_id: 'farm', next_cursor: 'next', has_more: false, deltas: [{ delta_id: 'projection', aggregate_type: 'module-state', aggregate_id: 'bootstrap', version: 1, operation: 'UPSERT', data: {}, modified_at: new Date().toISOString() }], server_timestamp: new Date().toISOString() }; };
    await new SilentSyncRunner({ ...f, context, leader, onCommitted: () => f.events.push('notify') }).trigger();
    expect(f.events).toEqual(['upload', 'push', 'ack', 'pull', 'commit-pull', 'notify']);
  });

  it('stops periodic and recovery triggers and removes listeners after cleanup', async () => {
    const f = fixture();
    const target = new EventTarget();
    const documentTarget = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    const runner = new SilentSyncRunner({ ...f, context, leader, intervalMs: 5 });
    runner.start(target as Window, documentTarget as unknown as Document);
    await new Promise(resolve => setTimeout(resolve, 25));
    runner.stop();
    const count = f.events.length;
    target.dispatchEvent(new Event('online'));
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    await new Promise(resolve => setTimeout(resolve, 15));
    expect(f.events.length).toBe(count);
    expect(count).toBeGreaterThanOrEqual(4);
  });
});
