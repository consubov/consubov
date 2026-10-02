import {
  apiErrorResponse,
  resolveCorrelationId,
  resolveRequestId,
} from "./http";
import { getRoute } from "./routes";

export async function handleRequest(request: Request): Promise<Response> {
  const requestId = resolveRequestId(request);
  const correlationId = resolveCorrelationId(request, requestId);

  try {
    const url = new URL(request.url);
    const route = getRoute(url.pathname, request.method);

    if (route) {
      // Policy enforcement for internal/admin routes
      if (route.surface === "admin" || route.internal) {
        // For now, as per PRD: "endpoint administrativo nunca público por conveniência"
        // and "deny-by-default". Since auth is not implemented, we deny.
        return apiErrorResponse(
          "UNAUTHORIZED",
          "Administrative access required",
          401,
          requestId,
          correlationId,
        );
      }

      return await route.handler(request, requestId, correlationId);
    }

    return apiErrorResponse(
      "NOT_FOUND",
      "Route not found",
      404,
      requestId,
      correlationId,
    );
  } catch (error) {
    // Stack traces stay in process logs and are never serialized to HTTP clients.
    console.error("Unhandled API request error", { requestId, correlationId, error });

    return apiErrorResponse(
      "INTERNAL_ERROR",
      "Internal server error",
      500,
      requestId,
      correlationId,
    );
  }
}

