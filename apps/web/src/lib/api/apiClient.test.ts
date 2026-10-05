import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "./apiClient";
import { ApiClientError } from "./apiError";

function jsonResponse(
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...Object.fromEntries(new Headers(headers).entries()),
    },
  });
}

describe("createApiClient", () => {
  const baseUrl = "http://test.api";
  const fetchMock = vi.fn();
  let client: ReturnType<typeof createApiClient>;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    client = createApiClient({ baseUrl, defaultTimeoutMs: 5_000 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("parses a successful JSON response and applies safe defaults", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1 }));

    await expect(client.request<{ id: number }>("endpoint")).resolves.toEqual({
      id: 1,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(url).toBe("http://test.api/endpoint");
    expect(init.method).toBe("GET");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(headers.get("accept")).toBe("application/json");
    expect("timeoutMs" in init).toBe(false);
    expect("correlationId" in init).toBe(false);
    expect("idempotencyKey" in init).toBe(false);
  });

  it("returns undefined for 204", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(client.request<void>("/empty")).resolves.toBeUndefined();
  });

  for (const status of [400, 401, 403, 404, 500]) {
    it(`normalizes the API error envelope for HTTP ${status}`, async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: `E_${status}`,
              message: `failure-${status}`,
              requestId: "req-1",
              correlationId: "corr-1",
            },
          },
          status,
        ),
      );

      await expect(client.request("/failure")).rejects.toMatchObject({
        name: "ApiClientError",
        status,
        code: `E_${status}`,
        message: `failure-${status}`,
        requestId: "req-1",
        correlationId: "corr-1",
      } satisfies Partial<ApiClientError>);
    });
  }

  it("falls back to status and response request id for a non-JSON error", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("provider failure", {
        status: 500,
        headers: { "x-request-id": "req-header" },
      }),
    );

    await expect(client.request("/failure")).rejects.toMatchObject({
      name: "ApiClientError",
      status: 500,
      message: "HTTP 500",
      requestId: "req-header",
    } satisfies Partial<ApiClientError>);
  });

  it("propagates correlation id and only sends idempotency key when provided", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await client.request("/read", { correlationId: "corr-1" });
    await client.request("/write", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
      idempotencyKey: "idem-1",
    });

    const firstHeaders = new Headers(
      (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers,
    );
    const secondHeaders = new Headers(
      (fetchMock.mock.calls[1] as [string, RequestInit])[1].headers,
    );

    expect(firstHeaders.get("x-correlation-id")).toBe("corr-1");
    expect(firstHeaders.has("idempotency-key")).toBe(false);
    expect(secondHeaders.get("idempotency-key")).toBe("idem-1");
    expect(secondHeaders.get("content-type")).toBe("application/json");
  });

  it("preserves Headers input without duplicating content type", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await client.request("/write", {
      method: "POST",
      body: "payload",
      headers: new Headers({
        "Content-Type": "text/plain",
        "X-Custom": "value",
      }),
    });

    const headers = new Headers(
      (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers,
    );

    expect(headers.get("content-type")).toBe("text/plain");
    expect(headers.get("x-custom")).toBe("value");
  });

  it("aborts on timeout", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason),
          { once: true },
        );
      }),
    );

    const promise = client.request("/slow", { timeoutMs: 10 });
    const assertion = expect(promise).rejects.toMatchObject({
      name: "AbortError",
      message: "Request timeout",
    });

    await vi.advanceTimersByTimeAsync(11);
    await assertion;
  });

  it("propagates an external abort signal", async () => {
    const externalController = new AbortController();
    fetchMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason),
          { once: true },
        );
      }),
    );

    const promise = client.request("/cancelled", {
      signal: externalController.signal,
    });
    const assertion = expect(promise).rejects.toMatchObject({
      name: "AbortError",
      message: "Cancelled by caller",
    });

    externalController.abort(
      new DOMException("Cancelled by caller", "AbortError"),
    );

    await assertion;
  });
});
