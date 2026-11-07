import { describe, expect, it } from "vitest";
import {
  DEFAULT_API_BASE_URL,
  normalizeApiBaseUrl,
} from "./apiConfig";

describe("normalizeApiBaseUrl", () => {
  it("keeps the API disabled when no URL is configured", () => {
    expect(DEFAULT_API_BASE_URL).toBe("");
    expect(normalizeApiBaseUrl()).toBe(DEFAULT_API_BASE_URL);
    expect(normalizeApiBaseUrl("   ")).toBe(DEFAULT_API_BASE_URL);
  });

  it("trims whitespace and trailing slashes", () => {
    expect(normalizeApiBaseUrl(" https://api.example.test/// ")).toBe(
      "https://api.example.test",
    );
  });
});
