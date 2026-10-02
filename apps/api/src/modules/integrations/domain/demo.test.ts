import { describe, expect, test } from "bun:test";
import {
  DEMO_NAME_MAX_LENGTH,
  DEMO_NAME_MIN_LENGTH,
  cleanDemoName,
  isDemoNameAllowed,
} from "./index";

describe("demonstration account name", () => {
  test("trims and collapses every run of whitespace", () => {
    expect(cleanDemoName("  Maria   da  Silva \n")).toBe("Maria da Silva");
    expect(cleanDemoName("Maria\tda\nSilva")).toBe("Maria da Silva");
  });

  test("truncates at the stored length", () => {
    const cleaned = cleanDemoName("a".repeat(80));

    expect(DEMO_NAME_MAX_LENGTH).toBe(60);
    expect(cleaned).toHaveLength(60);
  });

  test("turns a value that is not a string into an empty name", () => {
    expect(cleanDemoName(undefined)).toBe("");
    expect(cleanDemoName(null)).toBe("");
    expect(cleanDemoName(42)).toBe("");
    expect(cleanDemoName({ nome: "Maria" })).toBe("");
  });
});

describe("minimum name length", () => {
  test("requires at least two characters", () => {
    expect(DEMO_NAME_MIN_LENGTH).toBe(2);
    expect(isDemoNameAllowed("Ma")).toBe(true);
    expect(isDemoNameAllowed("M")).toBe(false);
    expect(isDemoNameAllowed("")).toBe(false);
  });

  test("rejects a name that was blank before cleaning", () => {
    expect(isDemoNameAllowed(cleanDemoName("   "))).toBe(false);
  });
});
