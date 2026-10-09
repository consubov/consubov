/**
 * Local-only sync coordinator. Authority and conflict resolution belong to the
 * server; no HTTP/remote connector is constructed here. This does not touch
 * any existing legacy queue.
 */
import {
  assertCommandOwner,
  acknowledgeCommand,
  type CommandOwner,
  type LocalCommand,
} from "./commandPolicy";

export type SyncReply =
  | { kind: "acked"; ack: { commandId: string; idempotencyKey: string; tenantId: string; userId: string } }
  | { kind: "conflict" }
  | { kind: "retry-later" };

/**
 * IMPORTANT: claimPending and the transition methods must be implemented in
 * an atomic persisted transaction by a future queue adapter. A get+set pair is
 * insufficient for multiple tabs; a fake adapter may enforce that in tests.
 */
export interface AtomicCommandQueue<T = unknown> {
  claimPending(owner: CommandOwner, commandId: string): Promise<LocalCommand<T> | null>;
  acknowledge(owner: CommandOwner, command: LocalCommand<T>): Promise<void>;
  markConflict(owner: CommandOwner, command: LocalCommand<T>): Promise<void>;
  releaseForRetry(owner: CommandOwner, command: LocalCommand<T>): Promise<void>;
}

export interface OfflineCommandTransport<T = unknown> {
  push(command: LocalCommand<T>): Promise<SyncReply>;
}

export type SyncOneResult =
  | { status: "empty"; commandId: string }
  | { status: "acked" | "conflict" | "retry"; commandId: string };

export async function syncOneLocalCommand<T>(
  owner: CommandOwner,
  commandId: string,
  queue: AtomicCommandQueue<T>,
  transport: OfflineCommandTransport<T>,
): Promise<SyncOneResult> {
  // claimPending must be a durable compare-and-set, never read-then-write.
  const reserved = await queue.claimPending(owner, commandId);
  if (!reserved) return { status: "empty", commandId };
  assertCommandOwner(reserved, owner);
  if (reserved.commandId !== commandId || reserved.status !== "inflight") {
    throw new Error("invalid atomic queue reservation");
  }

  let reply: SyncReply;
  try {
    reply = await transport.push(reserved);
  } catch {
    // An error after send is ambiguous. Keep the SAME idempotency key for the
    // next attempt; never guess that the backend did not receive the command.
    await queue.releaseForRetry(owner, reserved);
    return { status: "retry", commandId };
  }

  if (reply.kind === "acked") {
    // Verify ACK identity before any permanent state transition.
    const checked = acknowledgeCommand(reserved, owner, reply.ack);
    await queue.acknowledge(owner, checked);
    return { status: "acked", commandId };
  }
  if (reply.kind === "conflict") {
    // Never resolve stock/weighing/transfer conflicts with last-write-wins.
    await queue.markConflict(owner, reserved);
    return { status: "conflict", commandId };
  }
  if (reply.kind === "retry-later") {
    await queue.releaseForRetry(owner, reserved);
    return { status: "retry", commandId };
  }
  // A structurally invalid or future reply is not a positive ACK.
  await queue.releaseForRetry(owner, reserved);
  throw new Error("unrecognized sync response");
}
