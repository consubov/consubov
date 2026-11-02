import { describe, expect, test } from "bun:test";
import { apiErrorResponse, REQUEST_ID_HEADER } from "./http";

describe("apiErrorResponse", () => {
  test("returns the expected NOT_FOUND contract and distinct tracing IDs", async () => {
    const response = apiErrorResponse(
      "NOT_FOUND",
      "Route not found",
      404,
      "request-123",
      "correlation-456",
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        requestId: "request-123",
        correlationId: "correlation-456",
      },
    });
  });

  test("returns the expected INTERNAL_ERROR contract", async () => {
    const response = apiErrorResponse(
      "INTERNAL_ERROR",
      "Internal server error",
      500,
      "request-500",
      "correlation-500",
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        requestId: "request-500",
        correlationId: "correlation-500",
      },
    });
  });

  test("supports the UNAUTHORIZED error code", async () => {
    const response = apiErrorResponse(
      "UNAUTHORIZED",
      "Authentication required",
      401,
      "request-401",
      "request-401",
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        requestId: "request-401",
        correlationId: "request-401",
      },
    });
  });

  test("includes JSON, no-cache, tracing and defensive security headers", () => {
    const response = apiErrorResponse(
      "NOT_FOUND",
      "Route not found",
      404,
      "request-headers",
      "correlation-headers",
    );

    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe("request-headers");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("permissions-policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
  });
});
