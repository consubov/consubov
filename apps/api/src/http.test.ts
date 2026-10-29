import { describe, expect, test } from "bun:test";
import { resolveRequestId, REQUEST_ID_HEADER } from "./http";

describe("resolveRequestId", () => {
  test("returns the request ID from the header if it's present and valid", () => {
    const request = new Request("http://localhost", {
      headers: {
        [REQUEST_ID_HEADER]: "test-request-id",
      },
    });
    expect(resolveRequestId(request)).toBe("test-request-id");
  });

  test("trims whitespace from the header value", () => {
    const request = new Request("http://localhost", {
      headers: {
        [REQUEST_ID_HEADER]: "  test-request-id-padded  ",
      },
    });
    expect(resolveRequestId(request)).toBe("test-request-id-padded");
  });

  test("generates a new random UUID if the header is missing", () => {
    const request = new Request("http://localhost");
    const requestId = resolveRequestId(request);
    expect(requestId).toBeTruthy();
    expect(requestId.length).toBeGreaterThan(0);
    // Rough check for UUID format
    expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  test("generates a new random UUID if the header is empty", () => {
    const request = new Request("http://localhost", {
      headers: {
        [REQUEST_ID_HEADER]: "",
      },
    });
    const requestId = resolveRequestId(request);
    expect(requestId).toBeTruthy();
    expect(requestId.length).toBeGreaterThan(0);
  });

  test("generates a new random UUID if the header contains only whitespace", () => {
    const request = new Request("http://localhost", {
      headers: {
        [REQUEST_ID_HEADER]: "   ",
      },
    });
    const requestId = resolveRequestId(request);
    expect(requestId).toBeTruthy();
    expect(requestId.length).toBeGreaterThan(0);
    expect(requestId).not.toBe("   ");
  });

  test("generates a new random UUID if the header is longer than 128 characters", () => {
    const longId = "a".repeat(129);
    const request = new Request("http://localhost", {
      headers: {
        [REQUEST_ID_HEADER]: longId,
      },
    });
    const requestId = resolveRequestId(request);
    expect(requestId).toBeTruthy();
    expect(requestId).not.toBe(longId);
  });

  test("returns the request ID if it is exactly 128 characters long", () => {
    const exactId = "b".repeat(128);
    const request = new Request("http://localhost", {
      headers: {
        [REQUEST_ID_HEADER]: exactId,
      },
    });
    expect(resolveRequestId(request)).toBe(exactId);
  });
});
