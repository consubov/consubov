import type { PermissionScope } from "./identity";
import type { Principal } from "./identity";
import type { TenantId } from "./identity";

/**
 * Minimal claims required for identity-tenancy contract.
 * These represent the verified attributes of a principal within a tenant context.
 */
export type Claims = {
  /** Unique identifier of the principal (user or integration) */
  principalId: string;
  /** Type of principal (user or integration) */
  principalKind: "user" | "integration";
  /** Identifier of the tenant the principal is acting within */
  tenantId: TenantId;
  /** Granted permission scopes for this principal in this tenant */
  scopes: readonly PermissionScope[];
  /** Whether the credentials have expired */
  expired: boolean;
  /** Whether the credentials have been revoked */
  revoked: boolean;
};

/**
 * Extended verified identity that includes resolved claims.
 * This combines the basic verified identity with the resolved claims.
 */
export type VerifiedIdentityWithClaims = {
  /** Tenant identifier */
  tenantId: TenantId;
  /** Principal information */
  principal: Principal;
  /** Granted permission scopes */
  scopes: readonly PermissionScope[];
  /** Resolved claims */
  claims: Claims;
};