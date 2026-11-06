import { afterEach, describe, expect, it } from 'bun:test';
import type { AuthorizedContext, MembershipRecord, SyntheticUserSession } from '../src/identity/context';
import type { TokenPair } from '../src/identity/credentials';
import { ProvisionedAuthService } from '../src/service/provisioned-auth-service';
import { IndexedDbProvisionedAuthStorage, type ProvisionedCredential } from '../src/storage/provisioned-auth-storage';

const email = 'field.browser@example.test';
const password = 'browser-test-passphrase-2026';
const membership: MembershipRecord = {
  membership_id: 'browser-membership-1', tenant_id: 'browser-tenant-1', tenant_nome: 'Browser Tenant',
  fazenda_id: 'browser-farm-1', fazenda_nome: 'Browser Farm', retiro_id: null, retiro_nome: null,
  profile_id: 'capataz', is_active: true
};
const context: AuthorizedContext = {
  context_id: 'browser-context-1', tenant_id: membership.tenant_id, tenant_nome: membership.tenant_nome,
  product_id: 'consubov', fazenda_id: membership.fazenda_id, fazenda_nome: membership.fazenda_nome,
  retiro_id: null, retiro_nome: null, profile_id: 'capataz', capabilities: ['local-data.read', 'local-data.write']
};
const tokens: TokenPair = { access_token: 'server-issued-browser-access-token', refresh_token: '', token_type: 'Bearer', expires_in: 86400 };

const databaseNames = new Set<string>();
const storages = new Set<IndexedDbProvisionedAuthStorage>();
const suite = typeof indexedDB !== 'undefined' && typeof crypto?.subtle !== 'undefined' ? describe : describe.skip;

function uniqueDatabaseName(): string {
  const name = `consubov-auth-local-test-${crypto.randomUUID()}`;
  databaseNames.add(name);
  return name;
}

function storageFor(name: string): IndexedDbProvisionedAuthStorage {
  const storage = new IndexedDbProvisionedAuthStorage({ databaseName: name });
  storages.add(storage);
  return storage;
}

function makeSession(deviceId: string, activeContext: AuthorizedContext | null): SyntheticUserSession {
  const issuedAt = new Date();
  return {
    session_id: 'browser-server-session-1', user_id: 'browser-user-1', user_name: 'Browser User', user_email: email,
    profile_id: 'capataz', memberships: [membership], active_context: activeContext,
    issued_at: issuedAt.toISOString(), expires_at: new Date(issuedAt.getTime() + 86_400_000).toISOString(), device_id: deviceId
  };
}

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

function onlineFetcher(): typeof fetch {
  return async (_url, init) => {
    const request = JSON.parse(String(init?.body)) as { device_id: string; membership_id?: string };
    const selected = Boolean(request.membership_id);
    return response({
      session: makeSession(request.device_id, selected ? context : null),
      available_memberships: [membership], requires_context_selection: !selected,
      ...(selected ? { tokens } : {})
    });
  };
}

function offlineFetcher(): typeof fetch {
  return async () => { throw new TypeError('browser is offline'); };
}

async function provision(name: string): Promise<void> {
  const service = new ProvisionedAuthService({ provisionAccount: async () => {}, storage: storageFor(name), fetcher: onlineFetcher() });
  const first = await service.login({ email, password });
  expect(first.success).toBe(true);
  expect(first.session?.active_context).toBeNull();
  const selected = await service.selectContext(membership.membership_id);
  expect(selected.success).toBe(true);
  expect(selected.session?.active_context?.context_id).toBe(context.context_id);
}

async function deleteExactDatabase(name: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(`Timed out deleting exact test database ${name}.`)), 5000);
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => { window.clearTimeout(timeout); resolve(); };
    request.onerror = () => { window.clearTimeout(timeout); reject(request.error ?? new Error(`Could not delete test database ${name}.`)); };
    // IDBDatabase.close() waits for active transactions; deletion may unblock asynchronously.
    request.onblocked = () => {};
  });
}

afterEach(async () => {
  for (const storage of storages) await storage.close();
  storages.clear();
  for (const name of databaseNames) await deleteExactDatabase(name);
  databaseNames.clear();
});

suite('real browser ProvisionedAuthService with IndexedDB storage', () => {
  it('provisions online and restores offline from a fresh storage and service instance', async () => {
    const name = uniqueDatabaseName();
    await provision(name);

    const reloadedStorage = storageFor(name);
    const reloadedService = new ProvisionedAuthService({ provisionAccount: async () => {}, storage: reloadedStorage, fetcher: offlineFetcher() });
    const result = await reloadedService.login({ email: email.toUpperCase(), password });
    expect(result.success).toBe(true);
    expect(result.session?.active_context?.context_id).toBe(context.context_id);
    expect(result.tokens?.access_token).toBe(tokens.access_token);
    expect(reloadedService.getSessionManager().getSession()?.device_id).toBe(result.session?.device_id);
  });

  it('rejects an unseen account while offline', async () => {
    const name = uniqueDatabaseName();
    await provision(name);
    const service = new ProvisionedAuthService({ provisionAccount: async () => {}, storage: storageFor(name), fetcher: offlineFetcher() });
    const result = await service.login({ email: 'unseen.browser@example.test', password });
    expect(result.success).toBe(false);
    expect(result.error).toContain('primeiro acesso exige conexão');
  });

  it('rejects a wrong password against the persisted browser credential', async () => {
    const name = uniqueDatabaseName();
    await provision(name);
    const service = new ProvisionedAuthService({ provisionAccount: async () => {}, storage: storageFor(name), fetcher: offlineFetcher() });
    const result = await service.login({ email, password: 'incorrect-browser-password' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Credenciais inválidas');
  });

  it('rejects and removes a credential whose persisted ciphertext was tampered with', async () => {
    const name = uniqueDatabaseName();
    await provision(name);
    const tamperStorage = storageFor(name);
    const deviceId = await tamperStorage.getOrCreateDeviceId();
    const credential = await tamperStorage.getCredential(email, deviceId);
    expect(credential).not.toBeNull();
    const tampered: ProvisionedCredential = { ...credential!, ciphertext: new Uint8Array(credential!.ciphertext) };
    tampered.ciphertext[0] = tampered.ciphertext[0]! ^ 1;
    await tamperStorage.saveCredential(tampered);

    const reloadedService = new ProvisionedAuthService({ provisionAccount: async () => {}, storage: storageFor(name), fetcher: offlineFetcher() });
    const result = await reloadedService.login({ email, password });
    expect(result.success).toBe(false);
    expect(result.error).toContain('alterada');
    expect(await storageFor(name).getCredential(email, deviceId)).toBeNull();
  });
});

async function authorizedService(storage: IndexedDbProvisionedAuthStorage): Promise<ProvisionedAuthService> {
  const service = new ProvisionedAuthService({ storage, fetcher: onlineFetcher(), provisionAccount: async () => {} });
  expect((await service.login({ email, password })).success).toBe(true);
  expect((await service.selectContext(membership.membership_id)).success).toBe(true);
  return service;
}

suite('explicit server rejection revokes only the captured IndexedDB authorization', () => {
  it('clears authorization immediately, blocks offline reuse and preserves operational bytes', async () => {
    const name = uniqueDatabaseName(), storage = storageFor(name), service = await authorizedService(storage);
    const operationalName = uniqueDatabaseName();
    const operational = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(operationalName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('pending-work', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      // Match LocalDataAPI's durable ArrayBuffer representation (it reconstructs Blob on read).
      const photoBytes = await new Blob(['photo-binary']).arrayBuffer();
      await new Promise<void>((resolve, reject) => {
        const tx = operational.transaction('pending-work', 'readwrite');
        tx.objectStore('pending-work').put({ id: 'command-1', pending: true, bytes: photoBytes });
        tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
      });
      const revoking = service.suspendAuthorization();
      expect(service.getSessionManager().getSession()).toBeNull();
      expect(service.getSessionManager().getTokens()).toBeNull();
      await revoking;
      const offline = new ProvisionedAuthService({ storage: storageFor(name), fetcher: offlineFetcher() });
      expect((await offline.login({ email, password })).success).toBe(false);
      const work = await new Promise<{ pending: boolean; bytes: ArrayBuffer }>((resolve, reject) => {
        const request = operational.transaction('pending-work', 'readonly').objectStore('pending-work').get('command-1');
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      expect(work.pending).toBe(true); expect(await new Blob([work.bytes]).text()).toBe('photo-binary');
      await authorizedService(storageFor(name));
      expect((await offline.login({ email, password })).success).toBe(true);
    } finally { operational.close(); }
  });

  it('uses an atomic record comparison so delayed revocation preserves a newer online grant', async () => {
    class DelayedRemoval extends IndexedDbProvisionedAuthStorage {
      entered!: () => void; release!: () => void;
      started = new Promise<void>(resolve => { this.entered = resolve; }); gate = new Promise<void>(resolve => { this.release = resolve; });
      override async removeCredentialIfMatches(record: ProvisionedCredential): Promise<boolean> { this.entered(); await this.gate; return super.removeCredentialIfMatches(record); }
    }
    const name = uniqueDatabaseName(), oldStorage = new DelayedRemoval({ databaseName: name }); storages.add(oldStorage);
    const old = await authorizedService(oldStorage), removal = old.suspendAuthorization(); await oldStorage.started;
    const newStorage = storageFor(name); await authorizedService(newStorage);
    const deviceId = await newStorage.getOrCreateDeviceId(), newer = await newStorage.getCredential(email, deviceId);
    oldStorage.release(); await removal;
    expect(await newStorage.getCredential(email, deviceId)).toEqual(newer);
    const offline = new ProvisionedAuthService({ storage: storageFor(name), fetcher: offlineFetcher() });
    expect((await offline.login({ email, password })).success).toBe(true);
  });

  it('revalidates the durable record after decrypt when another service revoked it during unlock', async () => {
    class PauseIntegrity extends IndexedDbProvisionedAuthStorage {
      entered!: () => void; release!: () => void;
      started = new Promise<void>(resolve => { this.entered = resolve; }); gate = new Promise<void>(resolve => { this.release = resolve; });
      override async getOrCreateIntegrityKey(deviceId: string): Promise<CryptoKey> { this.entered(); await this.gate; return super.getOrCreateIntegrityKey(deviceId); }
    }
    const name = uniqueDatabaseName(), online = await authorizedService(storageFor(name));
    const delayed = new PauseIntegrity({ databaseName: name }); storages.add(delayed);
    const offline = new ProvisionedAuthService({ storage: delayed, fetcher: offlineFetcher() });
    const unlocking = offline.login({ email, password }); await delayed.started;
    await online.suspendAuthorization(); delayed.release();
    expect((await unlocking).success).toBe(false);
    expect(offline.getSessionManager().getSession()).toBeNull();
  });
});
