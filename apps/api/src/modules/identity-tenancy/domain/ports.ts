import type { AuthorizationDecision } from "./errors";
import type {
  AuthenticatedRequestContext,
  PermissionScope,
  Principal,
  TenantId,
} from "./identity";

export type AuthenticationCredential =
  | {
      kind: "bearer";
      value: string;
    }
  | {
      kind: "api-key";
      value: string;
    };

export type VerifiedIdentity = {
  tenantId: TenantId;
  principal: Principal;
  scopes: readonly PermissionScope[];
};

/**
 * Boundary for future authentication adapters.
 *
 * Implementations may later verify user tokens or integration credentials,
 * but domain/security code must not depend on Supabase, a database, or a
 * specific identity provider.
 */
export interface IdentityVerifierPort {
  verify(
    credential: AuthenticationCredential,
  ): Promise<VerifiedIdentity | null>;
}

export interface TenantContextPort {
  resolveContext(
    identity: VerifiedIdentity,
    requestId: string,
  ): Promise<AuthenticatedRequestContext>;
}

export type AccessRequirement = {
  resourceTenantId: TenantId;
  requiredScopes?: readonly PermissionScope[];
};

export interface AuthorizationPort {
  authorize(
    context: AuthenticatedRequestContext,
    requirement: AccessRequirement,
  ): Promise<AuthorizationDecision>;
}
