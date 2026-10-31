import { describe, expect, test } from "bun:test";
import { resolveCorrelationId, CORRELATION_ID_HEADER, resolveRequestId, REQUEST_ID_HEADER, jsonResponse } from "./http";

describe("resolveCorrelationId", () => {
  const fallbackRequestId = "fallback-request-id";

  test("returns the correlation ID header when present and valid", () => {
    const request = new Request("http://localhost");
    request.headers.set(CORRELATION_ID_HEADER, "valid-correlation-id");

    const result = resolveCorrelationId(request, fallbackRequestId);

    expect(result).toBe("valid-correlation-id");
  });

  test("trims whitespace from the correlation ID", () => {
    const request = new Request("http://localhost");
    request.headers.set(CORRELATION_ID_HEADER, "  spaced-correlation-id  ");

    const result = resolveCorrelationId(request, fallbackRequestId);

    expect(result).toBe("spaced-correlation-id");
  });

  test("returns the provided requestId fallback if header is missing", () => {
    const request = new Request("http://localhost");

    const result = resolveCorrelationId(request, fallbackRequestId);

    expect(result).toBe(fallbackRequestId);
  });

  test("returns the provided requestId fallback if header is empty or only whitespace", () => {
    const request1 = new Request("http://localhost");
    request1.headers.set(CORRELATION_ID_HEADER, "");

    expect(resolveCorrelationId(request1, fallbackRequestId)).toBe(fallbackRequestId);

    const request2 = new Request("http://localhost");
    request2.headers.set(CORRELATION_ID_HEADER, "   ");

    expect(resolveCorrelationId(request2, fallbackRequestId)).toBe(fallbackRequestId);
  });

  test("returns the provided requestId fallback if header exceeds 128 characters", () => {
    const request = new Request("http://localhost");
    const longId = "a".repeat(129);
    request.headers.set(CORRELATION_ID_HEADER, longId);

    const result = resolveCorrelationId(request, fallbackRequestId);

    expect(result).toBe(fallbackRequestId);
  });

  test("returns the correlation ID if its length is exactly 128 characters", () => {
    const request = new Request("http://localhost");
    const exactId = "a".repeat(128);
    request.headers.set(CORRELATION_ID_HEADER, exactId);

    const result = resolveCorrelationId(request, fallbackRequestId);

    expect(result).toBe(exactId);
  });
});

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

describe("jsonResponse", () => {
  test("should return a Response with stringified body and correct status", async () => {
    const body = { message: "success" };
    const status = 200;
    const requestId = "test-req-id-123";

    const response = jsonResponse(body, status, requestId);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(status);

    const responseBody = await response.json();
    expect(responseBody).toEqual(body);
  });

  test("should apply expected default headers, including security headers", () => {
    const requestId = "test-req-id-456";
    const response = jsonResponse({}, 200, requestId);

    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe(requestId);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=()");
  });

  test("should merge extraHeaders when provided", () => {
    const requestId = "test-req-id-789";
    const extraHeaders = {
      "x-custom-header": "custom-value",
      "x-another-header": "another-value",
    };

    const response = jsonResponse({}, 201, requestId, extraHeaders);

    expect(response.status).toBe(201);
    expect(response.headers.get("x-custom-header")).toBe("custom-value");
    expect(response.headers.get("x-another-header")).toBe("another-value");
    // Ensure default headers are still applied
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe(requestId);
  });

  test("should allow default headers to override conflicting extraHeaders", () => {
    const extraHeaders = {
      "cache-control": "public, max-age=3600",
      "content-type": "application/xml",
    };

    const response = jsonResponse({}, 200, "id", extraHeaders);

    // Default headers set internally should override the ones provided in extraHeaders
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
  });

  test("should handle null body", async () => {
    const response = jsonResponse(null, 200, "id");
    const responseBody = await response.json();
    expect(responseBody).toBeNull();
  });

  test("should handle array body", async () => {
    const body = [1, 2, 3];
    const response = jsonResponse(body, 200, "id");
    const responseBody = await response.json();
    expect(responseBody).toEqual(body);
  });

  test("should handle string body without double serializing if already serializable", async () => {
    const body = "plain string";
    const response = jsonResponse(body, 200, "id");
    const responseBody = await response.json();
    expect(responseBody).toEqual(body);
  });
});
