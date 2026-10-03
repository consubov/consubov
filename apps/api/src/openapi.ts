const requestIdHeader = {
  description:
    "Identifier of the single HTTP exchange that produced this response. Echoed from the incoming x-request-id header when valid, otherwise generated. Distinct from x-correlation-id, which may span multiple exchanges.",
  schema: {
    type: "string",
  },
} as const;

const requestIdParameter = {
  in: "header",
  name: "x-request-id",
  required: false,
  description:
    "Client-supplied identifier for this specific request. When present, valid and at most 128 characters, it is echoed back in the x-request-id response header and in error bodies; otherwise a new id is generated.",
  schema: {
    type: "string",
  },
} as const;

const correlationIdParameter = {
  in: "header",
  name: "x-correlation-id",
  required: false,
  description:
    "Client-supplied correlation identifier that ties related requests of one business operation together. When absent or invalid, it falls back to the resolved requestId. Echoed as correlationId in error bodies.",
  schema: {
    type: "string",
  },
} as const;

const errorResponse = (description: string) => ({
  description,
  headers: {
    "x-request-id": requestIdHeader,
  },
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ApiError" },
    },
  },
});

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

const trackingParameters = [
  { $ref: "#/components/parameters/RequestId" },
  { $ref: "#/components/parameters/CorrelationId" },
] as const;

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Consubov API",
    version: "0.1.0",
    description:
      "Local API foundation. Persistence, authentication and remote integrations are intentionally not connected yet.\n\nError model: every error response body follows the ApiError schema ({ error: { code, message, requestId, correlationId } }). Status codes emitted today: 401 UNAUTHORIZED for admin/internal routes while authentication is unimplemented (deny-by-default), 404 NOT_FOUND when no route matches the path and method, and 500 INTERNAL_ERROR for unhandled failures (stack traces are never serialized).",
  },
  "x-consubov-contract-policy": {
    idempotency: {
      header: "Idempotency-Key",
      rule: "Retryable mutating operations must document and preserve a stable idempotency key when duplicate effects are possible.",
    },
    pagination: {
      rule: "Collection endpoints that can grow without a safe fixed bound must document their pagination contract. The concrete strategy is endpoint-specific.",
    },
    filteringAndOrdering: {
      rule: "Filters and sort fields must be explicitly allowlisted and documented per endpoint; arbitrary provider/query syntax is not part of the public contract.",
    },
    rateLimit: {
      rule: "Only endpoints with a real rate-limit implementation document rate-limit behavior and headers. Do not advertise limits that do not exist.",
    },
    deprecation: {
      rule: "Deprecated operations must be marked with OpenAPI deprecated=true and document the replacement/version transition before removal.",
    },
  },
  paths: {
    "/api/v1/health": {
      get: {
        operationId: "getHealth",
        summary: "Process health",
        parameters: trackingParameters,
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
          "500": errorResponse(
            "Unhandled failure while processing the request.",
          ),
        },
      },
    },
    "/api/v1/readiness": {
      get: {
        operationId: "getReadiness",
        summary: "Process readiness",
        parameters: trackingParameters,
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
          "500": errorResponse(
            "Unhandled failure while processing the request.",
          ),
        },
      },
    },
    "/api/v1/openapi.json": {
      get: {
        operationId: "getOpenApiDocument",
        summary: "OpenAPI contract",
        parameters: trackingParameters,
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
          "500": errorResponse(
            "Unhandled failure while processing the request.",
          ),
        },
      },
    },
    "/api/docs": {
      get: {
        operationId: "getApiDocs",
        summary: "Consubov Developers documentation",
        parameters: trackingParameters,
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
          "500": errorResponse(
            "Unhandled failure while processing the request.",
          ),
        },
      },
    },
  },
  components: {
    parameters: {
      RequestId: requestIdParameter,
      CorrelationId: correlationIdParameter,
    },
    schemas: {
      ApiError: {
        type: "object",
        additionalProperties: false,
        required: ["error"],
        properties: {
          error: {
            type: "object",
            additionalProperties: false,
            required: ["code", "message", "requestId", "correlationId"],
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
              correlationId: {
                type: "string",
              },
            },
          },
        },
      },
    },
  },
} as const;
