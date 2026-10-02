const requestIdHeader = {
  description: "Correlation identifier for the request.",
  schema: {
    type: "string",
  },
} as const;

const statusSchema = (value: string) => ({
  type: "object",
  additionalProperties: false,
  required: ["status"],
  properties: {
    status: {
      type: "string",
      const: value,
    },
  },
});

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Consubov API",
    version: "0.1.0",
    description:
      "Local API foundation. Persistence, authentication and remote integrations are intentionally not connected yet.",
  },
  paths: {
    "/api/v1/health": {
      get: {
        operationId: "getHealth",
        summary: "Process health",
        responses: {
          "200": {
            description: "The API process is healthy.",
            headers: {
              "x-request-id": requestIdHeader,
            },
            content: {
              "application/json": {
                schema: statusSchema("ok"),
              },
            },
          },
        },
      },
    },
    "/api/v1/readiness": {
      get: {
        operationId: "getReadiness",
        summary: "Process readiness",
        responses: {
          "200": {
            description:
              "The API process is ready. No external dependency is checked in this foundation phase.",
            headers: {
              "x-request-id": requestIdHeader,
            },
            content: {
              "application/json": {
                schema: statusSchema("ready"),
              },
            },
          },
        },
      },
    },
    "/api/v1/openapi.json": {
      get: {
        operationId: "getOpenApiDocument",
        summary: "OpenAPI contract",
        responses: {
          "200": {
            description: "The current OpenAPI 3.1 contract.",
            headers: {
              "x-request-id": requestIdHeader,
            },
            content: {
              "application/json": {
                schema: {
                  type: "object",
                },
              },
            },
          },
        },
      },
    },
    "/api/docs": {
      get: {
        operationId: "getApiDocs",
        summary: "Consubov Developers documentation",
        responses: {
          "200": {
            description: "Navigable API documentation generated from OpenAPI.",
            headers: {
              "x-request-id": requestIdHeader,
            },
            content: {
              "text/html": {
                schema: {
                  type: "string",
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ApiError: {
        type: "object",
        additionalProperties: false,
        required: ["error"],
        properties: {
              error: {
            type: "object",
            additionalProperties: false,
             required: ["code", "message", "requestId"],
             properties: {
               code: {
                 type: "string",
                 enum: ["NOT_FOUND", "UNAUTHORIZED", "INTERNAL_ERROR"],
               },
              message: {
                type: "string",
              },
               requestId: {
                type: "string",
              },
            },
          },
        },
      },
    },
  },
} as const;

