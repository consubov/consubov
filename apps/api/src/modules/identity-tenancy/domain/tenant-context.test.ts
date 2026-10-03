import { describe, expect, test } from "bun:test";
import { createPrincipalId, createTenantId } from "./identity";
import { TENANT_CONTEXT_BOUNDARIES, createTenantExecutionContext } from "./tenant-context";

describe("tenant execution context", () => {
  test("defines all tenant-scoped architectural boundaries", () => {
    expect(TENANT_CONTEXT_BOUNDARIES).toEqual([
      "queries",
      "commands",
      "files",
      "jobs",
      "events",
      "cache",
      "realtime",
      "reports",
      "sync",
    ]);
  });

  test("requires tenant, principal, request and correlation ids", () => {
    expect(() => createTenantExecutionContext({
      tenantId: createTenantId("tenant-1"),
      principalId: createPrincipalId("user-1"),
      requestId: "",
      correlationId: "corr-1",
    })).toThrow("requestId is required");
  });

  test("preserves an explicit tenant context", () => {
    const context = createTenantExecutionContext({
      tenantId: createTenantId("tenant-1"),
      principalId: createPrincipalId("user-1"),
      requestId: "req-1",
      correlationId: "corr-1",
    });
    expect(context.tenantId).toBe("tenant-1");
    expect(context.principalId).toBe("user-1");
  });
});
