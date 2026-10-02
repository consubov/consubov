import type { Claims, VerifiedIdentityWithClaims } from "../domain/claims";
import type { AuthenticatedRequestContext } from "../domain/identity";
import type { AuthContractPort } from "../domain/AuthContractPort";
import type { FakeTenancyRepository } from "./fakes";
import { FakeTenantContextAdapter } from "./fakes";

/**
 * Fake implementation of the Auth contract.
 * Resolves tenant via FakeTenantContextAdapter, validates ACTIVE membership,
 * and returns a context containing resolved tenantId and claims.
 */
export class FakeAuthContractAdapter implements AuthContractPort {
  constructor(
    private repo: FakeTenancyRepository,
    private tenantContext: FakeTenantContextAdapter = new FakeTenantContextAdapter(),
  ) {}

  async verifyAndResolve(principalId: string): Promise<VerifiedIdentityWithClaims | null> {
    // Find active tenant for the given principal
    const active = this.repo.getActiveTenantByPrincipal(principalId);
    if (!active) return null;

    const { tenant, membership } = active;
    const identity = {
      tenantId: tenant.id,
      principal: { kind: "user" as const, id: membership.principalId },
      scopes: [] as const,
    };

    const context = await this.tenantContext.resolveContext(identity, "generated-request-id");

    const claims: Claims = {
      principalId: membership.principalId as string,
      principalKind: "user",
      tenantId: tenant.id,
      scopes: [] as const,
      expired: false,
      revoked: false,
    };

    return { ...identity, claims } as VerifiedIdentityWithClaims;
  }
}
