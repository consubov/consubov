import { CRITICAL_OPERATION_TYPES, moduleQuiescenceMessageSchema, type FazendaModuleId, type ModuleQuiescenceMessage } from '@consubov/contracts';
import { globalQuiescenceRegistry, type QuiescenceRegistry } from '@consubov/module-release';
import type { ActivationLease } from './activationBarrier';

export function createModuleQuiescenceHost(port: MessagePort, options: { moduleId: FazendaModuleId; nonce: string; isCurrent: () => boolean; registry?: QuiescenceRegistry; timeoutMs?: number }) {
  const registry = options.registry ?? globalQuiescenceRegistry;
  const identity = { protocolVersion: 1, moduleId: options.moduleId, nonce: options.nonce } as const;
  const proxy = new Map<string, () => void>();
  const pending = new Map<string, { finish(message: ModuleQuiescenceMessage | null): void }>();
  let disposed = false;
  let quiet = false;
  let invalid = false;
  let owned: ActivationLease | null = null;
  let preparing = false;
  const current = () => !disposed && !invalid && options.isCurrent();
  const send = (message: object) => { try { port.postMessage({ ...identity, ...message }); return true; } catch { return false; } };
  const request = (kind: 'shell:prepare-activation' | 'shell:verify-activation', leaseId?: string) => new Promise<ModuleQuiescenceMessage | null>(resolve => {
    if (!current()) { resolve(null); return; }
    const requestId = crypto.randomUUID();
    const finish = (message: ModuleQuiescenceMessage | null) => { clearTimeout(timer); pending.delete(requestId); resolve(message); };
    const timer = setTimeout(() => finish(null), options.timeoutMs ?? 1500);
    pending.set(requestId, { finish });
    if (!send({ kind, requestId, ...(leaseId ? { leaseId } : {}) })) finish(null);
  });
  const onMessage = (event: MessageEvent) => {
    const parsed = moduleQuiescenceMessageSchema.safeParse(event.data);
    if (!parsed.success || parsed.data.moduleId !== options.moduleId || parsed.data.nonce !== options.nonce || !current()) return;
    const message = parsed.data;
    if (message.kind !== 'module:quiescence') {
      const waiter = pending.get(message.requestId);
      if (waiter) waiter.finish(message);
      // A delayed response may arrive after the bounded request timed out.
      else if (message.kind === 'module:activation-prepared' && message.leaseId) send({ kind: 'shell:release-activation', leaseId: message.leaseId });
      return;
    }
    const isQuiet = CRITICAL_OPERATION_TYPES.every(type => message.counts[type] === 0);
    if (message.quiescent !== isQuiet || (message.frozen && !isQuiet)) { invalid = true; quiet = false; owned?.release(); return; }
    quiet = isQuiet;
    for (const type of CRITICAL_OPERATION_TYPES) {
      if (message.counts[type] > 0 && !proxy.has(type)) {
        try { proxy.set(type, registry.acquireLock(crypto.randomUUID(), type)); }
        catch { invalid = true; quiet = false; owned?.release(); }
      } else if (message.counts[type] === 0) { proxy.get(type)?.(); proxy.delete(type); }
    }
    if (!isQuiet) owned?.release();
  };
  const dispose = () => {
    if (disposed) return;
    owned?.release();
    disposed = true;
    quiet = false;
    port.removeEventListener('message', onMessage);
    port.removeEventListener('messageerror', dispose);
    for (const item of pending.values()) item.finish(null);
    for (const release of proxy.values()) release();
    proxy.clear();
  };
  port.addEventListener('message', onMessage);
  port.addEventListener('messageerror', dispose);
  port.start();
  return {
    isVerifiedQuiet: () => current() && quiet,
    async prepare(): Promise<ActivationLease | null> {
      if (!current() || !quiet || preparing || owned) return null;
      preparing = true;
      const response = await request('shell:prepare-activation');
      preparing = false;
      if (!response || response.kind !== 'module:activation-prepared' || !response.prepared || !response.leaseId || !response.expiresAt) return null;
      const leaseId = response.leaseId;
      if (!current() || !quiet || response.expiresAt <= Date.now() || response.expiresAt > Date.now() + 30000) { send({ kind: 'shell:release-activation', leaseId }); return null; }
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        clearTimeout(timer);
        send({ kind: 'shell:release-activation', leaseId });
        if (owned === lease) owned = null;
      };
      const lease: ActivationLease = {
        expiresAt: response.expiresAt,
        release,
        async verify() {
          if (released || !current() || !quiet || Date.now() >= lease.expiresAt) { release(); return false; }
          const result = await request('shell:verify-activation', leaseId);
          const valid = !released && current() && quiet && Date.now() < lease.expiresAt && result?.kind === 'module:activation-verified' && result.leaseId === leaseId && result.valid;
          if (!valid) release();
          return valid;
        }
      };
      const timer = setTimeout(release, lease.expiresAt - Date.now());
      owned = lease;
      return lease;
    },
    dispose
  };
}
