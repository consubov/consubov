import { describe, expect, test } from "bun:test";
import { hasScope } from "./authorization";
import { SecurityContractValidationError } from "./errors";
import {
  createAuthenticatedRequestContext,
  createPermissionScope,
  createPrincipalId,
} from "./identity";

describe("createPrincipalId", () => {
  test("creates a valid principal id", () => {
    expect(createPrincipalId("user-1")).toBe("user-1");
  });

  test("trims whitespace from principal id", () => {
    expect(createPrincipalId("  user-2  ")).toBe("user-2");
  });

  test("throws on empty or whitespace-only principal id", () => {
    expect(() => createPrincipalId("")).toThrow(SecurityContractValidationError);
    expect(() => createPrincipalId("   ")).toThrow(SecurityContractValidationError);
  });

  test("throws when principal id exceeds max length", () => {
    const longId = "a".repeat(129);
    expect(() => createPrincipalId(longId)).toThrow(SecurityContractValidationError);
  });
});

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

});
