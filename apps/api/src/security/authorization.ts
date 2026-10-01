import type { AuthorizationDecision } from "./errors";
import { denied } from "./errors";
import type {
  AuthenticatedRequestContext,
  PermissionScope,
  TenantId,
} from "./identity";

export function hasScope(
  context: AuthenticatedRequestContext,
  requiredScope: PermissionScope,
): boolean {
  return context.scopes.includes(requiredScope);
}

export function authorizeTenantAccess(input: {
  context: AuthenticatedRequestContext;
  resourceTenantId: TenantId;
  requiredScopes?: readonly PermissionScope[];
}): AuthorizationDecision {
  const { context, resourceTenantId } = input;

  // Tenant isolation is checked before scopes so a broad permission can never
  // accidentally authorize access to another tenant.
  if (context.tenantId !== resourceTenantId) {
    return denied(
      "TENANT_MISMATCH",
      "Access to this tenant resource is denied.",
    );
  }

  const missingScope = (input.requiredScopes ?? []).find(
    (scope) => !hasScope(context, scope),
  );

  if (missingScope) {
    return denied(
      "MISSING_SCOPE",
      "The authenticated principal does not have the required scope.",
    );
  }

  return { allowed: true };
}
