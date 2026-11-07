/**
 * FASE 7 — Pure local command invariants, no network and no domain rule changes.
 * The server remains authoritative. This module does not drain legacy queues.
 */
export type CommandOwner = Readonly<{ tenantId: string; userId: string }>;
export type LocalCommand<T = unknown> = Readonly<{
  commandId: string;
  idempotencyKey: string;
  tenantId: string;
  userId: string;
  deviceId: string;
  kind: string;
  createdAt: string;
  payload: T;
  status: "pending" | "inflight" | "acked" | "conflict";
  attemptCount: number;
}>;

const requireIdentity = (value: string, name: string) => {
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) {
    throw new TypeError(name + " is required");
  }
  return value;
};

export function makePendingCommand<T>(data: Omit<LocalCommand<T>, "status" | "attemptCount">): LocalCommand<T> {
  for (const name of ["commandId", "idempotencyKey", "tenantId", "userId", "deviceId", "kind", "createdAt"] as const) {
    requireIdentity(data[name], name);
  }
  if (data.payload === undefined) throw new TypeError("payload is required");
  return { ...data, status: "pending", attemptCount: 0 };
}

export function assertCommandOwner(command: LocalCommand, owner: CommandOwner): void {
  if (command.tenantId !== requireIdentity(owner.tenantId, "tenantId") ||
      command.userId !== requireIdentity(owner.userId, "userId")) {
    throw new Error("command owner mismatch");
  }
}

export function beginCommandAttempt<T>(command: LocalCommand<T>, owner: CommandOwner): LocalCommand<T> {
  assertCommandOwner(command, owner);
  if (command.status !== "pending") {
    throw new Error("command is not retryable without explicit resolution");
  }
  return { ...command, status: "inflight", attemptCount: command.attemptCount + 1 };
}

export function acknowledgeCommand<T>(
  command: LocalCommand<T>,
  owner: CommandOwner,
  ack: { commandId: string; idempotencyKey: string; tenantId: string; userId: string },
): LocalCommand<T> {
  assertCommandOwner(command, owner);
  if (command.status !== "inflight" || ack.commandId !== command.commandId ||
      ack.idempotencyKey !== command.idempotencyKey || ack.tenantId !== command.tenantId ||
      ack.userId !== command.userId) {
    throw new Error("invalid command acknowledgement");
  }
  return { ...command, status: "acked" };
}

export function retryAfterUncertainDelivery<T>(command: LocalCommand<T>, owner: CommandOwner): LocalCommand<T> {
  assertCommandOwner(command, owner);
  if (command.status !== "inflight") throw new Error("only inflight commands can be retried");
  return { ...command, status: "pending" };
}

export function markCommandConflict<T>(command: LocalCommand<T>, owner: CommandOwner): LocalCommand<T> {
  assertCommandOwner(command, owner);
  if (command.status !== "inflight") throw new Error("conflict must be tied to an attempted command");
  return { ...command, status: "conflict" };
}
