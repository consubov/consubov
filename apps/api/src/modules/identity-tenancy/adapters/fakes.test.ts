import { describe, expect, it } from "bun:test";
import {
  FakeAuthorizationAdapter,
  FakeTenantContextAdapter,
} from "./fakes";
import { createPermissionScope, createPrincipalId, createTenantId } from "../domain/identity";

describe("FakeTenantContextAdapter", () => {
  it("resolves context from identity", async () => {
    const adapter = new FakeTenantContextAdapter();
    const identity = {
      tenantId: createTenantId("tenant-1"),
      principal: { kind: "user" as const, id: createPrincipalId("user-1") },
      scopes: [createPermissionScope("resource:read")],
    };

    const context = await adapter.resolveContext(identity, "req-1");

    expect(context.requestId).toBe("req-1");
    expect(context.tenantId).toBe("tenant-1");
    expect(context.principal.id).toBe("user-1");
    expect(context.scopes).toContain("resource:read");
  });
});

describe("FakeAuthorizationAdapter", () => {
  it("authorizes when tenant matches and scopes are met", async () => {
    const adapter = new FakeAuthorizationAdapter();
    const context = {
      requestId: "req-1",
      tenantId: createTenantId("tenant-1"),
      principal: { kind: "user" as const, id: createPrincipalId("user-1") },
      scopes: [createPermissionScope("resource:read")],
    };

    const decision = await adapter.authorize(context, {
      resourceTenantId: createTenantId("tenant-1"),
      requiredScopes: [createPermissionScope("resource:read")],
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies when tenant does not match", async () => {
    const adapter = new FakeAuthorizationAdapter();
    const context = {
      requestId: "req-1",
      tenantId: createTenantId("tenant-1"),
      principal: { kind: "user" as const, id: createPrincipalId("user-1") },
      scopes: [],
    };

    const decision = await adapter.authorize(context, {
      resourceTenantId: createTenantId("tenant-2"),
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.error.code).toBe("TENANT_MISMATCH");
    }
  });
});
