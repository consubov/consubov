import type { CommandOwner, LocalCommand } from "./commandPolicy";
import { syncOneLocalCommand, type OfflineCommandTransport, type SyncReply } from "./localSyncRound";
import type { IndexedDbAtomicCommandQueue } from "../adapters/IndexedDbAtomicCommandQueue";

export type SyncBroadcastMessage =
  | { type: "COMMAND_ENQUEUED"; tenantId: string; userId: string; commandId: string }
  | { type: "SYNC_STATUS_CHANGED"; tenantId: string; userId: string; status: "idle" | "syncing" | "error"; pendingCount: number }
  | { type: "COMMAND_ACKED"; tenantId: string; userId: string; commandId: string }
  | { type: "COMMAND_CONFLICT"; tenantId: string; userId: string; commandId: string };

export interface QueueDrainerOptions {
  batchSize?: number;
  circuitBreakerOnFailure?: boolean;
}

export interface DrainSummary {
  processed: number;
  acked: number;
  conflicted: number;
  retried: number;
  stoppedOnError: boolean;
  durationMs: number;
}

export async function withSyncLeaderLock<R>(
  owner: CommandOwner,
  fn: (signal: AbortSignal) => Promise<R>,
): Promise<{ executed: boolean; result?: R }> {
  if (
    typeof navigator !== "undefined" &&
    "locks" in navigator &&
    typeof navigator.locks?.request === "function"
  ) {
    const lockName = `consubov:sync-leader:${owner.tenantId}:${owner.userId}`;
    return navigator.locks.request(lockName, { ifAvailable: true }, async (lock) => {
      if (!lock) {
        return { executed: false };
      }
      const controller = new AbortController();
      const result = await fn(controller.signal);
      return { executed: true, result };
    });
  }
  const controller = new AbortController();
  const result = await fn(controller.signal);
  return { executed: true, result };
}

export interface TransportEvent<T = unknown> {
  timestamp: string;
  commandId: string;
  idempotencyKey: string;
  kind: string;
  type: "receive" | "ack" | "conflict" | "drop" | "lost_ack";
  command: LocalCommand<T>;
}

export class FakeOfflineCommandTransport<T = unknown> implements OfflineCommandTransport<T> {
  private online: boolean = true;
  private latencyMs: number = 0;
  private scriptedReplies = new Map<string, SyncReply | Error>();
  private serverState = new Map<
    string,
    { command: LocalCommand<T>; ack: { commandId: string; idempotencyKey: string; tenantId: string; userId: string } }
  >();
  private history: TransportEvent<T>[] = [];
  private lostAckKeys = new Set<string>();

  setOnline(status: boolean): void {
    this.online = status;
  }

  isOnline(): boolean {
    return this.online;
  }

  setLatency(ms: number): void {
    this.latencyMs = ms;
  }

  scriptReply(idempotencyKey: string, replyOrError: SyncReply | Error): void {
    this.scriptedReplies.set(idempotencyKey, replyOrError);
  }

  simulateLostAck(idempotencyKey: string): void {
    this.lostAckKeys.add(idempotencyKey);
  }

  getServerRecord(idempotencyKey: string) {
    return this.serverState.get(idempotencyKey);
  }

  getServerState() {
    return this.serverState;
  }

  getHistory(): TransportEvent<T>[] {
    return this.history;
  }

  reset(): void {
    this.online = true;
    this.latencyMs = 0;
    this.scriptedReplies.clear();
    this.serverState.clear();
    this.history = [];
    this.lostAckKeys.clear();
  }

  async push(command: LocalCommand<T>): Promise<SyncReply> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }

    if (!this.online) {
      this.history.push({
        timestamp: new Date().toISOString(),
        commandId: command.commandId,
        idempotencyKey: command.idempotencyKey,
        kind: command.kind,
        type: "drop",
        command,
      });
      throw new Error("NetworkError: Failed to fetch (simulated offline)");
    }

    if (this.scriptedReplies.has(command.idempotencyKey)) {
      const scripted = this.scriptedReplies.get(command.idempotencyKey)!;
      if (scripted instanceof Error) {
        throw scripted;
      }
      return scripted;
    }

    if (this.lostAckKeys.has(command.idempotencyKey)) {
      this.lostAckKeys.delete(command.idempotencyKey);
      const ack = {
        commandId: command.commandId,
        idempotencyKey: command.idempotencyKey,
        tenantId: command.tenantId,
        userId: command.userId,
      };
      this.serverState.set(command.idempotencyKey, { command: structuredClone(command), ack });
      this.history.push({
        timestamp: new Date().toISOString(),
        commandId: command.commandId,
        idempotencyKey: command.idempotencyKey,
        kind: command.kind,
        type: "lost_ack",
        command,
      });
      throw new Error("NetworkError: Connection reset while waiting for HTTP ACK (Lost ACK)");
    }

    const ack = {
      commandId: command.commandId,
      idempotencyKey: command.idempotencyKey,
      tenantId: command.tenantId,
      userId: command.userId,
    };

    if (!this.serverState.has(command.idempotencyKey)) {
      this.serverState.set(command.idempotencyKey, { command: structuredClone(command), ack });
    }

    this.history.push({
      timestamp: new Date().toISOString(),
      commandId: command.commandId,
      idempotencyKey: command.idempotencyKey,
      kind: command.kind,
      type: "ack",
      command,
    });

    return {
      kind: "acked",
      ack,
    };
  }
}

export class LocalQueueDrainer<T = unknown> {
  private channel: BroadcastChannel | null = null;

  constructor(
    private readonly queue: IndexedDbAtomicCommandQueue<T>,
    private readonly transport: OfflineCommandTransport<T>,
  ) {
    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.channel = new BroadcastChannel("consubov-vnext-sync");
      } catch {
        this.channel = null;
      }
    }
  }

  broadcast(message: SyncBroadcastMessage): void {
    try {
      this.channel?.postMessage(message);
    } catch {
      // Ignored if channel is closed or unsupported
    }
  }

  close(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }

  async drainBatch(owner: CommandOwner, options?: QueueDrainerOptions): Promise<DrainSummary> {
    const startedAt = Date.now();
    const batchSize = options?.batchSize ?? 50;
    const circuitBreaker = options?.circuitBreakerOnFailure ?? true;

    const pending = await this.queue.listPending(owner);
    pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const toProcess = pending.slice(0, batchSize);

    let acked = 0;
    let conflicted = 0;
    let retried = 0;
    let stoppedOnError = false;

    this.broadcast({
      type: "SYNC_STATUS_CHANGED",
      tenantId: owner.tenantId,
      userId: owner.userId,
      status: "syncing",
      pendingCount: pending.length,
    });

    for (const cmd of toProcess) {
      try {
        const result = await syncOneLocalCommand(owner, cmd.commandId, this.queue, this.transport);
        if (result.status === "acked") {
          acked++;
          this.broadcast({
            type: "COMMAND_ACKED",
            tenantId: owner.tenantId,
            userId: owner.userId,
            commandId: cmd.commandId,
          });
        } else if (result.status === "conflict") {
          conflicted++;
          this.broadcast({
            type: "COMMAND_CONFLICT",
            tenantId: owner.tenantId,
            userId: owner.userId,
            commandId: cmd.commandId,
          });
        } else if (result.status === "retry") {
          retried++;
          if (circuitBreaker) {
            stoppedOnError = true;
            break;
          }
        }
      } catch {
        retried++;
        if (circuitBreaker) {
          stoppedOnError = true;
          break;
        }
      }
    }

    const remainingPending = await this.queue.listPending(owner);
    this.broadcast({
      type: "SYNC_STATUS_CHANGED",
      tenantId: owner.tenantId,
      userId: owner.userId,
      status: stoppedOnError ? "error" : "idle",
      pendingCount: remainingPending.length,
    });

    return {
      processed: acked + conflicted + retried,
      acked,
      conflicted,
      retried,
      stoppedOnError,
      durationMs: Date.now() - startedAt,
    };
  }

  async drainWithLeaderLock(
    owner: CommandOwner,
    options?: QueueDrainerOptions,
  ): Promise<{ executed: boolean; summary?: DrainSummary }> {
    const lockResult = await withSyncLeaderLock(owner, async () => {
      return this.drainBatch(owner, options);
    });
    return { executed: lockResult.executed, summary: lockResult.result };
  }
}
