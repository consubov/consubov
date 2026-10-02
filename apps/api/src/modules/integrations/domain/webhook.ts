/**
 * Domain contract for webhook subscription.
 *
 * - event_id must be stable.
 * - retries of the same event must preserve the same event_id.
 * - preparation for signature/verification without choosing a final provider.
 * - preparation for retry with backoff.
 * - idempotency by event_id.
 * - automatic disabling after persistent failures.
 * - delivery logs preparation (without registering sensitive body).
 */
export type WebhookSubscription = {
  subscriptionId: string;
  tenantId: string;
  consumerId: string;
  endpointUrl: string;
  eventTypes: readonly string[];
  status: 'active' | 'disabled';
  secretReference: string; // reference for signature verification, no actual secret stored here
  createdAt: Date;
  disabledAt: Date | null;
  failureCount: number;
};