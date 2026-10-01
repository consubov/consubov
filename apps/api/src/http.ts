export const REQUEST_ID_HEADER = "x-request-id";

export type ApiErrorCode = "NOT_FOUND" | "INTERNAL_ERROR";

export function resolveRequestId(request: Request): string {
  const candidate =
    request.headers.get(REQUEST_ID_HEADER) ??
    request.headers.get("x-correlation-id");

  const normalized = candidate?.trim();
  if (normalized && normalized.length <= 128) {
    return normalized;
  }

  return crypto.randomUUID();
}

function responseHeaders(
  requestId: string,
  contentType: string,
  extraHeaders?: HeadersInit,
): Headers {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", contentType);
  headers.set("cache-control", "no-store");
  headers.set(REQUEST_ID_HEADER, requestId);
  return headers;
}

export function jsonResponse(
  body: unknown,
  status: number,
  requestId: string,
  extraHeaders?: HeadersInit,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(
      requestId,
      "application/json; charset=utf-8",
      extraHeaders,
    ),
  });
}

export function htmlResponse(
  html: string,
  status: number,
  requestId: string,
): Response {
  return new Response(html, {
    status,
    headers: responseHeaders(requestId, "text/html; charset=utf-8"),
  });
}

export function apiErrorResponse(
  code: ApiErrorCode,
  message: string,
  status: number,
  requestId: string,
): Response {
  return jsonResponse(
    {
      error: {
        code,
        message,
        requestId,
      },
    },
    status,
    requestId,
  );
}
