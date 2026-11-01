import { describe, expect, test } from "bun:test";
import { createPermissionScope, createPrincipal, createTenantId } from "./identity";
import { SecurityContractValidationError } from "./errors";

describe("createPermissionScope", () => {
  test("accepts valid permission scopes", () => {
    expect(createPermissionScope("resource:action")).toBe("resource:action");
    expect(createPermissionScope("user:read")).toBe("user:read");
    expect(createPermissionScope("system.admin:write")).toBe("system.admin:write");
    expect(createPermissionScope("tenant_manager:delete")).toBe("tenant_manager:delete");
    expect(createPermissionScope("domain-name:action-name")).toBe("domain-name:action-name");
    expect(createPermissionScope("123:456")).toBe("123:456");
  });

  test("normalizes by trimming whitespace and converting to lowercase", () => {
    expect(createPermissionScope("  Resource:Action  ")).toBe("resource:action");
    expect(createPermissionScope("\tUSER:READ\n")).toBe("user:read");
  });

  test("rejects scopes that are empty or whitespace only", () => {
    expect(() => createPermissionScope("")).toThrow(SecurityContractValidationError);
    expect(() => createPermissionScope("   ")).toThrow(SecurityContractValidationError);
    expect(() => createPermissionScope("\n\t")).toThrow(SecurityContractValidationError);
  });

  test("rejects scopes that exceed the max length constraint", () => {
    const longResource = "a".repeat(100);
    const longAction = "b".repeat(29);
    // 100 + 1 (:) + 29 = 130 characters, which exceeds 128
    expect(() => createPermissionScope(`${longResource}:${longAction}`)).toThrow(SecurityContractValidationError);
  });

  test("rejects scopes with invalid formats (no colon)", () => {
    expect(() => createPermissionScope("resource")).toThrow(SecurityContractValidationError);
    expect(() => createPermissionScope("resource_action")).toThrow(SecurityContractValidationError);
  });

  test("rejects scopes with invalid formats (multiple colons)", () => {
    expect(() => createPermissionScope("resource:action:subaction")).toThrow(SecurityContractValidationError);
  });

  test("rejects scopes with invalid formats (invalid start characters)", () => {
    // Must start with [a-z0-9]
    expect(() => createPermissionScope("-resource:action")).toThrow(SecurityContractValidationError);
    expect(() => createPermissionScope(".resource:action")).toThrow(SecurityContractValidationError);
    expect(() => createPermissionScope("_resource:action")).toThrow(SecurityContractValidationError);
    expect(() => createPermissionScope("resource:-action")).toThrow(SecurityContractValidationError);
  });

  test("rejects scopes with invalid formats (invalid characters)", () => {
    expect(() => createPermissionScope("resource!:action")).toThrow(SecurityContractValidationError);
    expect(() => createPermissionScope("resource:action@")).toThrow(SecurityContractValidationError);
    expect(() => createPermissionScope("resource:action#")).toThrow(SecurityContractValidationError);
  });
});

describe("createPrincipal", () => {
  test("creates user and integration principals", () => {
    expect(createPrincipal("user", "user-123")).toEqual({kind: "user", id: "user-123"});
    expect(createPrincipal("integration", "service-account")).toEqual({kind: "integration", id: "service-account"});
  });
  test("normalizes principal id whitespace", () => {
    expect(createPrincipal("user", "  user-with-spaces  ")).toEqual({kind: "user", id: "user-with-spaces"});
  });
  test("rejects empty and oversized principal IDs", () => {
    expect(() => createPrincipal("user", "   ")).toThrow(SecurityContractValidationError);
    expect(() => createPrincipal("user", "a".repeat(129))).toThrow(SecurityContractValidationError);
  });
});

describe("identity", () => {
  describe("createTenantId", () => {
    test("creates a valid TenantId and trims whitespace", () => {
      expect(createTenantId("tenant-123")).toBe("tenant-123");
      expect(createTenantId("  tenant-123  ")).toBe("tenant-123");
    });

    test("throws if empty or only whitespace", () => {
      expect(() => createTenantId("")).toThrow(SecurityContractValidationError);
      expect(() => createTenantId("   ")).toThrow(SecurityContractValidationError);
    });

    test("throws if longer than 128 characters", () => {
      const longId = "a".repeat(129);
      expect(() => createTenantId(longId)).toThrow(SecurityContractValidationError);
      expect(() => createTenantId(`  ${longId}  `)).toThrow(SecurityContractValidationError);
    });

    test("does not throw if exactly 128 characters", () => {
      const exactId = "a".repeat(128);
      expect(createTenantId(exactId)).toBe(exactId);
    });
  });
});
