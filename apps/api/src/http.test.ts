import { describe, expect, test } from "bun:test";
import { apiErrorResponse, REQUEST_ID_HEADER } from "./http";

describe("apiErrorResponse", () => {
  test("creates a valid error response with correct status code and JSON body", async () => {
    const code = "NOT_FOUND";
    const message = "Resource not found";
    const status = 404;
    const requestId = "req-123";
    const correlationId = "corr-456";

    const response = apiErrorResponse(code, message, status, requestId, correlationId);

    expect(response.status).toBe(status);

    const body = await response.json();
    expect(body).toEqual({
      error: {
        code,
        message,
        requestId,
        correlationId,
      },
    });

    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe(requestId);

    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=()");
  });

  test("handles INTERNAL_ERROR with 500 status", async () => {
    const response = apiErrorResponse(
      "INTERNAL_ERROR",
      "Something went wrong",
      500,
      "req-abc",
      "corr-xyz"
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
