import { describe, expect, test } from "bun:test";
import { authorizeTenantAccess, hasScope } from "./authorization";
import {
  createAuthenticatedRequestContext,
  createPermissionScope,
  createTenantId,
} from "./identity";

describe("authorization", () => {
  test("allows same-tenant access when every required scope is granted", () => {
    const context = createAuthenticatedRequestContext({
      requestId: "req-1",
      tenantId: "tenant-a",
      principal: {
        kind: "user",
        id: "user-1",
      },
      scopes: ["fazendas:read", "pesagens:read"],
    });

    const scope = createPermissionScope("fazendas:read");
    const decision = authorizeTenantAccess({
      context,
      resourceTenantId: createTenantId("tenant-a"),
      requiredScopes: [scope],
    });

    expect(decision).toEqual({ allowed: true });
    expect(hasScope(context, scope)).toBe(true);
  });

  test("denies cross-tenant access before evaluating scopes", () => {
    const context = createAuthenticatedRequestContext({
      requestId: "req-1",
      tenantId: "tenant-a",
      principal: {
        kind: "user",
        id: "user-1",
      },
      scopes: ["fazendas:read"],
    });

    const decision = authorizeTenantAccess({
      context,
      resourceTenantId: createTenantId("tenant-b"),
      requiredScopes: [createPermissionScope("fazendas:read")],
    });

    expect(decision).toEqual({
      allowed: false,
      error: {
        code: "TENANT_MISMATCH",
        message: "Access to this tenant resource is denied.",
        httpStatus: 403,
      },
    });
  });

  test("denies same-tenant access when a required scope is missing", () => {
    const context = createAuthenticatedRequestContext({
      requestId: "req-1",
      tenantId: "tenant-a",
      principal: {
        kind: "integration",
        id: "integration-1",
      },
      scopes: ["fazendas:read"],
    });

    const decision = authorizeTenantAccess({
      context,
      resourceTenantId: createTenantId("tenant-a"),
      requiredScopes: [createPermissionScope("pesagens:write")],
    });

    expect(decision).toEqual({
      allowed: false,
      error: {
        code: "MISSING_SCOPE",
        message:
          "The authenticated principal does not have the required scope.",
        httpStatus: 403,
      },
    });
  });

  test("same-tenant operations with no required scope are allowed", () => {
    const context = createAuthenticatedRequestContext({
      requestId: "req-1",
      tenantId: "tenant-a",
      principal: {
        kind: "user",
        id: "user-1",
      },
    });

    const decision = authorizeTenantAccess({
      context,
      resourceTenantId: createTenantId("tenant-a"),
    });

    expect(decision).toEqual({ allowed: true });
  });
});
