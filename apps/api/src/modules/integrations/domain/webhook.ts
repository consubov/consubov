/**
 * Conceptual webhook contracts. No dispatcher, broker, remote queue or concrete
 * signature provider exists in this phase.
 */
export type WebhookSubscription = {
  subscriptionId: string;
  tenantId: string;
  consumerId: string;
  endpointUrl: string;
  eventTypes: readonly string[];
  status: "active" | "disabled";
  /** Reference only; never the signing secret itself. */
  secretReference: string;
  createdAt: Date;
  disabledAt: Date | null;
  failureCount: number;
};

export type WebhookEventIdentity = {
  eventId: string;
  eventType: string;
  eventVersion: number;
  tenantId: string;
  occurredAt: Date;
};

export type WebhookDeliveryResult =
  | "delivered"
  | "failed"
  | "retry-scheduled"
  | "subscription-disabled";

export type WebhookDeliveryAttempt = {
  eventId: string;
  subscriptionId: string;
  attempt: number;
  attemptedAt: Date;
  result: WebhookDeliveryResult;
  /** Optional response metadata only; never store response body or signing secret. */
  responseStatus?: number;
};

export type WebhookDeliveryPolicy = {
  /** Abstract policy reference. Backoff timing is deliberately not invented. */
  backoffPolicyReference?: string;
  /** Abstract policy reference. Failure threshold is deliberately not invented. */
  disablePolicyReference?: string;
};

/** Stable consumer idempotency key: retries keep the same pair. */
export function webhookDeliveryIdempotencyKey(
  eventId: string,
  subscriptionId: string,
): string {
  if (!eventId.trim()) throw new Error("eventId is required");
  if (!subscriptionId.trim()) throw new Error("subscriptionId is required");
  return `${subscriptionId}:${eventId}`;
}

export function nextWebhookAttempt(
  previous: WebhookDeliveryAttempt,
  attemptedAt: Date,
  result: WebhookDeliveryResult,
): WebhookDeliveryAttempt {
  return {
    ...previous,
    attempt: previous.attempt + 1,
    attemptedAt,
    result,
    responseStatus: undefined,
  };
}
