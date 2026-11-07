export type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
    correlationId?: string;
  };
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string,
    readonly correlationId?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}
