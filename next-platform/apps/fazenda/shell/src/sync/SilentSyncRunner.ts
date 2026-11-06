import type { AtomicCommandEnvelope, AttachmentRef, CommandApiResponse, LocalDataAPI, ModuleExecutionContext, SyncPullResponse } from '@consubov/contracts';
import { browserPartitionLeader } from './IndexedDbPartitionLeader';

export class SyncAuthorizationError extends Error {}
export interface SyncTransport {
  upload(ref: AttachmentRef, blob: Blob, signal: AbortSignal): Promise<void>;
  download?(ref: AttachmentRef, signal: AbortSignal): Promise<Blob>;
  push(command: AtomicCommandEnvelope, signal: AbortSignal): Promise<CommandApiResponse>;
  pull(cursor: string | null, signal: AbortSignal): Promise<SyncPullResponse>;
}
export interface PartitionLeader {
  run(key: string, signal: AbortSignal, work: (assertLeadership: () => Promise<void>, isLeadershipCurrent?: () => boolean) => Promise<void>): Promise<boolean>;
}

/** Browsers without Web Locks retain durable work until a supported shell is used.
 * An in-memory mutex is deliberately insufficient for separate tabs/processes. */
export function webLocksLeader(locks: LockManager | undefined = globalThis.navigator?.locks): PartitionLeader {
  return {
    async run(key, signal, work) {
      if (!locks || signal.aborted) return false;
      return locks.request(key, { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (!lock || signal.aborted) return false;
        await work(async () => { if (signal.aborted) throw new DOMException('Session ended', 'AbortError'); }, () => !signal.aborted);
        return true;
      });
    }
  };
}

export interface SilentSyncOptions {
  context: ModuleExecutionContext;
  local: LocalDataAPI;
  transport: SyncTransport;
  isActive: () => boolean;
  leader?: PartitionLeader;
  now?: () => number;
  random?: () => number;
  intervalMs?: number;
  retryBaseMs?: number;
  retryMaxMs?: number;
  /** Acquire synchronously before any flight work; null defers while activation is prepared. */
  acquireFlight?: () => (() => void) | null;
  /** Fires after a durable pull or operation issue, never on an HTTP response alone. */
  onCommitted?: () => void;
  /** Shell session suspension after a known authorization rejection; once per runner. */
  onAuthorizationRequired?: () => void;
}

/** Session-scoped, shell-only coordinator. No status is exposed to module/UI code. */
export class SilentSyncRunner {
  private readonly controller = new AbortController();
  private flight: Promise<void> | null = null;
  private paused = false;
  private failures = 0;
  private retryAt = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopEvents: (() => void) | undefined;
  private readonly options: SilentSyncOptions;
  private assertLeadership: () => Promise<void> = async () => undefined;
  private isLeadershipCurrent: () => boolean = () => true;
  constructor(options: SilentSyncOptions) {
    this.options = { ...options, context: { ...options.context } };
  }

  private check(): void {
    if (this.controller.signal.aborted || !this.options.isActive() || !this.isLeadershipCurrent()) throw new DOMException('Session or sync lease ended', 'AbortError');
  }

  private async boundary(): Promise<void> {
    this.check();
    await this.assertLeadership();
    this.check();
  }

  /** Coalesces all triggers and respects retry deadlines even on repeated online events. */
  trigger(): Promise<void> {
    if (this.flight) return this.flight;
    if (this.paused || this.controller.signal.aborted || !this.options.isActive() || (this.options.now?.() ?? Date.now()) < this.retryAt) return Promise.resolve();
    const release = this.options.acquireFlight ? this.options.acquireFlight() : () => undefined;
    if (!release) { this.schedule(); return Promise.resolve(); }
    this.flight = this.run().catch(error => {
      if (error instanceof SyncAuthorizationError) {
        if (!this.paused) {
          this.paused = true;
          if (!this.controller.signal.aborted && this.options.isActive()) {
            try { this.options.onAuthorizationRequired?.(); }
            catch { /* A notification failure cannot resume this rejected session. */ }
          }
        }
      }
      else if (!this.controller.signal.aborted && this.options.isActive()) {
        this.failures++;
        const cap = Math.min(this.options.retryMaxMs ?? 60_000, (this.options.retryBaseMs ?? 1_000) * 2 ** Math.min(this.failures - 1, 20));
        this.retryAt = (this.options.now?.() ?? Date.now()) + Math.ceil(cap * (0.5 + (this.options.random?.() ?? Math.random()) * 0.5));
      }
    }).finally(() => { release(); this.flight = null; this.schedule(); });
    return this.flight;
  }

  private async run(): Promise<void> {
    const { context, local, transport } = this.options;
    const key = `consubov-sync:${JSON.stringify([context.productId, context.moduleId, context.userId, context.tenantId, context.farmId, context.retreatId])}`;
    // A previous turn released its lease. A fresh turn must acquire a fresh
    // fence rather than treating that released lease as current authority.
    this.isLeadershipCurrent = () => true;
    this.check();
    await (this.options.leader ?? browserPartitionLeader()).run(key, this.controller.signal, async (assertLeadership, isLeadershipCurrent) => {
      this.assertLeadership = assertLeadership;
      this.isLeadershipCurrent = isLeadershipCurrent ?? (() => true);
      const canCommit = () => !this.controller.signal.aborted && this.options.isActive() && this.isLeadershipCurrent();
      await this.boundary();
      const pending = await local.listPendingCommands(context, 500);
      await this.boundary();
      for (const entry of pending) {
        // Retry the exact durable envelope. Never mutate attempts/base/idempotency.
        for (const ref of entry.attachmentRefs) {
          await this.boundary();
          const attachment = await local.readAttachment(context, ref.attachment_id);
          await this.boundary();
          if (!attachment) throw new Error('Durable attachment missing');
          await transport.upload(ref, attachment.blob, this.controller.signal);
          await this.boundary();
        }
        await this.boundary();
        const response = await transport.push(entry.command, this.controller.signal);
        const responseId = response.success ? response.ack.command_id : 'conflict' in response ? response.conflict.command_id : 'validation' in response ? response.validation.command_id : response.security.command_id;
        if (responseId !== entry.command.command_id) throw new Error('Response does not identify the dispatched command');
        if (!response.success && 'security' in response) {
          try {
            await this.boundary();
            await local.applyCommandResponse(context, response, canCommit);
            await this.boundary();
            this.options.onCommitted?.();
          } finally {
            // A known rejected credential stays rejected even if retaining its
            // optional issue or notifying the active view fails.
            throw new SyncAuthorizationError('Command authorization suspended');
          }
        }
        await this.boundary();
        await local.applyCommandResponse(context, response, canCommit);
        await this.boundary();
        if (!response.success) this.options.onCommitted?.();
        // A conflict/validation failure blocks dependent commands; retain everything.
        if (!response.success) return;
      }
      // A writer may have appended work while the network was awaited.
      if ((await local.listPendingCommands(context, 1)).length) return;
      await this.boundary();
      const cursor = await local.getCursor(context);
      await this.boundary();
      const previousProjection = await local.readSnapshot(context, 'module-state', 'bootstrap');
      await this.boundary();
      const pull = await transport.pull(cursor, this.controller.signal);
      await this.boundary();
      const attachments: Array<{ ref: AttachmentRef; blob: Blob }> = [];
      for (const ref of pull.attachment_refs ?? []) {
        const existing = await local.readAttachment(context, ref.attachment_id);
        await this.boundary();
        if (existing) {
          if (Object.keys(ref).some(key => existing.ref[key as keyof AttachmentRef] !== ref[key as keyof AttachmentRef])) throw new Error('Local attachment reference differs from pull');
          continue;
        }
        if (!transport.download) throw new Error('Attachment download unavailable');
        const blob = await transport.download(ref, this.controller.signal);
        await this.boundary();
        attachments.push({ ref, blob });
      }
      await local.commitPull(context, { nextCursor: pull.next_cursor, deltas: pull.deltas, attachments }, canCommit);
      await this.boundary();
      this.failures = 0;
      this.retryAt = 0;
      if (pull.deltas.length && pull.deltas[pull.deltas.length - 1]!.version !== previousProjection?.version) this.options.onCommitted?.();
    });
  }

  private schedule(): void {
    if (!this.stopEvents || this.controller.signal.aborted || this.paused) return;
    if (this.timer !== undefined) clearTimeout(this.timer);
    const now = this.options.now?.() ?? Date.now();
    const delay = this.retryAt > now ? this.retryAt - now : this.options.intervalMs ?? 30_000;
    this.timer = setTimeout(() => { void this.trigger(); }, delay);
  }

  start(target: Window = window, documentTarget: Document = document): void {
    if (this.stopEvents || this.controller.signal.aborted) return;
    const recover = () => { void this.trigger(); };
    const foreground = () => { if (documentTarget.visibilityState === 'visible') recover(); };
    target.addEventListener('online', recover);
    target.addEventListener('focus', recover);
    documentTarget.addEventListener('visibilitychange', foreground);
    this.stopEvents = () => {
      target.removeEventListener('online', recover);
      target.removeEventListener('focus', recover);
      documentTarget.removeEventListener('visibilitychange', foreground);
    };
    recover();
  }

  stop(): void {
    this.controller.abort();
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.stopEvents?.();
    this.stopEvents = undefined;
  }
}
