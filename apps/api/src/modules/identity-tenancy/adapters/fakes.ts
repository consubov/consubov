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
