import { globalQuiescenceRegistry, type QuiescenceRegistry } from '@consubov/module-release';

export interface ActivationLease { expiresAt: number; verify(): Promise<boolean>; release(): void }
export interface ModuleActivationParticipant { isVerifiedQuiet(): boolean; prepare(): Promise<ActivationLease | null> }

/** This barrier covers this window. The worker independently rejects additional clients. */
export function createWindowActivationBarrier(options: { registry?: QuiescenceRegistry; document?: Document; ttlMs?: number } = {}) {
  const registry = options.registry ?? globalQuiescenceRegistry;
  const target = options.document ?? (typeof document === 'undefined' ? undefined : document);
  let participant: ModuleActivationParticipant | null = null;
  let generation = 0;
  let active: ActivationLease | null = null;
  const register = (next: ModuleActivationParticipant) => {
    active?.release();
    participant = next;
    const revision = ++generation;
    return () => {
      if (generation !== revision) return;
      active?.release();
      participant = null;
      generation++;
    };
  };
  const prepare = async (): Promise<ActivationLease | null> => {
    if (!registry.isQuiescent() || registry.isFrozen()) return null;
    const current = participant;
    const revision = generation;
    if (current && !current.isVerifiedQuiet()) return null;
    let moduleLease: ActivationLease | null = null;
    try { moduleLease = current ? await current.prepare() : null; } catch { return null; }
    if ((current && (!moduleLease || !current.isVerifiedQuiet())) || participant !== current || generation !== revision || !registry.isQuiescent() || registry.isFrozen()) {
      moduleLease?.release();
      return null;
    }
    const ttl = Math.min(options.ttlMs ?? 30000, moduleLease ? moduleLease.expiresAt - Date.now() : 30000);
    if (ttl <= 0) { moduleLease?.release(); return null; }
    const rootLease = registry.prepareActivation(ttl);
    if (!rootLease) { moduleLease?.release(); return null; }
    let released = false;
    const events = ['beforeinput', 'input', 'change', 'submit', 'click', 'keydown', 'pointerdown', 'drop', 'paste'];
    const guard = (event: Event) => { if (!released && registry.validateActivationLease(rootLease.leaseId)) { event.preventDefault(); event.stopImmediatePropagation(); } };
    events.forEach(type => target?.addEventListener(type, guard, true));
    const release = () => {
      if (released) return;
      released = true;
      clearTimeout(timer);
      events.forEach(type => target?.removeEventListener(type, guard, true));
      registry.releaseActivation(rootLease.leaseId);
      moduleLease?.release();
      if (active === lease) active = null;
      target?.defaultView?.dispatchEvent(new Event('focus'));
    };
    const lease: ActivationLease = {
      expiresAt: rootLease.expiresAt,
      release,
      async verify() {
        const rootValid = () => !released && participant === current && generation === revision && registry.validateActivationLease(rootLease.leaseId);
        let valid = rootValid();
        if (valid && moduleLease) { try { valid = await moduleLease.verify(); } catch { valid = false; } }
        valid = valid && rootValid();
        if (!valid) release();
        return valid;
      }
    };
    const timer = setTimeout(release, Math.max(0, lease.expiresAt - Date.now()));
    active = lease;
    return lease;
  };
  return { registerModuleActivationParticipant: register, prepareWindowActivation: prepare };
}

const barrier = createWindowActivationBarrier();
export const registerModuleActivationParticipant = barrier.registerModuleActivationParticipant;
export const prepareWindowActivation = barrier.prepareWindowActivation;
