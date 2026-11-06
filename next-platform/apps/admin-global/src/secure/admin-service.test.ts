import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { AdminApiService } from './admin-service';
import { createRouter } from '../../../../api/src/router';
import { InMemoryLedger } from '../../../../api/src/ledger/in-memory-ledger';
import { LabGrantRegistry } from '../../../../api/src/auth/grants';
import { SYNTHETIC_USERS, decodeSyntheticJwt, signSyntheticJwt } from '@consubov/auth-client';

const services: AdminApiService[] = [];
afterEach(() => { for (const service of services.splice(0)) service.dispose(); });
function fixture() {
  const grants = new LabGrantRegistry(), ledger = new InMemoryLedger();
  const router = createRouter(ledger, grants);
  let fault = 0, down = false, hold = false;
  let release: (() => void) | undefined;
  let observedToken = '', calls = 0;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls++;
    const url = new URL(String(input), 'http://127.0.0.1:3333');
    if (url.pathname.endsWith('/audit')) {
      observedToken = new Headers(init?.headers).get('Authorization')?.slice(7) ?? '';
      if (down) throw new TypeError('Connection refused');
      if (fault) return new Response('{}', { status: fault });
      const response = await router(new Request(url, init));
      // Deliberately ignore AbortSignal: a late transport must not restore access.
      if (hold) await new Promise<void>(resolve => { release = resolve; });
      return response;
    }
    return router(new Request(url, init));
  }) as typeof fetch;
  let frozen = false;
  const service = new AdminApiService({ fetch: fetcher, canStart: () => !frozen });
  services.push(service);
  const user = SYNTHETIC_USERS['admin.lab@consubov.local']!;
  async function authorize() {
    expect(await service.login(user.email, user.password_hash)).toBe(true);
    expect(service.getSnapshot().phase).toBe('choose-context');
    expect(await service.selectContext(service.getSnapshot().memberships[0]!.id)).toBe(true);
    expect(service.getSnapshot().phase).toBe('authorized');
  }
  async function seedAudit() {
    const operator = SYNTHETIC_USERS['capataz.lab@consubov.local']!;
    const login = await router(new Request('http://127.0.0.1/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: operator.email, password: operator.password_hash, device_id: 't06-ledger-seed', membership_id: operator.memberships[0]!.membership_id }) }));
    const token = (await login.json()).tokens.access_token, claims = decodeSyntheticJwt(token)!;
    const commandId = crypto.randomUUID();
    const response = await router(new Request('http://127.0.0.1/api/v1/commands', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({
      command_id: commandId, idempotency_key: `t06-${commandId}`, command_type: 'capataz.salga.lancar', aggregate_type: 'cocho', aggregate_id: 'pasto-01', base_version: 1,
      user_id: claims.user_id, tenant_id: claims.tenant_id, product_id: claims.product_id, fazenda_id: claims.fazenda_id, retiro_id: claims.retiro_id, profile_id: claims.profile_id, device_id: claims.device_id,
      schema_version: 1, payload: { pasto_id: 'pasto-01', produto_id: 'prod-sal-01', escore_cocho: 2, sacos_fornecidos: 5 }, correlation_id: commandId,
      attachment_refs: [], occurred_at_local: new Date().toISOString(), status: 'PENDENTE', attempts: 0, last_attempt_at: null, error_message: null
    }) }));
    expect(response.status).toBe(200); expect((await response.json()).ack.status).toBe('COMMITTED');
  }
  return { service, grants, router, authorize, seedAudit, fetcher, user,
    fault: (status: number) => { fault = status; }, down: () => { down = true; },
    hold: () => { hold = true; }, release: () => release?.(),
    freeze: () => { frozen = true; }, calls: () => calls,
    token: () => observedToken,
    pending: async () => { for (let i = 0; i < 100 && !release; i++) await Bun.sleep(1); expect(release).toBeDefined(); }
  };
}

describe('T06 candidate administrative boundary against actual local API router', () => {
  it('requires explicit membership, server grant, and audit permission; never invents super_admin', async () => {
    const f = fixture(); await f.authorize();
    expect(decodeSyntheticJwt(f.token())!.roles).toEqual(['administrador']);
    expect(f.service.getSnapshot()).not.toHaveProperty('token');
    expect(JSON.stringify(f.service.getSnapshot())).not.toContain(f.user.password_hash);
    expect(await f.service.refreshAudit()).toBe(true);
  });
  it('rejects a valid nonadministrative login and invalid membership', async () => {
    const f = fixture(), user = SYNTHETIC_USERS['capataz.lab@consubov.local']!;
    expect(await f.service.login(user.email, user.password_hash)).toBe(false);
    expect(f.service.getSnapshot().phase).toBe('signed-out');
    expect(await f.service.login(f.user.email, f.user.password_hash)).toBe(true);
    expect(await f.service.selectContext('forged-membership')).toBe(false);
    expect(f.service.getSnapshot().phase).toBe('signed-out');
  });
  it.each([401, 403])('clears an established session after audit HTTP %s', async status => {
    const f = fixture(); await f.seedAudit(); await f.authorize(); expect(f.service.getSnapshot().audit.length).toBe(1); f.fault(status);
    expect(await f.service.refreshAudit()).toBe(false);
    expect(f.service.getSnapshot()).toMatchObject({ phase: 'signed-out', audit: [], name: '', error: 'access' });
  });
  it('actual grant revocation invalidates access; a freshly signed unregistered token fails', async () => {
    const f = fixture(); await f.authorize();
    const claims = decodeSyntheticJwt(f.token())!;
    f.grants.revoke(claims.session_id);
    expect(await f.service.refreshAudit()).toBe(false);
    const forged = await signSyntheticJwt({ ...claims, session_id: crypto.randomUUID() });
    expect((await f.router(new Request('http://127.0.0.1/api/v1/admin/audit', { headers: { Authorization: `Bearer ${forged}` } }))).status).toBe(403);
  });
  it('API outage discards administrative state and prevents reuse of the old token', async () => {
    const f = fixture(); await f.seedAudit(); await f.authorize(); expect(f.service.getSnapshot().audit.length).toBe(1); f.down();
    expect(await f.service.refreshAudit()).toBe(false);
    expect(f.service.getSnapshot()).toMatchObject({ phase: 'signed-out', audit: [], name: '', error: 'unavailable' });
    const calls = f.calls(); expect(await f.service.refreshAudit()).toBe(false); expect(f.calls()).toBe(calls);
  });
  it('a response completing after logout cannot republish a session', async () => {
    const f = fixture(); await f.authorize(); f.hold();
    const pending = f.service.refreshAudit(); await f.pending();
    f.service.logout(); f.release(); expect(await pending).toBe(false);
    expect(f.service.getSnapshot()).toMatchObject({ phase: 'signed-out', audit: [], error: null });
  });
  it('expired in-memory session cannot start a new audit request', async () => {
    const f = fixture(); await f.authorize(); const calls = f.calls();
    const clock = spyOn(Date, 'now').mockReturnValue(Date.now() + 25 * 60 * 60 * 1000);
    try { expect(await f.service.refreshAudit()).toBe(false); }
    finally { clock.mockRestore(); }
    expect(f.calls()).toBe(calls); expect(f.service.getSnapshot().phase).toBe('signed-out');
  });
  it('frozen release boundary prevents any newly starting request', async () => {
    const f = fixture(); await f.authorize(); const calls = f.calls(); f.freeze();
    await expect(f.service.refreshAudit()).rejects.toThrow('Operation unavailable');
    await expect(f.service.login(f.user.email, f.user.password_hash)).rejects.toThrow('Operation unavailable');
    expect(f.calls()).toBe(calls);
  });
});
