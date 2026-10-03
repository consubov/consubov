import { authorizeTenantAccess } from "../domain/authorization";
import type { AuthorizationDecision } from "../domain/errors";
import { createAuthenticatedRequestContext } from "../domain/identity";
import type {
  AccessRequirement,
  AuthenticationCredential,
  AuthorizationPort,
  IdentityVerifierPort,
  TenantContextPort,
  VerifiedIdentity,
} from "../domain/ports";
import type { Claims, VerifiedIdentityWithClaims } from "../domain/claims";
import type { AuthenticatedRequestContext } from "../domain/identity";
import { MembershipStatus, type Tenant, type Membership, type ActiveTenant } from "../domain/tenant-model";

export class FakeTenantContextAdapter implements TenantContextPort {
  async resolveContext(
    identity: VerifiedIdentity,
    requestId: string,
  ): Promise<AuthenticatedRequestContext> {
    return createAuthenticatedRequestContext({
      requestId,
      tenantId: identity.tenantId,
      principal: identity.principal,
      scopes: identity.scopes,
    });
  }
}

export class FakeAuthorizationAdapter implements AuthorizationPort {
  async authorize(
    context: AuthenticatedRequestContext,
    requirement: AccessRequirement,
  ): Promise<AuthorizationDecision> {
    return authorizeTenantAccess({
      context,
      resourceTenantId: requirement.resourceTenantId,
      requiredScopes: requirement.requiredScopes,
    });
  }
}

export type FakeIdentityRecord = {
  identity: VerifiedIdentityWithClaims;
  expired?: boolean;
  revoked?: boolean;
};

export class FakeIdentityVerifierAdapter implements IdentityVerifierPort {
  constructor(private records: Map<string, FakeIdentityRecord> = new Map()) {}

  register(credentialValue: string, record: FakeIdentityRecord): void {
    this.records.set(credentialValue, record);
  }

  async verifyAndResolve(
    credential: AuthenticationCredential,
  ): Promise<VerifiedIdentityWithClaims | null> {
    if (!credential || typeof credential.value !== "string" || credential.value.trim() === "") {
      return null;
    }
    const record = this.records.get(credential.value);
    if (!record) return null;
    const claims: Claims = {
      ...record.identity.claims,
      expired: record.expired ?? record.identity.claims.expired,
      revoked: record.revoked ?? record.identity.claims.revoked,
    };
    if (claims.expired || claims.revoked) return null;
    if (!record.identity.tenantId) return null;
    if (claims.tenantId !== record.identity.tenantId) return null;
    if (claims.principalId !== record.identity.principal.id) return null;
    if (claims.principalKind !== record.identity.principal.kind) return null;
    if (claims.scopes.length !== record.identity.scopes.length) return null;
    if (claims.scopes.some((scope, index) => scope !== record.identity.scopes[index])) return null;
    return { ...record.identity, claims };
  }
}

export class FakeTenancyRepository {
  private tenants: Map<string, Tenant> = new Map();
  private memberships: Map<string, Membership> = new Map();

  createTenant(tenant: Tenant): void {
    this.tenants.set(tenant.id as string, tenant);
  }

  createMembership(membership: Membership): void {
    this.memberships.set(membership.id, membership);
  }

  getTenant(id: string): Tenant | undefined {
    return this.tenants.get(id);
  }

  getMembership(id: string): Membership | undefined {
    return this.memberships.get(id);
  }

  getActiveTenant(tenantId: string, principalId: string): ActiveTenant | null {
    const tenant = this.tenants.get(tenantId);
    const membership = Array.from(this.memberships.values()).find(
      (m) => m.tenantId === tenantId && m.principalId === principalId
    );

    if (!tenant || !membership || membership.status !== MembershipStatus.ACTIVE) {
      return null;
    }

    return { tenant, membership };
  }

  listActiveTenantsByPrincipal(principalId: string): readonly ActiveTenant[] {
    return Array.from(this.memberships.values())
      .filter((membership) =>
        membership.principalId === principalId && membership.status === MembershipStatus.ACTIVE
      )
      .flatMap((membership) => {
        const tenant = this.tenants.get(membership.tenantId);
        return tenant ? [{ tenant, membership }] : [];
      });
  }

  /**
   * Safe convenience for tests that have exactly one active tenant. Multiple
   * memberships are ambiguous and must be resolved explicitly by tenant id.
   */
  getActiveTenantByPrincipal(principalId: string): ActiveTenant | null {
    const activeTenants = this.listActiveTenantsByPrincipal(principalId);
    return activeTenants.length === 1 ? activeTenants[0] : null;
  }
}
