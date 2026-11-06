import { describe, expect, it } from 'bun:test';
import type { AuthorizedContext, MembershipRecord, SyntheticUserSession } from '../src/identity/context';
import type { TokenPair } from '../src/identity/credentials';
import { ProvisionedAuthService } from '../src/service/provisioned-auth-service';
import { InMemoryProvisionedAuthStorage, type ProvisionedCredential } from '../src/storage/provisioned-auth-storage';

const membership: MembershipRecord = {
  membership_id: 'membership-capataz-1', tenant_id: 'tenant-1', tenant_nome: 'Tenant',
  fazenda_id: 'farm-1', fazenda_nome: 'Farm', retiro_id: null, retiro_nome: null,
  profile_id: 'capataz', is_active: true
};
const context: AuthorizedContext = {
  context_id: 'ctx-capataz-1', tenant_id: 'tenant-1', tenant_nome: 'Tenant', product_id: 'consubov',
  fazenda_id: 'farm-1', fazenda_nome: 'Farm', retiro_id: null, retiro_nome: null,
  profile_id: 'capataz', capabilities: ['local-data.read', 'local-data.write']
};
const token: TokenPair = { access_token: 'server-issued-access-token', refresh_token: '', token_type: 'Bearer', expires_in: 86400 };

function session(deviceId: string, activeContext: AuthorizedContext | null = null): SyntheticUserSession {
  const issued = new Date();
  return {
    session_id: 'session-server-1', user_id: 'user-1', user_name: 'Field User', user_email: 'field@example.test',
    profile_id: 'capataz', memberships: [membership], active_context: activeContext,
    issued_at: issued.toISOString(), expires_at: new Date(issued.getTime() + 86400_000).toISOString(), device_id: deviceId
  };
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('ProvisionedAuthService', () => {
  it('does not enable offline login when the host cannot complete module provisioning', async () => {
    const storage = new InMemoryProvisionedAuthStorage();
    const service = new ProvisionedAuthService({ storage,
      provisionAccount: async () => { throw new Error('Required asset unavailable'); },
      fetcher: async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        const chosen = typeof body.membership_id === 'string';
        return response({ session: session(body.device_id, chosen ? context : null), available_memberships: [membership], requires_context_selection: !chosen, ...(chosen ? { tokens: token } : {}) });
      }
    });
    await service.login({ email: 'field@example.test', password: 'long-local-passphrase' });
    expect((await service.selectContext(membership.membership_id)).success).toBe(false);
    expect(await storage.getCredential('field@example.test', await storage.getOrCreateDeviceId())).toBeNull();
    expect(service.getSessionManager().getActiveContext()).toBeNull();
  });

  it('does not provision credentials or restore context when logout occurs during module download', async () => {
    const storage = new InMemoryProvisionedAuthStorage();
    let start!: () => void;
    let finish!: () => void;
    const started = new Promise<void>(resolve => { start = resolve; });
    const download = new Promise<void>(resolve => { finish = resolve; });
    const service = new ProvisionedAuthService({ storage,
      provisionAccount: async () => { start(); await download; },
      fetcher: async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        const chosen = typeof body.membership_id === 'string';
        return response({ session: session(body.device_id, chosen ? context : null), available_memberships: [membership], requires_context_selection: !chosen, ...(chosen ? { tokens: token } : {}) });
      }
    });
    await service.login({ email: 'field@example.test', password: 'long-local-passphrase' });
    const selection = service.selectContext(membership.membership_id);
    await started;
    expect(await storage.getCredential('field@example.test', await storage.getOrCreateDeviceId())).toBeNull();
    service.logout();
    finish();
    expect((await selection).success).toBe(false);
    expect(service.getSessionManager().getSession()).toBeNull();
    expect(await storage.getCredential('field@example.test', await storage.getOrCreateDeviceId())).toBeNull();
  });

  it('requires online server validation before saving a device-bound offline verifier', async () => {
    const storage = new InMemoryProvisionedAuthStorage();
    const calls: Record<string, unknown>[] = [];
    const service = new ProvisionedAuthService({ provisionAccount: async () => {}, storage, fetcher: async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.push(body);
      const chosen = typeof body.membership_id === 'string';
      return response({
        session: session(String(body.device_id), chosen ? context : null),
        available_memberships: [membership],
        requires_context_selection: !chosen,
        ...(chosen ? { tokens: token } : {})
      });
    } });

    const firstLogin = await service.login({ email: 'field@example.test', password: 'long-local-passphrase' });
    expect(firstLogin.success).toBe(true);
    expect(firstLogin.session?.active_context).toBeNull();
    expect(await storage.getCredential('field@example.test', String(calls[0]?.device_id))).toBeNull();

    const selected = await service.selectContext(membership.membership_id);
    expect(selected.success).toBe(true);
    expect(selected.session?.active_context?.context_id).toBe(context.context_id);
    const deviceId = String(calls[1]?.device_id);
    const provisioned = await storage.getCredential('field@example.test', deviceId);
    expect(provisioned).not.toBeNull();
    expect(JSON.stringify(provisioned)).not.toContain('long-local-passphrase');
    expect(provisioned).not.toHaveProperty('session');
    expect(provisioned).not.toHaveProperty('tokens');
    expect(calls[0]?.password).toBe('long-local-passphrase');
    expect(calls[1]?.membership_id).toBe(membership.membership_id);
  });

  it('allows offline login only for a previously server-provisioned account on the same device', async () => {
    const storage = new InMemoryProvisionedAuthStorage();
    let online = true;
    const fetcher = async (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (!online) throw new TypeError('offline');
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const chosen = typeof body.membership_id === 'string';
      return response({
        session: session(String(body.device_id), chosen ? context : null),
        available_memberships: [membership], requires_context_selection: !chosen,
        ...(chosen ? { tokens: token } : {})
      });
    };
    const onlineService = new ProvisionedAuthService({ provisionAccount: async () => {}, storage, fetcher });
    await onlineService.login({ email: 'field@example.test', password: 'long-local-passphrase' });
    await onlineService.selectContext(membership.membership_id);
    online = false;

    const offlineService = new ProvisionedAuthService({ provisionAccount: async () => {}, storage, fetcher });
    const restored = await offlineService.login({ email: 'FIELD@example.test', password: 'long-local-passphrase' });
    expect(restored.success).toBe(true);
    expect(restored.session?.active_context?.context_id).toBe(context.context_id);
    expect(restored.tokens?.access_token).toBe(token.access_token);

    const unknown = await offlineService.login({ email: 'new@example.test', password: 'long-local-passphrase' });
    expect(unknown.success).toBe(false);
    expect(unknown.error).toContain('primeiro acesso exige conexão');
    const wrongPassword = await offlineService.login({ email: 'field@example.test', password: 'wrong' });
    expect(wrongPassword.success).toBe(false);
  });

  it('fails closed when the encrypted server-issued offline authorization has expired', async () => {
    const storage = new InMemoryProvisionedAuthStorage();
    const onlineService = new ProvisionedAuthService({ provisionAccount: async () => {}, storage, fetcher: async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const chosen = typeof body.membership_id === 'string';
      return response({ session: session(String(body.device_id), chosen ? context : null), available_memberships: [membership], requires_context_selection: !chosen, ...(chosen ? { tokens: token } : {}) });
    } });
    await onlineService.login({ email: 'field@example.test', password: 'long-local-passphrase' });
    await onlineService.selectContext(membership.membership_id);
    const deviceId = await storage.getOrCreateDeviceId();
    const originalNow = Date.now;
    Date.now = () => originalNow() + 25 * 60 * 60 * 1000;
    try {
      const offlineService = new ProvisionedAuthService({ provisionAccount: async () => {}, storage, fetcher: async () => { throw new TypeError('offline'); } });
      const result = await offlineService.login({ email: 'field@example.test', password: 'long-local-passphrase' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('expirada ou inválida');
      expect(await storage.getCredential('field@example.test', deviceId)).toBeNull();
    } finally {
      Date.now = originalNow;
    }
  });

  it('rejects tampered ciphertext and removes the offline grant', async () => {
    const storage = new InMemoryProvisionedAuthStorage();
    const onlineService = new ProvisionedAuthService({ provisionAccount: async () => {}, storage, fetcher: async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const chosen = typeof body.membership_id === 'string';
      return response({ session: session(String(body.device_id), chosen ? context : null), available_memberships: [membership], requires_context_selection: !chosen, ...(chosen ? { tokens: token } : {}) });
    } });
    await onlineService.login({ email: 'field@example.test', password: 'long-local-passphrase' });
    await onlineService.selectContext(membership.membership_id);
    const deviceId = await storage.getOrCreateDeviceId();
    const record = await storage.getCredential('field@example.test', deviceId);
    expect(record).not.toBeNull();
    const tampered: ProvisionedCredential = { ...record!, ciphertext: new Uint8Array(record!.ciphertext) };
    tampered.ciphertext[0] = tampered.ciphertext[0]! ^ 1;
    await storage.saveCredential(tampered);

    const offlineService = new ProvisionedAuthService({ provisionAccount: async () => {}, storage, fetcher: async () => { throw new TypeError('offline'); } });
    const result = await offlineService.login({ email: 'field@example.test', password: 'long-local-passphrase' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('alterada');
    expect(await storage.getCredential('field@example.test', deviceId)).toBeNull();
  });

  it('does not restore a session when logout races an offline credential read', async () => {
    class DelayedStorage extends InMemoryProvisionedAuthStorage {
      pause = false;
      started!: () => void;
      release!: () => void;
      readonly readStarted = new Promise<void>(resolve => { this.started = resolve; });
      private gate = new Promise<void>(resolve => { this.release = resolve; });
      override async getCredential(email: string, deviceId: string): Promise<ProvisionedCredential | null> {
        if (this.pause) { this.started(); await this.gate; }
        return super.getCredential(email, deviceId);
      }
      resume() { this.release(); }
    }
    const storage = new DelayedStorage();
    const onlineService = new ProvisionedAuthService({ provisionAccount: async () => {}, storage, fetcher: async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const chosen = typeof body.membership_id === 'string';
      return response({ session: session(String(body.device_id), chosen ? context : null), available_memberships: [membership], requires_context_selection: !chosen, ...(chosen ? { tokens: token } : {}) });
    } });
    await onlineService.login({ email: 'field@example.test', password: 'long-local-passphrase' });
    await onlineService.selectContext(membership.membership_id);

    storage.pause = true;
    const offlineService = new ProvisionedAuthService({ provisionAccount: async () => {}, storage, fetcher: async () => { throw new TypeError('offline'); } });
    const login = offlineService.login({ email: 'field@example.test', password: 'long-local-passphrase' });
    await storage.readStarted;
    offlineService.logout();
    storage.resume();
    const result = await login;
    expect(result.success).toBe(false);
    expect(offlineService.getSessionManager().getSession()).toBeNull();
  });
});

function serverFetcher(): typeof fetch {
  return async (_url, init) => {
    const body = JSON.parse(String(init?.body)), chosen = typeof body.membership_id === 'string';
    return response({ session: session(body.device_id, chosen ? context : null), available_memberships: [membership], requires_context_selection: !chosen, ...(chosen ? { tokens: token } : {}) });
  };
}
async function provisionService(storage: InMemoryProvisionedAuthStorage): Promise<ProvisionedAuthService> {
  const service = new ProvisionedAuthService({ storage, fetcher: serverFetcher(), provisionAccount: async () => {} });
  expect((await service.login({ email: 'field@example.test', password: 'long-local-passphrase' })).success).toBe(true);
  expect((await service.selectContext(membership.membership_id)).success).toBe(true);
  return service;
}
const offlineFetcher = async () => { throw new TypeError('offline transport only'); };

describe('explicit authorization suspension', () => {
  it('clears session synchronously and disables the captured grant until fresh online provisioning', async () => {
    const storage = new InMemoryProvisionedAuthStorage(), service = await provisionService(storage);
    const deviceId = await storage.getOrCreateDeviceId();
    const removal = service.suspendAuthorization();
    expect(service.getSessionManager().getSession()).toBeNull();
    expect(service.getSessionManager().getTokens()).toBeNull();
    await removal;
    expect(await storage.getCredential('field@example.test', deviceId)).toBeNull();
    const offline = new ProvisionedAuthService({ storage, fetcher: offlineFetcher });
    expect((await offline.login({ email: 'field@example.test', password: 'long-local-passphrase' })).success).toBe(false);
    await provisionService(storage);
    expect((await offline.login({ email: 'field@example.test', password: 'long-local-passphrase' })).success).toBe(true);
  });

  it('keeps a newer online credential when an older removal resumes later', async () => {
    class DelayedRemoval extends InMemoryProvisionedAuthStorage {
      entered!: () => void; release!: () => void;
      started = new Promise<void>(resolve => { this.entered = resolve; });
      gate = new Promise<void>(resolve => { this.release = resolve; });
      override async removeCredentialIfMatches(record: ProvisionedCredential): Promise<boolean> { this.entered(); await this.gate; return super.removeCredentialIfMatches(record); }
    }
    const storage = new DelayedRemoval(), old = await provisionService(storage);
    const removal = old.suspendAuthorization(); await storage.started;
    await provisionService(storage);
    const deviceId = await storage.getOrCreateDeviceId(), newer = await storage.getCredential('field@example.test', deviceId);
    storage.release(); await removal;
    expect(await storage.getCredential('field@example.test', deviceId)).toEqual(newer);
    const offline = new ProvisionedAuthService({ storage, fetcher: offlineFetcher });
    expect((await offline.login({ email: 'field@example.test', password: 'long-local-passphrase' })).success).toBe(true);
  });

  it('does not let an in-flight offline decrypt restore a grant revoked by another service', async () => {
    class PauseIntegrity extends InMemoryProvisionedAuthStorage {
      pause = false; entered!: () => void; release!: () => void;
      started = new Promise<void>(resolve => { this.entered = resolve; }); gate = new Promise<void>(resolve => { this.release = resolve; });
      override async getOrCreateIntegrityKey(deviceId: string): Promise<CryptoKey> {
        if (this.pause) { this.pause = false; this.entered(); await this.gate; }
        return super.getOrCreateIntegrityKey(deviceId);
      }
    }
    const storage = new PauseIntegrity(), online = await provisionService(storage); storage.pause = true;
    const offline = new ProvisionedAuthService({ storage, fetcher: offlineFetcher });
    const unlocking = offline.login({ email: 'field@example.test', password: 'long-local-passphrase' });
    await storage.started; await online.suspendAuthorization(); storage.release();
    expect((await unlocking).success).toBe(false);
    expect(offline.getSessionManager().getSession()).toBeNull();
  });

  it('prevents a cancelled late credential save from overwriting a fresh online grant', async () => {
    class PauseSave extends InMemoryProvisionedAuthStorage {
      pause = true; entered!: () => void; release!: () => void;
      started = new Promise<void>(resolve => { this.entered = resolve; }); gate = new Promise<void>(resolve => { this.release = resolve; });
      override async saveCredential(record: ProvisionedCredential, isCurrent: () => boolean = () => true): Promise<void> {
        if (this.pause) { this.pause = false; this.entered(); await this.gate; }
        return super.saveCredential(record, isCurrent);
      }
    }
    const storage = new PauseSave(), first = new ProvisionedAuthService({ storage, fetcher: serverFetcher(), provisionAccount: async () => {} });
    await first.login({ email: 'field@example.test', password: 'long-local-passphrase' });
    const selection = first.selectContext(membership.membership_id); await storage.started;
    await first.suspendAuthorization(); await provisionService(storage);
    const deviceId = await storage.getOrCreateDeviceId(), newer = await storage.getCredential('field@example.test', deviceId);
    storage.release(); expect((await selection).success).toBe(false);
    expect(await storage.getCredential('field@example.test', deviceId)).toEqual(newer);
  });
});
