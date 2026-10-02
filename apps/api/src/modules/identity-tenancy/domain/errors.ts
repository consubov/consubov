export type SecurityValidationCode =
  | "INVALID_TENANT_ID"
  | "INVALID_PRINCIPAL_ID"
  | "INVALID_REQUEST_ID"
  | "INVALID_SCOPE";

export class SecurityContractValidationError extends Error {
  readonly code: SecurityValidationCode;

  constructor(code: SecurityValidationCode, message: string) {
    super(message);
    this.name = "SecurityContractValidationError";
    this.code = code;
  }
}

export type AuthorizationFailureCode =
  | "TENANT_MISMATCH"
  | "MISSING_SCOPE";

export type AuthorizationDecision =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      error: {
        code: AuthorizationFailureCode;
        message: string;
        httpStatus: 403;
      };
    };

export function denied(
  code: AuthorizationFailureCode,
  message: string,
): AuthorizationDecision {
  return {
    allowed: false,
    error: {
      code,
      message,
      httpStatus: 403,
    },
  };
}
