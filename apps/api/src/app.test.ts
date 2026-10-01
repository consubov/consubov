import { describe, expect, test } from "bun:test";
import { handleRequest } from "./app";
import { REQUEST_ID_HEADER } from "./http";

const baseUrl = "http://localhost";

async function request(path: string, init?: RequestInit): Promise<Response> {
  return handleRequest(new Request(`${baseUrl}${path}`, init));
}

describe("Consubov API foundation", () => {
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
      };
    };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Route not found");
    expect(body.error.requestId).toBeTruthy();
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe(
      body.error.requestId,
    );
    expect(JSON.stringify(body).toLowerCase()).not.toContain("stack");
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
