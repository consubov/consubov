import { describe, expect, it } from "vitest";
import {
  DEFAULT_API_BASE_URL,
  normalizeApiBaseUrl,
} from "./apiConfig";

describe("normalizeApiBaseUrl", () => {
  it("uses the local API when no value is configured", () => {
    expect(normalizeApiBaseUrl()).toBe(DEFAULT_API_BASE_URL);
    expect(normalizeApiBaseUrl("   ")).toBe(DEFAULT_API_BASE_URL);
  });

  it("trims whitespace and trailing slashes", () => {
    expect(normalizeApiBaseUrl(" https://api.example.test/// ")).toBe(
      "https://api.example.test",
    );
  });
});
