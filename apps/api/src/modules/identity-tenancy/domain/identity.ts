import { SecurityContractValidationError } from "./errors";

export type PrincipalKind = "user" | "integration";

export type TenantId = string & { readonly __brand: "TenantId" };
export type PrincipalId = string & { readonly __brand: "PrincipalId" };
export type PermissionScope = string & { readonly __brand: "PermissionScope" };

export type Principal = {
  kind: PrincipalKind;
  id: PrincipalId;
};

export type AuthenticatedRequestContext = {
  requestId: string;
  tenantId: TenantId;
  principal: Principal;
  scopes: readonly PermissionScope[];
};

const MAX_IDENTIFIER_LENGTH = 128;
const SCOPE_PATTERN =
  /^[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*$/;

function normalizeRequiredValue(
  value: string,
  code:
    | "INVALID_TENANT_ID"
    | "INVALID_PRINCIPAL_ID"
    | "INVALID_REQUEST_ID",
  label: string,
): string {
  const normalized = value.trim();

  if (!normalized || normalized.length > MAX_IDENTIFIER_LENGTH) {
    throw new SecurityContractValidationError(
      code,
      `${label} must be non-empty and at most ${MAX_IDENTIFIER_LENGTH} characters.`,
    );
  }

  return normalized;
}

export function createTenantId(value: string): TenantId {
  return normalizeRequiredValue(
    value,
    "INVALID_TENANT_ID",
    "Tenant id",
  ) as TenantId;
}

export function createPrincipalId(value: string): PrincipalId {
  return normalizeRequiredValue(
    value,
    "INVALID_PRINCIPAL_ID",
    "Principal id",
  ) as PrincipalId;
}

export function createPermissionScope(value: string): PermissionScope {
  const normalized = value.trim().toLowerCase();

  if (
    !normalized ||
    normalized.length > MAX_IDENTIFIER_LENGTH ||
    !SCOPE_PATTERN.test(normalized)
  ) {
    throw new SecurityContractValidationError(
      "INVALID_SCOPE",
      "Scope must use the namespaced resource:action format.",
    );
  }

  return normalized as PermissionScope;
}

export function createPrincipal(
  kind: PrincipalKind,
  id: string,
): Principal {
  return {
    kind,
    id: createPrincipalId(id),
  };
}

export function createAuthenticatedRequestContext(input: {
  requestId: string;
  tenantId: string;
  principal: {
    kind: PrincipalKind;
    id: string;
  };
  scopes?: readonly string[];
}): AuthenticatedRequestContext {
  const requestId = normalizeRequiredValue(
    input.requestId,
    "INVALID_REQUEST_ID",
    "Request id",
  );
  const tenantId = createTenantId(input.tenantId);
  const principal = createPrincipal(
    input.principal.kind,
    input.principal.id,
  );

  const scopes = Array.from(
    new Set((input.scopes ?? []).map(createPermissionScope)),
  );

  return {
    requestId,
    tenantId,
    principal,
    scopes,
  };
}
