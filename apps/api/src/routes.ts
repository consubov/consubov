import { docsHtml } from "./docs";
import { jsonResponse } from "./http";
import { openApiDocument } from "./openapi";

/**
 * API Surfaces as defined in FASE 2A.1
 */
export type ApiSurface = "product" | "sync" | "public" | "admin";

/**
  * Route metadata for inventory and policy enforcement
  */
export interface RouteDefinition {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  surface: ApiSurface;
  handler: (request: Request, requestId: string, correlationId: string) => Promise<Response> | Response;
  internal?: boolean;
}

/**
  * Central Inventory of API Routes
  */
export const routes: RouteDefinition[] = [
  {
    path: "/api/v1/health",
    method: "GET",
    surface: "product",
    handler: (_req, requestId) => jsonResponse({ status: "ok" }, 200, requestId),
  },
  {
    path: "/api/v1/readiness",
    method: "GET",
    surface: "product",
    handler: (_req, requestId) => jsonResponse({ status: "ready" }, 200, requestId),
  },
  {
    path: "/api/v1/openapi.json",
    method: "GET",
    surface: "product",
    handler: (_req, requestId) => jsonResponse(openApiDocument, 200, requestId),
  },
  {
    path: "/api/docs",
    method: "GET",
    surface: "product",
    handler: (_req, requestId) =>
      new Response(docsHtml, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "x-request-id": requestId,
        },
      }),
  },
];


/**
 * Routing Policy:
 * 1. Product API (/api/v1/...): Main application API.
 * 2. Sync API (/api/v1/sync/...): Future synchronization contracts.
 * 3. Public API (/api/public/v1/...): Future partner API.
 * 4. Admin API (/api/admin/...): Internal management endpoints.
 *
 * Security Policy for Admin/Internal:
 * - Mandatory authentication (to be implemented).
 * - Server-side authorization (to be implemented).
 * - Explicit tenant/scope (to be implemented).
 * - Deny-by-default for any unregistered route or missing policy.
 */
export function getRoute(path: string, method: string): RouteDefinition | undefined {
  return routes.find((r) => r.path === path && r.method === method);
}
