import { describe, expect, test } from "bun:test";
import { denied, SecurityContractValidationError } from "./errors";

describe("errors", () => {
  describe("denied", () => {
    test("returns an AuthorizationDecision with allowed set to false and the correct error details", () => {
      const result = denied("TENANT_MISMATCH", "Tenant mismatch error");

      expect(result).toEqual({
        allowed: false,
        error: {
          code: "TENANT_MISMATCH",
          message: "Tenant mismatch error",
          httpStatus: 403,
        },
      });
    });

    test("returns correctly for MISSING_SCOPE", () => {
      const result = denied("MISSING_SCOPE", "Missing scope error");

      expect(result).toEqual({
        allowed: false,
        error: {
          code: "MISSING_SCOPE",
          message: "Missing scope error",
          httpStatus: 403,
        },
      });
    });
  });

  describe("SecurityContractValidationError", () => {
    test("sets name, code, and message correctly", () => {
      const error = new SecurityContractValidationError(
        "INVALID_TENANT_ID",
        "Invalid tenant id error"
      );

      expect(error.name).toBe("SecurityContractValidationError");
      expect(error.code).toBe("INVALID_TENANT_ID");
      expect(error.message).toBe("Invalid tenant id error");
      expect(error).toBeInstanceOf(Error);
    });
  });
});
