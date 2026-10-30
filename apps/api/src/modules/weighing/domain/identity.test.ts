import { describe, expect, test } from "bun:test";
import { isTipoBalanca } from "./identity";

describe("isTipoBalanca", () => {
  test("returns true for valid types", () => {
    expect(isTipoBalanca("individual")).toBe(true);
    expect(isTipoBalanca("balancao")).toBe(true);
  });

  test("returns false for invalid strings", () => {
    expect(isTipoBalanca("outro")).toBe(false);
    expect(isTipoBalanca("")).toBe(false);
    expect(isTipoBalanca("INDIVIDUAL")).toBe(false);
  });

  test("returns false for null and undefined", () => {
    expect(isTipoBalanca(null)).toBe(false);
    expect(isTipoBalanca(undefined)).toBe(false);
  });
});
