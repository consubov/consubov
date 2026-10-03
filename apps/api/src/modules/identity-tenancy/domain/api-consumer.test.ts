import { describe, expect, test } from "bun:test";
import { createPermissionScope, createTenantId } from "./identity";
import {
  evaluateApiConsumerCredential,
  rotateApiConsumerCredentialReference,
  toApiConsumerAuditContext,
  type ApiConsumer,
} from "./api-consumer";

const baseConsumer = (): ApiConsumer => ({
  consumerId: "consumer-1",
  name: "Integration",
  tenantId: createTenantId("tenant-1"),
  scopes: [createPermissionScope("reports:read")],
  status: "active",
  credentialReference: "cred-ref-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  revokedAt: null,
  expiresAt: null,
  origin: "integration-test",
});

describe("api consumer credential lifecycle", () => {
  test("rejects revoked consumer", () => {
    expect(evaluateApiConsumerCredential({ ...baseConsumer(), status: "revoked" }, new Date())).toEqual({
      allowed: false,
      reason: "revoked",
    });
  });

  test("rejects expired consumer and accepts non-expired consumer", () => {
    const now = new Date("2026-10-02T12:00:00.000Z");
    expect(evaluateApiConsumerCredential({
      ...baseConsumer(),
      expiresAt: new Date("2026-10-02T11:59:59.000Z"),
    }, now)).toEqual({ allowed: false, reason: "expired" });
    expect(evaluateApiConsumerCredential({
      ...baseConsumer(),
      expiresAt: new Date("2026-10-02T12:00:01.000Z"),
    }, now)).toEqual({ allowed: true });
  });

  test("rotates only the opaque credential reference", () => {
    const rotated = rotateApiConsumerCredentialReference(baseConsumer(), "cred-ref-2");
    expect(rotated.credentialReference).toBe("cred-ref-2");
    expect(rotated.consumerId).toBe("consumer-1");
  });

  test("builds audit context without credential material", () => {
    expect(toApiConsumerAuditContext(baseConsumer())).toEqual({
      consumerId: "consumer-1",
      tenantId: "tenant-1",
      origin: "integration-test",
    });
  });
});
