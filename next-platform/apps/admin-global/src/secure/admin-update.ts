type Candidate = { generation: string; scriptURL: string; pending: boolean; canActivate: boolean; activeGeneration: string | null; reason?: string };
type Options = { canActivate(): boolean; freeze(value: boolean): void; available(value: boolean): void; blocked(reason: 'work' | 'windows' | 'unavailable'): void };

/** Own-origin ADM lifecycle. A browser controller change is discovery, never consent. */
export function createAdminUpdater(options: Options) {
  let registration: ServiceWorkerRegistration | null = null, disposed = false, activating = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let releaseActiveFreeze: (() => void) | null = null;
  const pending = new Set<() => void>();
  const request = (worker: ServiceWorker, body: object, timeout = 5000): Promise<any> => new Promise(resolve => {
    const channel = new MessageChannel(); let done = false;
    const finish = (value: unknown = null) => { if (done) return; done = true; clearTimeout(timeoutId); pending.delete(cancel); channel.port1.close(); resolve(value); };
    const cancel = () => finish(); const timeoutId = setTimeout(cancel, Math.max(1, timeout)); pending.add(cancel);
    channel.port1.onmessage = event => finish(event.data);
    try { worker.postMessage(body, [channel.port2]); } catch { finish(); }
  });
  const current = (worker: ServiceWorker) => !disposed && (registration?.waiting === worker || registration?.active === worker) && worker.state !== 'redundant';
  const verify = async (worker: ServiceWorker): Promise<Candidate | null> => {
    const value = await request(worker, { type: 'ADM_VERIFY_UPDATE' });
    if (!current(worker) || value?.type !== 'ADM_UPDATE_VERIFIED' || !/^[a-f0-9]{64}$/.test(value.generation) ||
        value.scriptURL !== worker.scriptURL || new URL(worker.scriptURL).origin !== location.origin ||
        typeof value.pending !== 'boolean' || typeof value.canActivate !== 'boolean' ||
        (value.activeGeneration !== null && !/^[a-f0-9]{64}$/.test(value.activeGeneration))) return null;
    return value;
  };
  const discover = async () => {
    if (disposed || activating) return;
    const worker = registration?.waiting ?? registration?.active;
    if (!worker) return;
    const candidate = await verify(worker);
    if (candidate) options.available(candidate.pending);
  };
  const changed = () => { void discover(); };
  const initialize = async () => {
    if (disposed || location.origin !== __ADM_ORIGIN__ || !('serviceWorker' in navigator)) return;
    try {
      const installed = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      if (disposed) return;
      registration = installed;
      installed.onupdatefound = () => { const worker = installed.installing; if (worker) worker.onstatechange = changed; };
      navigator.serviceWorker.addEventListener('controllerchange', changed);
      window.addEventListener('focus', changed);
      await discover();
      if (!disposed) timer = setInterval(() => { void installed.update().then(discover, () => undefined); }, 15 * 60000);
    } catch { /* Failure to prepare a static update does not authorize privileged access. */ }
  };
  const waitActive = (worker: ServiceWorker, deadline: number): Promise<boolean> => {
    if (worker.state === 'activated') return Promise.resolve(true);
    return new Promise(resolve => {
      const finish = (value = false) => { clearTimeout(timeout); worker.removeEventListener('statechange', inspect); pending.delete(cancel); resolve(value); };
      const inspect = () => { if (worker.state === 'activated') finish(true); else if (worker.state === 'redundant') finish(); };
      const cancel = () => finish(); const timeout = setTimeout(cancel, Math.max(0, deadline - Date.now())); pending.add(cancel);
      worker.addEventListener('statechange', inspect); inspect();
    });
  };
  const activate = async (): Promise<boolean> => {
    if (activating || disposed) return false;
    if (!options.canActivate()) { options.blocked('work'); return false; }
    const worker = registration?.waiting ?? registration?.active;
    if (!worker) return false;
    activating = true; let frozen = false;
    const events = ['beforeinput', 'input', 'change', 'submit', 'click', 'keydown', 'pointerdown', 'paste', 'drop'];
    const guard = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
    const release = () => { if (!frozen) return; frozen = false; events.forEach(type => document.removeEventListener(type, guard, true)); options.freeze(false); if (releaseActiveFreeze === release) releaseActiveFreeze = null; };
    let expiry: ReturnType<typeof setTimeout> | undefined;
    try {
      const candidate = await verify(worker);
      if (!candidate?.pending || !candidate.canActivate) { options.blocked(candidate?.reason === 'OTHER_CLIENTS_OPEN' ? 'windows' : 'unavailable'); return false; }
      if (!current(worker) || !options.canActivate()) { options.blocked('work'); return false; }
      frozen = true; options.freeze(true); events.forEach(type => document.addEventListener(type, guard, true));
      releaseActiveFreeze = release;
      const deadline = Date.now() + 30000;
      expiry = setTimeout(release, 30000);
      const ack = await request(worker, { type: 'ADM_ACTIVATE_WITH_CONSENT', generation: candidate.generation, scriptURL: candidate.scriptURL, clientDeadline: deadline }, deadline - Date.now());
      if (!frozen || disposed || Date.now() >= deadline || ack?.type !== 'ADM_ACTIVATION_ACCEPTED' || ack.accepted !== true || ack.generation !== candidate.generation || !current(worker)) return false;
      if (!await waitActive(worker, deadline) || !frozen || disposed || Date.now() >= deadline) return false;
      const active = await verify(worker);
      if (!active || active.pending || active.activeGeneration !== candidate.generation || !frozen || disposed || Date.now() >= deadline || !current(worker)) return false;
      // No await between the final held-input check and reload.
      location.reload(); return true;
    } catch { options.blocked('unavailable'); return false; }
    finally { clearTimeout(expiry); release(); activating = false; }
  };
  void initialize();
  return { activate, dispose() {
    disposed = true; clearInterval(timer); releaseActiveFreeze?.(); pending.forEach(cancel => cancel());
    if (registration) registration.onupdatefound = null;
    navigator.serviceWorker?.removeEventListener('controllerchange', changed); window.removeEventListener('focus', changed);
  } };
}
