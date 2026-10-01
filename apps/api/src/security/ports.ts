import type {
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
