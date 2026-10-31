import { describe, expect, test } from "bun:test";
import { resolveCorrelationId, CORRELATION_ID_HEADER } from "./http";

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
