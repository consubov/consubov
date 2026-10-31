import { describe, expect, test } from "bun:test";
import { jsonResponse, REQUEST_ID_HEADER } from "./http";

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
