import { authorizeTenantAccess } from "../domain/authorization";
import type { AuthorizationDecision } from "../domain/errors";
import { createAuthenticatedRequestContext } from "../domain/identity";
import type {
  AccessRequirement,
  AuthorizationPort,
  TenantContextPort,
  VerifiedIdentity,
} from "../domain/ports";
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
}
