import { describe, expect, test } from "bun:test";
import { nextWebhookAttempt, webhookDeliveryIdempotencyKey } from "./webhook";

describe("webhook conceptual delivery contract", () => {
  test("uses eventId + subscriptionId as a stable idempotency key", () => {
    expect(webhookDeliveryIdempotencyKey("event-1", "sub-1")).toBe("sub-1:event-1");
    expect(webhookDeliveryIdempotencyKey("event-1", "sub-1")).toBe("sub-1:event-1");
  });

  test("retry preserves event and subscription identity", () => {
    const next = nextWebhookAttempt({
      eventId: "event-1",
      subscriptionId: "sub-1",
      attempt: 1,
      attemptedAt: new Date("2026-10-02T10:00:00.000Z"),
      result: "failed",
      responseStatus: 503,
    }, new Date("2026-10-02T10:01:00.000Z"), "retry-scheduled");

    expect(next.eventId).toBe("event-1");
    expect(next.subscriptionId).toBe("sub-1");
    expect(next.attempt).toBe(2);
    expect(next.responseStatus).toBeUndefined();
  });
});
