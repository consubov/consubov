import { CRITICAL_OPERATION_TYPES, shellQuiescenceControlSchema, type FazendaModuleId, type CriticalWorkCounts } from '@consubov/contracts';
import { globalQuiescenceRegistry, type QuiescenceRegistry } from './registry';

/** Uses the already authenticated private module port; never transfers identifiers or field values. */
export function installModuleQuiescenceBridge(
  port: MessagePort,
  options: { moduleId: FazendaModuleId; nonce: string; registry?: QuiescenceRegistry; document?: Document }
): () => void {
  const registry = options.registry ?? globalQuiescenceRegistry;
  const targetDocument = options.document ?? (typeof document === 'undefined' ? undefined : document);
  const identity = { protocolVersion: 1, moduleId: options.moduleId, nonce: options.nonce } as const;
  let ownedLease: string | null = null;
  const status = () => {
    const counts = Object.fromEntries(CRITICAL_OPERATION_TYPES.map(type => [type, 0])) as CriticalWorkCounts;
    for (const lock of registry.getActiveLocks()) counts[lock.type]++;
    port.postMessage({ ...identity, kind: 'module:quiescence', quiescent: registry.isQuiescent(), frozen: registry.isFrozen(), counts });
  };
  const onMessage = (event: MessageEvent) => {
    const parsed = shellQuiescenceControlSchema.safeParse(event.data);
    if (!parsed.success || parsed.data.moduleId !== options.moduleId || parsed.data.nonce !== options.nonce) return;
    const message = parsed.data;
    if (message.kind === 'shell:prepare-activation') {
      const lease = registry.prepareActivation();
      if (lease) ownedLease = lease.leaseId;
      port.postMessage({ ...identity, kind: 'module:activation-prepared', requestId: message.requestId, prepared: !!lease, leaseId: lease?.leaseId ?? null, expiresAt: lease?.expiresAt ?? null });
    } else if (message.kind === 'shell:verify-activation') {
      port.postMessage({ ...identity, kind: 'module:activation-verified', requestId: message.requestId, leaseId: message.leaseId, valid: ownedLease === message.leaseId && registry.validateActivationLease(message.leaseId) });
    } else if (ownedLease === message.leaseId) {
      registry.releaseActivation(message.leaseId);
      ownedLease = null;
    }
  };
  // Capture before React/native actions: preparation cannot interrupt existing work, only prevent new work.
  const guard = (event: Event) => {
    if (!registry.isFrozen()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const guardedEvents = ['beforeinput', 'input', 'change', 'submit', 'click', 'keydown', 'pointerdown', 'drop', 'paste'] as const;
  guardedEvents.forEach(type => targetDocument?.addEventListener(type, guard, true));
  const unsubscribe = registry.subscribe(status);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    port.removeEventListener('message', onMessage);
    port.removeEventListener('messageerror', dispose);
    targetDocument?.defaultView?.removeEventListener('pagehide', dispose);
    guardedEvents.forEach(type => targetDocument?.removeEventListener(type, guard, true));
    if (ownedLease) registry.releaseActivation(ownedLease);
  };
  port.addEventListener('message', onMessage);
  port.addEventListener('messageerror', dispose);
  targetDocument?.defaultView?.addEventListener('pagehide', dispose);
  port.start();
  status();
  return dispose;
}
