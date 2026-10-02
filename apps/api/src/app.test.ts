import { describe, expect, test } from "bun:test";
import { handleRequest } from "./app";
import { REQUEST_ID_HEADER } from "./http";

const baseUrl = "http://localhost";

async function request(path: string, init?: RequestInit): Promise<Response> {
  return handleRequest(new Request(`${baseUrl}${path}`, init));
}

describe("Consubov API foundation", () => {
  test("errors contain requestId and correlationId in the response body matching headers", async () => {
    const response = await request("/missing", {
      headers: {
        "x-request-id": "req-1",
        "x-correlation-id": "corr-1",
      },
    });
    const body = (await response.json()) as {
      error: {
        code: string;
        message: string;
        requestId: string;
        correlationId: string;
      };
    };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Route not found");
    expect(body.error.requestId).toBe("req-1");
    expect(body.error.correlationId).toBe("corr-1");
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe("req-1");
  });

  test("correlationId falls back to requestId when x-correlation-id is absent", async () => {
    const response = await request("/missing", {
      headers: {
        "x-request-id": "req-fallback",
      },
    });
    const body = (await response.json()) as {
      error: {
        code: string;
        message: string;
        requestId: string;
        correlationId: string;
      };
    };

    expect(response.status).toBe(404);
    expect(body.error.requestId).toBe("req-fallback");
    expect(body.error.correlationId).toBe("req-fallback");
  });

  test("request sem IDs generates unique requestId and correlationId fallback", async () => {
    const response = await request("/missing");
    const body = (await response.json()) as {
      error: {
        code: string;
        message: string;
        requestId: string;
        correlationId: string;
      };
    };

    expect(response.status).toBe(404);
    expect(body.error.requestId).toBeTruthy();
    expect(body.error.correlationId).toBe(body.error.requestId);
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe(body.error.requestId);
  });

  test("invalid or empty x-request-id is ignored and newly generated", async () => {
    const response = await request("/missing", {
      headers: {
        "x-request-id": "   ",
      },
    });
    const body = (await response.json()) as {
      error: {
        code: string;
        message: string;
        requestId: string;
        correlationId: string;
      };
    };

    expect(response.status).toBe(404);
    expect(body.error.requestId).toBeTruthy();
    expect(body.error.requestId).not.toBe("   ");
  });

  test("x-correlation-id alone does not overwrite requestId", async () => {
    const response = await request("/missing", {
      headers: {
        "x-correlation-id": "only-corr-id",
      },
    });
    const body = (await response.json()) as {
      error: {
        code: string;
        message: string;
        requestId: string;
        correlationId: string;
      };
    };

    expect(response.status).toBe(404);
    expect(body.error.correlationId).toBe("only-corr-id");
    expect(body.error.requestId).not.toBe("only-corr-id");
    expect(body.error.requestId).toBeTruthy();
  });

  test("500 internal server error returns standardized error without stack trace", async () => {
    const routes = (await import("./routes")).routes;
    routes.push({
      path: "/api/test/fail",
      method: "GET",
      surface: "product",
      handler: () => {
        throw new Error("Secret database failure stack information");
      },
    });

    const response = await request("/api/test/fail", {
      headers: {
        "x-request-id": "req-500",
        "x-correlation-id": "corr-500",
      },
    });
    const body = (await response.json()) as {
      error: {
        code: string;
        message: string;
        requestId: string;
        correlationId: string;
      };
    };

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("Internal server error");
    expect(body.error.requestId).toBe("req-500");
    expect(body.error.correlationId).toBe("corr-500");
    expect(JSON.stringify(body).toLowerCase()).not.toContain("stack");
    expect(JSON.stringify(body)).not.toContain("Secret database failure");

    routes.pop();
  });

  test("health returns the expected contract", async () => {
    const response = await request("/api/v1/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get(REQUEST_ID_HEADER)).toBeTruthy();
  });

  test("readiness returns the expected contract", async () => {
    const response = await request("/api/v1/readiness");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready" });
    expect(response.headers.get(REQUEST_ID_HEADER)).toBeTruthy();
  });

  test("an incoming request id is preserved", async () => {
    const response = await request("/api/v1/health", {
      headers: {
        [REQUEST_ID_HEADER]: "request-from-client",
      },
    });

    expect(response.headers.get(REQUEST_ID_HEADER)).toBe(
      "request-from-client",
    );
  });

  test("unknown routes return the standardized error without stack traces", async () => {
    const response = await request("/missing");
    const body = (await response.json()) as {
      error: {
        code: string;
        message: string;
        requestId: string;
        correlationId: string;
      };
    };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Route not found");
    expect(body.error.requestId).toBeTruthy();
    expect(body.error.correlationId).toBeTruthy();
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe(
      body.error.requestId,
    );
    expect(JSON.stringify(body).toLowerCase()).not.toContain("stack");
  });

  test("inventory and OpenAPI paths do not diverge", async () => {
    const routes = (await import("./routes")).routes;
    const openApiDocument = (await import("./openapi")).openApiDocument;

    const pathsFromInventory = routes.map((r: { path: string }) => r.path).sort();
    const pathsFromOpenApi = Object.keys(openApiDocument.paths).sort();

    expect(pathsFromInventory).toEqual(pathsFromOpenApi);

    // Verify each route's HTTP method is present in OpenAPI paths
    for (const route of routes) {
      const openApiPath = openApiDocument.paths[route.path as keyof typeof openApiDocument.paths];
      expect(openApiPath).toBeDefined();
      const lowerMethod = route.method.toLowerCase();
      expect(openApiPath).toHaveProperty(lowerMethod);
    }
  });

  test("admin routes are denied by default without proper policy/auth", async () => {
    const routes = (await import("./routes")).routes;

    // Temporarily add a test admin route
    routes.push({
      path: "/api/admin/test",
      method: "GET",
      surface: "admin",
      handler: () => new Response("ok"),
    });

    const response = await request("/api/admin/test");
    expect(response.status).toBe(401);

    // Clean up
    routes.pop();
  });
  test("OpenAPI is valid JSON and reflects all implemented routes", async () => {
    const response = await request("/api/v1/openapi.json");
    const body = (await response.json()) as {
      openapi: string;
      paths: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(body.openapi).toBe("3.1.0");
    expect(Object.keys(body.paths).sort()).toEqual(
      [
        "/api/docs",
        "/api/v1/health",
        "/api/v1/openapi.json",
        "/api/v1/readiness",
      ].sort(),
    );
  });

  test("API docs are navigable and load the OpenAPI contract", async () => {
    const response = await request("/api/docs");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("Consubov Developers");
    expect(html).toContain("/api/v1/openapi.json");
  });
});


