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
});
