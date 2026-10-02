/**
 * Admission rules of the integration boundary: which audiences a caller may
 * address, the audiences that are never acceptable, and the request rate limit.
 *
 * Everything here is deny-by-default and free of ambient state: the current
 * instant arrives as an explicit argument, and the counter is supplied by the
 * caller.
 */
import type {
  IntegrationCaller,
  IntegrationDenyReason,
  IntegrationPayload,
  IntegrationSelection,
} from "./contracts";

/**
 * A machine caller can only address the audiences its contract ever used —
 * farm, factory and administrators. Addressing users is refused: it was never
 * part of that contract (`send-push-notification/index.ts:299-306`).
 */
export function machineSelectionDecision(
  selections: readonly IntegrationSelection[],
): { allowed: true } | { allowed: false; reason: "selecao_proibida" } {
  if (selections.some((selection) => selection.kind === "users")) {
    return { allowed: false, reason: "selecao_proibida" };
  }

  return { allowed: true };
}

/**
 * A broadcast to every user is always refused: no caller, human or machine, has
 * a legitimate proven flow for it
 * (`send-push-notification/index.ts:546-553`).
 */
export function broadcastIsAlwaysDenied(payload: IntegrationPayload): boolean {
  return payload.all === true;
}

/** True when the request addresses nobody (`send-push-notification/index.ts:557-563`). */
export function hasNoSelection(
  selections: readonly IntegrationSelection[],
): boolean {
  return selections.length === 0;
}

/** Rate limit window in milliseconds (`send-push-notification/index.ts:76`). */
export const RATE_WINDOW_MS = 60_000;

/**
 * Requests per window for a human caller (`send-push-notification/index.ts:77`).
 * [PENDENTE] product decision on the quota; the value is still marked as pending
 * in `docs/19-seguranca-push.md`, so the domain keeps the existing number and no
 * stricter one is invented.
 */
export const DEFAULT_HUMAN_RATE_LIMIT = 30;

/**
 * Requests per window for a machine caller (`send-push-notification/index.ts:78`).
 * [PENDENTE] same product decision as the human quota.
 */
export const DEFAULT_MACHINE_RATE_LIMIT = 120;

/** Limit applied to a caller kind (`send-push-notification/index.ts:518-521`). */
export function rateLimitForCaller(caller: IntegrationCaller): number {
  return caller.type === "machine"
    ? DEFAULT_MACHINE_RATE_LIMIT
    : DEFAULT_HUMAN_RATE_LIMIT;
}

/**
 * Rate limit key, always derived from the identity established on the server and
 * never from the request body (`send-push-notification/index.ts:73-74`, `:522`).
 * Every machine shares one bucket because a machine has no per-user identity.
 */
export function rateLimitKey(caller: IntegrationCaller): string {
  return caller.type === "machine" ? "machine" : `user:${caller.userId}`;
}

/** Counter of one window. The bucket belongs to the caller that stores it. */
export type RateBucket = {
  count: number;
  windowStartMs: number;
};

export type RateLimitDecision =
  | {
      allowed: true;
      bucket: RateBucket;
    }
  | {
      allowed: false;
      reason: Extract<IntegrationDenyReason, "rate_limit">;
      bucket: RateBucket;
    };

/**
 * Fixed-window counter (`send-push-notification/index.ts:87-102`): a missing or
 * expired bucket opens a new window, a full bucket refuses without touching the
 * counter, and any other request increments it. The bucket is stored by the
 * caller under the key returned by `rateLimitKey`.
 */
export function allowIntegrationRequest(input: {
  bucket: RateBucket | null;
  nowMs: number;
  limit: number;
}): RateLimitDecision {
  const { bucket, nowMs } = input;

  if (!bucket || nowMs - bucket.windowStartMs >= RATE_WINDOW_MS) {
    return { allowed: true, bucket: { count: 1, windowStartMs: nowMs } };
  }

  if (bucket.count >= input.limit) {
    return { allowed: false, reason: "rate_limit", bucket };
  }

  return { allowed: true, bucket: { ...bucket, count: bucket.count + 1 } };
}
