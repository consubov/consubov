import { describe, expect, test } from "bun:test";
import { getRoute } from "./routes";

describe("getRoute", () => {
  test("should return the correct route for a valid path and method", () => {
    // Assuming there's a health route as per routes.ts
    const route = getRoute("/api/v1/health", "GET");
    expect(route).toBeDefined();
    expect(route?.path).toBe("/api/v1/health");
    expect(route?.method).toBe("GET");
    expect(route?.surface).toBe("product");
  });

  test("should return undefined for a non-existent path", () => {
    const route = getRoute("/api/v1/does-not-exist", "GET");
    expect(route).toBeUndefined();
  });

  test("should return undefined for an existing path but incorrect method", () => {
    // Assuming /api/v1/health is GET only
    const route = getRoute("/api/v1/health", "POST");
    expect(route).toBeUndefined();
  });

  test("should be case-sensitive for paths", () => {
    const route = getRoute("/API/V1/HEALTH", "GET");
    expect(route).toBeUndefined();
  });

  test("should be case-sensitive for methods", () => {
    const route = getRoute("/api/v1/health", "get");
    expect(route).toBeUndefined();
  });
});
