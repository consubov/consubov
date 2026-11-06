import { SYNTHETIC_USERS, getCapabilitiesForProfile, type SyntheticJwtClaims } from '@consubov/auth-client';
import type { AtomicCommandEnvelope } from '@consubov/contracts';

export type GrantScope = Pick<SyntheticJwtClaims, 'user_id' | 'tenant_id' | 'fazenda_id' | 'retiro_id' | 'product_id' | 'profile_id' | 'device_id' | 'session_id'>;
export function domainScope(scope: GrantScope): string {
  return JSON.stringify([scope.user_id, scope.product_id, scope.tenant_id, scope.fazenda_id, scope.retiro_id, scope.profile_id]);
}
export function deviceScope(scope: GrantScope): string {
  return JSON.stringify([domainScope(scope), scope.device_id]);
}

/** Process-local laboratory grants. Restart requires online login; no durable server session is claimed. */
export class LabGrantRegistry {
  private grants = new Map<string, { scope: GrantScope; permissions: readonly string[]; expiresAt: number; revoked: boolean }>();
  register(claims: SyntheticJwtClaims): void {
    this.grants.set(claims.session_id, { scope: structuredClone(claims), permissions: [...claims.permissions], expiresAt: claims.exp, revoked: false });
  }
  revoke(sessionId: string): void {
    const grant = this.grants.get(sessionId);
    if (grant) grant.revoked = true;
  }
  check(claims: SyntheticJwtClaims, capability: string): boolean {
    const grant = this.grants.get(claims.session_id);
    if (!grant || grant.revoked || claims.sub !== claims.user_id || claims.iss !== 'consubov:auth:local' || claims.aud !== 'consubov:platform:api' || !Number.isFinite(claims.exp) || claims.exp !== grant.expiresAt || grant.expiresAt <= Date.now() / 1000) return false;
    if (domainScope(grant.scope) !== domainScope(claims) || grant.scope.device_id !== claims.device_id) return false;
    const user = Object.values(SYNTHETIC_USERS).find(user => user.user_id === claims.user_id);
    if (!user || user.primary_profile !== claims.profile_id || claims.product_id !== 'consubov') return false;
    if (!user.memberships.some(m => m.is_active && m.profile_id === claims.profile_id && m.tenant_id === claims.tenant_id && m.fazenda_id === claims.fazenda_id && m.retiro_id === claims.retiro_id)) return false;
    return Array.isArray(claims.permissions) && claims.permissions.includes(capability) && grant.permissions.includes(capability) && getCapabilitiesForProfile(user.primary_profile).includes(capability);
  }
  matches(claims: SyntheticJwtClaims, command: AtomicCommandEnvelope): boolean {
    return domainScope(claims) === domainScope({ ...command, session_id: claims.session_id }) && claims.device_id === command.device_id;
  }
}
