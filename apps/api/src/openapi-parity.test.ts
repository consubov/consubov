import { describe, expect, test } from "bun:test";
import { handleRequest } from "./app";
import { openApiDocument } from "./openapi";
import { routes } from "./routes";

const baseUrl = "http://localhost";

async function request(path: string, init?: RequestInit): Promise<Response> {
  return handleRequest(new Request(`${baseUrl}${path}`, init));
}

const apiErrorSchema =
  openApiDocument.components.schemas.ApiError as unknown as {
    required: string[];
    properties: {
      error: {
        required: string[];
        additionalProperties: boolean;
        properties: Record<string, { type: string; enum?: string[] }>;
      };
    };
  };

describe("OpenAPI/runtime error parity", () => {
  test("404 error body matches the ApiError schema exactly", async () => {
    const response = await request("/missing", {
      headers: {
        "x-request-id": "req-parity",
        "x-correlation-id": "corr-parity",
      },
    });
    const body = (await response.json()) as {
      error: Record<string, unknown>;
    };

    expect(response.status).toBe(404);
    expect(Object.keys(body)).toEqual(["error"]);
    expect(Object.keys(body.error).sort()).toEqual(
      [...apiErrorSchema.properties.error.required].sort(),
    );
    expect(
      Object.keys(body.error).sort(),
    ).toEqual(
      Object.keys(apiErrorSchema.properties.error.properties).sort(),
    );
    expect(apiErrorSchema.properties.error.additionalProperties).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(apiErrorSchema.properties.error.properties.code.enum).toContain(
      body.error.code,
    );
    for (const key of apiErrorSchema.properties.error.required) {
      expect(typeof body.error[key]).toBe("string");
    }
  });

  test("401 error body matches the ApiError schema exactly", async () => {
    routes.push({
      path: "/api/admin/parity",
      method: "GET",
      surface: "admin",
      handler: () => new Response("ok"),
    });

    try {
      const response = await request("/api/admin/parity");
      const body = (await response.json()) as {
        error: Record<string, unknown>;
      };

      expect(response.status).toBe(401);
      expect(Object.keys(body)).toEqual(["error"]);
      expect(Object.keys(body.error).sort()).toEqual(
        [...apiErrorSchema.properties.error.required].sort(),
      );
      expect(body.error.code).toBe("UNAUTHORIZED");
      expect(apiErrorSchema.properties.error.properties.code.enum).toContain(
        body.error.code,
      );
    } finally {
      routes.pop();
    }
  });

  test("500 error body matches the ApiError schema exactly", async () => {
    routes.push({
      path: "/api/test/parity-fail",
      method: "GET",
      surface: "product",
      handler: () => {
        throw new Error("boom");
      },
    });

    try {
      const response = await request("/api/test/parity-fail");
      const body = (await response.json()) as {
        error: Record<string, unknown>;
      };

      expect(response.status).toBe(500);
      expect(Object.keys(body)).toEqual(["error"]);
      expect(Object.keys(body.error).sort()).toEqual(
        [...apiErrorSchema.properties.error.required].sort(),
      );
      expect(body.error.code).toBe("INTERNAL_ERROR");
      expect(apiErrorSchema.properties.error.properties.code.enum).toContain(
        body.error.code,
      );
    } finally {
      routes.pop();
    }
  });

  test("ApiError schema requires exactly the runtime error keys", () => {
    expect([...apiErrorSchema.required].sort()).toEqual(["error"]);
    expect([...apiErrorSchema.properties.error.required].sort()).toEqual(
      ["code", "correlationId", "message", "requestId"].sort(),
    );
    expect(
      Object.keys(apiErrorSchema.properties.error.properties).sort(),
    ).toEqual(["code", "correlationId", "message", "requestId"].sort());
  });

  test("ApiError code enum documents only codes the runtime emits", () => {
    const runtimeCodes = ["NOT_FOUND", "UNAUTHORIZED", "INTERNAL_ERROR"];
    expect(
      [...(apiErrorSchema.properties.error.properties.code.enum ?? [])].sort(),
    ).toEqual([...runtimeCodes].sort());
  });

  test("x-request-id response header mirrors the body requestId", async () => {
    const response = await request("/missing");
    const body = (await response.json()) as {
      error: { requestId: string };
    };

    expect(response.headers.get("x-request-id")).toBe(body.error.requestId);
  });
});
