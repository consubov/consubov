import { QuiescenceRegistry, QuiescenceLockInfo, globalQuiescenceRegistry } from '@consubov/module-release';
import { createWindowActivationBarrier, prepareWindowActivation, type ActivationLease } from './activationBarrier';

export interface UpdateCoordinatorOptions {
  checkIntervalMs?: number;
  quiescenceRegistry?: QuiescenceRegistry;
  onUpdateAvailable?: (version?: string) => void;
  onUpdateCurrent?: () => void;
  onUpdateActivated?: (version?: string) => void;
  onWaitingForQuiescence?: (activeLocks: ReadonlyArray<QuiescenceLockInfo>) => void;
  autoReloadOnQuiescent?: boolean;
  prepareWindowActivation?: () => Promise<ActivationLease | null>;
}

interface WorkerVerification {
  type: 'WAITING_WORKER_VERIFIED'; version: string; scriptURL: string;
  pending: boolean; compatible: boolean; canActivate: boolean;
}

export class UpdateCoordinator {
  private registration: ServiceWorkerRegistration | null = null;
  private pendingVersion: string | null = null;
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private readonly registry: QuiescenceRegistry;
  private readonly prepare: () => Promise<ActivationLease | null>;
  private activating = false;
  private lease: ActivationLease | null = null;
  private controllerChangeHandler: (() => void) | null = null;
  private readonly cancellations = new Set<() => void>();

  constructor(private readonly options: UpdateCoordinatorOptions = {}) {
    this.registry = options.quiescenceRegistry ?? globalQuiescenceRegistry;
    this.prepare = options.prepareWindowActivation ?? (this.registry === globalQuiescenceRegistry
      ? prepareWindowActivation : createWindowActivationBarrier({ registry: this.registry }).prepareWindowActivation);
  }

  public initialize(registration: ServiceWorkerRegistration): void {
    this.destroy();
    this.registration = registration;
    void this.discover();
    registration.onupdatefound = () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.onstatechange = () => {
        if (installing.state === 'installed' || installing.state === 'activated') void this.handleWaitingWorker(installing);
      };
    };
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      // Lifecycle events discover candidates, but never authorize reloading.
      this.controllerChangeHandler = () => { if (!this.activating) void this.discover(); };
      navigator.serviceWorker.addEventListener('controllerchange', this.controllerChangeHandler);
    }
    const interval = this.options.checkIntervalMs ?? 15 * 60 * 1000;
    if (interval > 0) this.pollIntervalId = setInterval(() => { void this.checkForUpdates(); }, interval);
  }

  private current(registration: ServiceWorkerRegistration, worker: ServiceWorker): boolean {
    return this.registration === registration && worker.state !== 'redundant' &&
      (registration.waiting === worker || registration.active === worker);
  }

  private request(worker: ServiceWorker, message: object, timeoutMs = 5000): Promise<any> {
    return new Promise(resolve => {
      const channel = new MessageChannel();
      const finish = (value: unknown = null) => {
        clearTimeout(timer); this.cancellations.delete(cancel);
        channel.port1.close(); channel.port2.close(); resolve(value);
      };
      const cancel = () => finish();
      const timer = setTimeout(cancel, Math.max(0, timeoutMs));
      this.cancellations.add(cancel);
      channel.port1.onmessage = event => finish(event.data);
      try { worker.postMessage(message, [channel.port2]); } catch { finish(); }
    });
  }

  private async verify(worker: ServiceWorker): Promise<WorkerVerification | null> {
    const value = await this.request(worker, { type: 'VERIFY_WAITING_WORKER' });
    return value?.type === 'WAITING_WORKER_VERIFIED' && typeof value.version === 'string' && value.version.length > 0 &&
      typeof value.scriptURL === 'string' && this.isVerifiedWorkerUrl(value.scriptURL, worker.scriptURL) &&
      typeof value.pending === 'boolean' && typeof value.compatible === 'boolean' && typeof value.canActivate === 'boolean' ? value : null;
  }

  private async discover(): Promise<void> {
    const registration = this.registration;
    if (!registration) return;
    const worker = registration.waiting ?? registration.active;
    if (worker) await this.handleWaitingWorker(worker);
  }

  public async handleWaitingWorker(worker: ServiceWorker): Promise<void> {
    const registration = this.registration;
    if (!registration) return;
    const verified = await this.verify(worker);
    if (!verified || !this.current(registration, worker)) return;
    if (!verified.pending) { this.pendingVersion = null; this.options.onUpdateCurrent?.(); return; }
    if (this.pendingVersion !== verified.version) {
      this.pendingVersion = verified.version;
      this.options.onUpdateAvailable?.(verified.version);
    }
    if (!this.registry.isQuiescent()) this.options.onWaitingForQuiescence?.(this.registry.getActiveLocks());
  }

  public async checkForUpdates(): Promise<void> {
    const registration = this.registration;
    if (!registration) return;
    try { await registration.update(); } catch { /* The installed App remains available. */ }
    if (this.registration === registration) await this.discover();
  }

  private waitForActivation(worker: ServiceWorker, deadline: number): Promise<boolean> {
    if (worker.state === 'activated') return Promise.resolve(true);
    return new Promise(resolve => {
      const finish = (value = false) => {
        clearTimeout(timer); worker.removeEventListener('statechange', changed);
        this.cancellations.delete(cancel); resolve(value);
      };
      const changed = () => { if (worker.state === 'activated') finish(true); else if (worker.state === 'redundant') finish(); };
      const cancel = () => finish();
      const timer = setTimeout(cancel, Math.max(0, deadline - Date.now()));
      this.cancellations.add(cancel);
      worker.addEventListener('statechange', changed);
      changed();
    });
  }

  /** Explicit update action, including when the browser already activated a cold worker. */
  public async activateWaitingWorker(): Promise<boolean> {
    const registration = this.registration;
    const worker = registration?.waiting ?? registration?.active;
    if (!registration || !worker || this.activating || !this.registry.isQuiescent()) return false;
    this.activating = true;
    let lease: ActivationLease | null = null;
    try {
      const verified = await this.verify(worker);
      if (!verified?.pending || !verified.compatible || !verified.canActivate || !this.current(registration, worker)) return false;
      lease = await this.prepare();
      this.lease = lease;
      if (!lease || !await lease.verify() || Date.now() >= lease.expiresAt || !this.current(registration, worker)) return false;
      const ack = await this.request(worker, {
        type: 'ACTIVATE_WITH_CONSENT', version: verified.version, scriptURL: verified.scriptURL, clientDeadline: lease.expiresAt
      }, lease.expiresAt - Date.now());
      if (ack?.type !== 'SHELL_ACTIVATION_ACCEPTED' || ack.accepted !== true || ack.version !== verified.version ||
          !this.current(registration, worker) || Date.now() >= lease.expiresAt) return false;
      if (!await this.waitForActivation(worker, lease.expiresAt) || !await lease.verify() ||
          Date.now() >= lease.expiresAt || !this.current(registration, worker)) return false;
      this.pendingVersion = null;
      this.options.onUpdateActivated?.(verified.version);
      // Callbacks may change context; revalidate at the reload boundary too.
      if (!await lease.verify() || Date.now() >= lease.expiresAt || !this.current(registration, worker)) return false;
      if ((this.options.autoReloadOnQuiescent ?? true) && typeof window !== 'undefined') window.location.reload();
      return true;
    } catch { return false; }
    finally { lease?.release(); if (this.lease === lease) this.lease = null; this.activating = false; }
  }

  private isVerifiedWorkerUrl(scriptURL: string, expectedURL: string): boolean {
    try {
      const parsed = new URL(scriptURL, globalThis.location?.href);
      return parsed.origin === globalThis.location?.origin && parsed.href === new URL(expectedURL, globalThis.location.href).href;
    } catch { return false; }
  }

  public isPending(): boolean { return this.pendingVersion !== null; }
  public isHoldingForQuiescence(): boolean { return this.isPending() && !this.registry.isQuiescent(); }

  public destroy(): void {
    if (this.pollIntervalId !== null) clearInterval(this.pollIntervalId);
    this.pollIntervalId = null;
    this.cancellations.forEach(cancel => cancel());
    this.lease?.release(); this.lease = null;
    if (this.controllerChangeHandler && typeof navigator !== 'undefined' && 'serviceWorker' in navigator)
      navigator.serviceWorker.removeEventListener('controllerchange', this.controllerChangeHandler);
    this.controllerChangeHandler = null;
    if (this.registration) this.registration.onupdatefound = null;
    this.registration = null; this.pendingVersion = null;
  }
}
