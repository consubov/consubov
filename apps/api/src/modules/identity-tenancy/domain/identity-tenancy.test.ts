import { describe, expect, test } from "bun:test";
import { authorizeTenantAccess, hasScope } from "./authorization";
import { SecurityContractValidationError } from "./errors";
import {
  createAuthenticatedRequestContext,
  createPermissionScope,
  createTenantId,
} from "./identity";

describe("security contracts", () => {
  test("builds a user context and normalizes/deduplicates scopes", () => {
    const context = createAuthenticatedRequestContext({
      requestId: "req-1",
      tenantId: " tenant-a ",
      principal: {
        kind: "user",
        id: " user-1 ",
      },
      scopes: ["Fazendas:Read", "fazendas:read", "pesagens:write"],
    });

    expect(context.tenantId).toBe("tenant-a");
    expect(context.principal).toEqual({
      kind: "user",
      id: "user-1",
    });
    expect(context.scopes).toEqual([
      "fazendas:read",
      "pesagens:write",
    ]);
  });

  test("supports integration principals without reusing user semantics", () => {
    const context = createAuthenticatedRequestContext({
      requestId: "req-integration",
      tenantId: "tenant-a",
      principal: {
        kind: "integration",
        id: "erp-connector",
      },
      scopes: ["pesagens:read"],
    });

    expect(context.principal.kind).toBe("integration");
    expect(context.principal.id).toBe("erp-connector");
  });

  test("rejects invalid tenant ids and scope formats at the boundary", () => {
    expect(() =>
      createAuthenticatedRequestContext({
        requestId: "req-1",
        tenantId: "   ",
        principal: {
          kind: "user",
          id: "user-1",
        },
      }),
    ).toThrow(SecurityContractValidationError);

    expect(() => createPermissionScope("fazendas")).toThrow(
      SecurityContractValidationError,
    );
  });

  describe("hasScope", () => {
    test("returns true when the required scope is present", () => {
      const context = createAuthenticatedRequestContext({
        requestId: "req-1",
        tenantId: "tenant-a",
        principal: {
          kind: "user",
          id: "user-1",
        },
        scopes: ["fazendas:read", "pesagens:read"],
      });

      expect(hasScope(context, createPermissionScope("fazendas:read"))).toBe(
        true,
      );
    });

    test("returns false when the required scope is missing", () => {
      const context = createAuthenticatedRequestContext({
        requestId: "req-1",
        tenantId: "tenant-a",
        principal: {
          kind: "user",
          id: "user-1",
        },
        scopes: ["fazendas:read"],
      });

      expect(hasScope(context, createPermissionScope("pesagens:read"))).toBe(
        false,
      );
    });

    test("returns false when context has no scopes", () => {
      const context = createAuthenticatedRequestContext({
        requestId: "req-1",
        tenantId: "tenant-a",
        principal: {
          kind: "user",
          id: "user-1",
        },
        scopes: [],
      });

      expect(hasScope(context, createPermissionScope("fazendas:read"))).toBe(
        false,
      );
    });
  });

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
