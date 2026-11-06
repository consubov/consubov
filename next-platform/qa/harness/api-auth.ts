import { SYNTHETIC_USERS, decodeSyntheticJwt } from '@consubov/auth-client';
import type { AtomicCommandEnvelope, UserProfileId } from '@consubov/contracts';

/** Real selected-context HTTP authentication, never arbitrary signed-token grants. */
export async function loginApi(baseUrl: string, profile: UserProfileId, deviceId = 'api-suite-device', membershipIndex = 0) {
  const email = profile === 'administrador' ? 'admin.lab@consubov.local' : `${profile}.lab@consubov.local`;
  const user = SYNTHETIC_USERS[email]!;
  const response = await fetch(baseUrl + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: user.password_hash, device_id: deviceId, membership_id: user.memberships[membershipIndex]!.membership_id }) });
  if (!response.ok) throw new Error('Actual API login failed: ' + response.status);
  return await response.json();
}
/** Explicit positive fixture scope; negative tests must override AFTER applying this helper. */
export function authorizedEnvelope<T extends object>(token: string, envelope: T): T {
  const claims = decodeSyntheticJwt(token)!;
  return { ...envelope, user_id: claims.user_id, tenant_id: claims.tenant_id, product_id: claims.product_id, fazenda_id: claims.fazenda_id, retiro_id: claims.retiro_id, profile_id: claims.profile_id, device_id: claims.device_id };
}

/** Explicit server fixture, then real credential+membership login. Caller removes its unique email in teardown. */
export async function createApiTestAccount(baseUrl: string, profile: UserProfileId, fixture: { email: string; userId: string; tenantId: string; farmId: string; deviceId?: string }) {
  const template = structuredClone(SYNTHETIC_USERS[profile === 'administrador' ? 'admin.lab@consubov.local' : `${profile}.lab@consubov.local`]!);
  if (SYNTHETIC_USERS[fixture.email]) throw new Error('Refusing to overwrite an existing synthetic account');
  template.email = fixture.email; template.user_id = fixture.userId;
  const membership = { ...template.memberships[0]!, membership_id: 'test-' + fixture.userId, tenant_id: fixture.tenantId, fazenda_id: fixture.farmId, retiro_id: null, retiro_nome: null };
  template.memberships = [membership]; SYNTHETIC_USERS[fixture.email] = template;
  const response = await fetch(baseUrl + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: template.email, password: template.password_hash, membership_id: membership.membership_id, device_id: fixture.deviceId ?? 'fixture-device' }) });
  if (!response.ok) throw new Error('Server fixture login failed: ' + response.status);
  return await response.json();
}
