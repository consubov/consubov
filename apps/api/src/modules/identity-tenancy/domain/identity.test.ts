import { describe, expect, test } from "bun:test";
import { createTenantId } from "./identity";
import { SecurityContractValidationError } from "./errors";

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
