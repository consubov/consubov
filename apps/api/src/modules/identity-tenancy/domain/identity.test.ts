import { describe, expect, test } from "bun:test";
import { createPrincipal } from "./identity";
import { SecurityContractValidationError } from "./errors";

describe("createPrincipal", () => {
  test("creates a valid user principal", () => {
    const principal = createPrincipal("user", "user-123");
    expect(principal).toEqual({
      kind: "user",
      id: "user-123",
    });
  });

  test("creates a valid integration principal", () => {
    const principal = createPrincipal("integration", "service-account");
    expect(principal).toEqual({
      kind: "integration",
      id: "service-account",
    });
  });

  test("trims whitespace from principal id", () => {
    const principal = createPrincipal("user", "  user-with-spaces  ");
    expect(principal).toEqual({
      kind: "user",
      id: "user-with-spaces",
    });
  });

  test("throws error if principal id is empty", () => {
    expect(() => createPrincipal("user", "   ")).toThrow(SecurityContractValidationError);
  });

  test("throws error if principal id exceeds max length", () => {
    const longId = "a".repeat(129);
    expect(() => createPrincipal("user", longId)).toThrow(SecurityContractValidationError);
  });
});
