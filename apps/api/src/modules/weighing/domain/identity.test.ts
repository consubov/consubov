import { describe, expect, test } from "bun:test";
import { isTipoBalanca } from "./identity";

describe("isTipoBalanca", () => {
  test("returns true for valid balanca types", () => {
    expect(isTipoBalanca("individual")).toBe(true);
    expect(isTipoBalanca("balancao")).toBe(true);
  });

  test("returns false for invalid balanca types", () => {
    expect(isTipoBalanca("invalid")).toBe(false);
    expect(isTipoBalanca("")).toBe(false);
    expect(isTipoBalanca("Individual")).toBe(false);
  });

  test("returns false for null or undefined", () => {
    expect(isTipoBalanca(null)).toBe(false);
    expect(isTipoBalanca(undefined)).toBe(false);
  });
});
