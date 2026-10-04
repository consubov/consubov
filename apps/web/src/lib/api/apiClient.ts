import { ApiClientError, type ApiErrorPayload } from "./apiError";

export type ApiRequestOptions = Omit<RequestInit, "signal"> & {
  timeoutMs?: number;
  correlationId?: string;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type ApiClientConfig = {
  baseUrl: string;
  defaultTimeoutMs: number;
};

type AbortContext = {
  signal: AbortSignal;
  cleanup: () => void;
};

function createAbortContext(timeoutMs: number, external?: AbortSignal): AbortContext {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("timeoutMs must be a positive finite number");
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort(new DOMException("Request timeout", "AbortError"));
  }, timeoutMs);

  const forwardExternalAbort = () => {
    controller.abort(
      external?.reason ?? new DOMException("Request aborted", "AbortError"),
    );
  };

  if (external) {
    if (external.aborted) {
      forwardExternalAbort();
    } else {
      external.addEventListener("abort", forwardExternalAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      globalThis.clearTimeout(timeoutId);
      external?.removeEventListener("abort", forwardExternalAbort);
    },
  };
}

function buildUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function parseErrorPayload(response: Response): Promise<ApiErrorPayload> {
  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return {};
  }
}

function buildHeaders(options: ApiRequestOptions): Headers {
  const headers = new Headers(options.headers);

  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }

  if (
    typeof options.body === "string" &&
    options.body.length > 0 &&
    !headers.has("content-type")
  ) {
    headers.set("content-type", "application/json");
  }

  if (options.correlationId) {
    headers.set("x-correlation-id", options.correlationId);
  }

  if (options.idempotencyKey) {
    headers.set("idempotency-key", options.idempotencyKey);
  }

  return headers;
}

export function createApiClient(config: ApiClientConfig) {
  async function request<T>(
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<T> {
    const {
      timeoutMs,
      correlationId: _correlationId,
      idempotencyKey: _idempotencyKey,
      signal: externalSignal,
      headers: _headers,
      ...requestInit
    } = options;

    const abortContext = createAbortContext(
      timeoutMs ?? config.defaultTimeoutMs,
      externalSignal,
    );

    try {
      const response = await fetch(buildUrl(config.baseUrl, path), {
        ...requestInit,
        method: options.method ?? "GET",
        headers: buildHeaders(options),
        signal: abortContext.signal,
      });

      if (!response.ok) {
        const payload = await parseErrorPayload(response);
        throw new ApiClientError(
          payload.error?.message ?? `HTTP ${response.status}`,
          response.status,
          payload.error?.code,
          payload.error?.requestId ??
            response.headers.get("x-request-id") ??
            undefined,
          payload.error?.correlationId ??
            response.headers.get("x-correlation-id") ??
            undefined,
        );
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } finally {
      abortContext.cleanup();
    }
  }

  return { request };
}
