import { docsHtml } from "./docs";
import {
  apiErrorResponse,
  htmlResponse,
  jsonResponse,
  resolveRequestId,
} from "./http";
import { openApiDocument } from "./openapi";

export async function handleRequest(request: Request): Promise<Response> {
  const requestId = resolveRequestId(request);

  try {
    const url = new URL(request.url);

    if (request.method === "GET") {
      switch (url.pathname) {
        case "/api/v1/health":
          return jsonResponse({ status: "ok" }, 200, requestId);

        case "/api/v1/readiness":
          return jsonResponse({ status: "ready" }, 200, requestId);

        case "/api/v1/openapi.json":
          return jsonResponse(openApiDocument, 200, requestId);

        case "/api/docs":
          return htmlResponse(docsHtml, 200, requestId);
      }
    }

    return apiErrorResponse(
      "NOT_FOUND",
      "Route not found",
      404,
      requestId,
    );
  } catch (error) {
    // Stack traces stay in process logs and are never serialized to HTTP clients.
    console.error("Unhandled API request error", { requestId, error });

    return apiErrorResponse(
      "INTERNAL_ERROR",
      "Internal server error",
      500,
      requestId,
    );
  }
}
