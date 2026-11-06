import type { AuthorizedContext, MembershipRecord, SyntheticUserSession } from '../identity/context';
import type { AuthCredentials, AuthResult, TokenPair } from '../identity/credentials';
import { SessionManager } from '../session/session-manager';
import { InMemorySessionStorage } from '../storage/session-storage';
import {
  IndexedDbProvisionedAuthStorage,
  sameProvisionedCredential,
  type IProvisionedAuthStorage,
  type ProvisionedCredential
} from '../storage/provisioned-auth-storage';

const PBKDF2_ITERATIONS = 310_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const LAB_AUTHORIZATION_POLICY = 'Lab-only local authorization expires with the server-issued 24-hour session.';

interface ApiLoginResponse {
  session: SyntheticUserSession;
  available_memberships: readonly MembershipRecord[];
  requires_context_selection: boolean;
  tokens?: TokenPair;
  initial_data?: unknown;
}

/**
 * Browser auth path. Session/grants are server-issued and encrypted at rest.
 * IndexedDB and same-origin code are within the browser origin trust boundary;
 * this protects copied/edited records, not a compromised origin or active XSS.
 */
export class ProvisionedAuthService {
  private readonly sessionManager: SessionManager;
  private readonly storage: IProvisionedAuthStorage;
  private readonly fetcher: typeof fetch;
  private readonly provisionAccount: (session: SyntheticUserSession, tokens: TokenPair, initialData: unknown, isCurrent: () => boolean) => Promise<void>;
  private pendingCredentials: { email: string; password: string; deviceId: string } | null = null;
  private loginEpoch = 0;
  private authorizedCredential: ProvisionedCredential | null = null;
  private unlockingCredential: ProvisionedCredential | null = null;
  private savingCredential: ProvisionedCredential | null = null;
  private blockedCredentials: ProvisionedCredential[] = [];

  constructor(options?: { sessionManager?: SessionManager; storage?: IProvisionedAuthStorage; fetcher?: typeof fetch; provisionAccount?: (session: SyntheticUserSession, tokens: TokenPair, initialData: unknown, isCurrent: () => boolean) => Promise<void> }) {
    this.sessionManager = options?.sessionManager ?? new SessionManager({ storage: new InMemorySessionStorage() });
    this.storage = options?.storage ?? new IndexedDbProvisionedAuthStorage();
    this.fetcher = options?.fetcher ?? fetch.bind(globalThis);
    // Auth cannot declare a device provisioned before its host has persisted the module/data.
    this.provisionAccount = options?.provisionAccount ?? (async () => { throw new Error('Provisionamento do aplicativo não configurado.'); });
  }

  getSessionManager(): SessionManager { return this.sessionManager; }

  async login(credentials: AuthCredentials): Promise<AuthResult> {
    const epoch = ++this.loginEpoch;
    const email = normalizeEmail(credentials.email);
    const password = credentials.password ?? '';
    if (!email || !password) return { success: false, error: 'Informe email e senha.' };

    let deviceId: string;
    try { deviceId = await this.storage.getOrCreateDeviceId(); }
    catch (error) { return { success: false, error: errorMessage(error, 'Armazenamento local de autenticação indisponível.') }; }
    if (epoch !== this.loginEpoch) return cancelled();

    let response: Response;
    try {
      response = await this.fetcher('/api/v1/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, device_id: deviceId })
      });
    } catch {
      return this.loginOffline(email, password, deviceId, epoch);
    }

    const parsed = await parseAuthResponse(response, email, deviceId);
    if (!parsed.success) return parsed;
    if (epoch !== this.loginEpoch) return cancelled();
    this.pendingCredentials = { email, password, deviceId };
    this.sessionManager.setSession(parsed.value.session, parsed.value.tokens ?? null);
    return {
      success: true,
      session: parsed.value.session,
      tokens: parsed.value.tokens,
      available_memberships: parsed.value.available_memberships,
      requires_context_selection: parsed.value.requires_context_selection
    };
  }

  async selectContext(membershipId: string): Promise<AuthResult> {
    const pending = this.pendingCredentials;
    if (!pending) return { success: false, error: 'Para selecionar o acesso, autentique-se novamente com conexão disponível.' };
    const epoch = this.loginEpoch;
    let response: Response;
    try {
      response = await this.fetcher('/api/v1/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pending.email, password: pending.password, device_id: pending.deviceId, membership_id: membershipId })
      });
    } catch {
      return { success: false, error: 'A seleção de acesso exige validação online.' };
    }
    const parsed = await parseAuthResponse(response, pending.email, pending.deviceId);
    if (!parsed.success) return parsed;
    const result = parsed.value;
    if (epoch !== this.loginEpoch || this.pendingCredentials !== pending) return cancelled();
    if (result.requires_context_selection || !result.session.active_context || !result.tokens?.access_token) {
      return { success: false, error: 'A API não retornou uma autorização de contexto válida.' };
    }

    try {
      await this.provisionAccount(result.session, result.tokens, result.initial_data, () => epoch === this.loginEpoch && this.pendingCredentials === pending);
      if (epoch !== this.loginEpoch || this.pendingCredentials !== pending) return cancelled();
      const credential = await createCredential(this.storage, pending.email, pending.password, pending.deviceId, result.session, result.tokens);
      if (epoch !== this.loginEpoch || this.pendingCredentials !== pending) return cancelled();
      this.savingCredential = credential;
      await this.storage.saveCredential(credential, () => epoch === this.loginEpoch && this.pendingCredentials === pending);
      if (this.savingCredential === credential) this.savingCredential = null;
      if (epoch !== this.loginEpoch || this.pendingCredentials !== pending) {
        await this.storage.removeCredentialIfMatches(credential);
        return cancelled();
      }
      this.authorizedCredential = credential;
    } catch (error) {
      return { success: false, error: errorMessage(error, 'Não foi possível provisionar autenticação offline local.') };
    }
    if (epoch !== this.loginEpoch || this.pendingCredentials !== pending) return cancelled();

    // The password exists in memory only between the two online login steps.
    this.pendingCredentials = null;
    this.sessionManager.setSession(result.session, result.tokens);
    return {
      success: true, session: result.session, tokens: result.tokens,
      available_memberships: result.available_memberships, requires_context_selection: false
    };
  }

  async switchContext(membershipId: string): Promise<AuthResult> { return this.selectContext(membershipId); }
  async refreshSession(): Promise<AuthResult> { return { success: false, error: 'A renovação de autorização exige nova validação online.' }; }

  logout(): void {
    this.loginEpoch++;
    this.pendingCredentials = null;
    this.sessionManager.clearSession();
    this.authorizedCredential = null;
    this.unlockingCredential = null;
  }

  /** Only call for an explicit server authorization rejection, never for a network failure. */
  async suspendAuthorization(): Promise<void> {
    const session = this.sessionManager.getSession();
    const email = normalizeEmail(session?.user_email ?? this.pendingCredentials?.email ?? this.unlockingCredential?.email ?? this.savingCredential?.email ?? '');
    const deviceId = session?.device_id ?? this.pendingCredentials?.deviceId ?? this.unlockingCredential?.deviceId ?? this.savingCredential?.deviceId;
    const records = [this.authorizedCredential, this.unlockingCredential, this.savingCredential].filter((record): record is ProvisionedCredential => record !== null && normalizeEmail(record.email) === email && record.deviceId === deviceId);
    this.loginEpoch++;
    this.pendingCredentials = null;
    this.authorizedCredential = null;
    this.unlockingCredential = null;
    this.sessionManager.clearSession();
    // Also deny the captured grant in this instance if a durable storage operation fails.
    this.blockedCredentials.push(...records);
    await Promise.all(records.map(record => this.storage.removeCredentialIfMatches(record)));
  }

  private async loginOffline(email: string, password: string, deviceId: string, epoch: number): Promise<AuthResult> {
    let record: ProvisionedCredential | null;
    try { record = await this.storage.getCredential(email, deviceId); }
    catch (error) { return { success: false, error: errorMessage(error, 'Não foi possível verificar a autorização offline local.') }; }
    if (epoch !== this.loginEpoch) return cancelled();
    if (!record) return { success: false, error: 'Esta conta ainda não foi provisionada neste dispositivo. O primeiro acesso exige conexão.' };
    if (this.blockedCredentials.some(blocked => sameProvisionedCredential(blocked, record))) return cancelled();
    this.unlockingCredential = record;
    if (normalizeEmail(record.email) !== email || record.deviceId !== deviceId) {
      await this.storage.removeCredentialIfMatches(record);
      return { success: false, error: 'Registro de autorização local inválido para esta conta e dispositivo.' };
    }

    const material = await derivePasswordMaterial(password, email, deviceId, record.salt);
    if (epoch !== this.loginEpoch) return cancelled();
    if (!constantTimeEqual(material.slice(0, 32), record.verifier)) {
      return { success: false, error: 'Credenciais inválidas para esta conta neste dispositivo.' };
    }

    let integrityKey: CryptoKey;
    try { integrityKey = await this.storage.getOrCreateIntegrityKey(deviceId); }
    catch (error) { return { success: false, error: errorMessage(error, 'Chave local do dispositivo indisponível.') }; }
    if (epoch !== this.loginEpoch) return cancelled();
    const intact = await crypto.subtle.verify('HMAC', integrityKey, exactArrayBuffer(record.integrity), canonicalRecord(record));
    if (!intact) {
      await this.storage.removeCredentialIfMatches(record);
      return { success: false, error: 'A autorização offline foi alterada e foi bloqueada.' };
    }

    let payload: { session: SyntheticUserSession; tokens: TokenPair };
    try {
      const encryptionKey = await crypto.subtle.importKey('raw', exactArrayBuffer(material.slice(32)), 'AES-GCM', false, ['decrypt']);
      const additionalData = new TextEncoder().encode(`${email}\u0000${deviceId}`);
      const plaintext = await crypto.subtle.decrypt({
        name: 'AES-GCM', iv: exactArrayBuffer(record.iv), additionalData
      }, encryptionKey, exactArrayBuffer(record.ciphertext));
      payload = JSON.parse(new TextDecoder().decode(plaintext)) as { session: SyntheticUserSession; tokens: TokenPair };
    } catch {
      await this.storage.removeCredentialIfMatches(record);
      return { success: false, error: 'A autorização offline foi alterada ou está corrompida.' };
    }
    if (epoch !== this.loginEpoch) return cancelled();
    if (!isFiniteAuthorization(payload.session, deviceId) || normalizeEmail(payload.session.user_email) !== email ||
        !payload.session.active_context || typeof payload.tokens?.access_token !== 'string' ||
        !hasValidContextGrant(payload.session, payload.session.active_context)) {
      await this.storage.removeCredentialIfMatches(record);
      return { success: false, error: `Autorização offline expirada ou inválida. ${LAB_AUTHORIZATION_POLICY}` };
    }
    let current: ProvisionedCredential | null;
    try { current = await this.storage.getCredential(email, deviceId); }
    catch (error) { return { success: false, error: errorMessage(error, 'Não foi possível revalidar a autorização local.') }; }
    if (epoch !== this.loginEpoch || !sameProvisionedCredential(current, record) || this.blockedCredentials.some(blocked => sameProvisionedCredential(blocked, record))) return cancelled();
    this.pendingCredentials = null;
    this.authorizedCredential = record;
    if (this.unlockingCredential === record) this.unlockingCredential = null;
    this.sessionManager.setSession(payload.session, payload.tokens);
    return {
      success: true, session: payload.session, tokens: payload.tokens,
      available_memberships: payload.session.memberships.filter(membership => membership.is_active),
      requires_context_selection: false
    };
  }
}

async function createCredential(
  storage: IProvisionedAuthStorage, email: string, password: string, deviceId: string,
  session: SyntheticUserSession, tokens: TokenPair
): Promise<ProvisionedCredential> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const material = await derivePasswordMaterial(password, email, deviceId, salt);
  const verifier = material.slice(0, 32);
  const encryptionKey = await crypto.subtle.importKey('raw', exactArrayBuffer(material.slice(32)), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = new TextEncoder().encode(`${normalizeEmail(email)}\u0000${deviceId}`);
  const plaintext = new TextEncoder().encode(JSON.stringify({ session, tokens }));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, encryptionKey, plaintext));
  const record: ProvisionedCredential = {
    email: normalizeEmail(email), deviceId, salt, verifier, iv, ciphertext,
    integrity: new Uint8Array(), storedAt: new Date().toISOString()
  };
  const integrityKey = await storage.getOrCreateIntegrityKey(deviceId);
  record.integrity = new Uint8Array(await crypto.subtle.sign('HMAC', integrityKey, canonicalRecord(record)));
  return record;
}

async function derivePasswordMaterial(password: string, email: string, deviceId: string, salt: Uint8Array): Promise<Uint8Array> {
  const input = new TextEncoder().encode(`${normalizeEmail(email)}\u0000${deviceId}\u0000${password}`);
  const key = await crypto.subtle.importKey('raw', input, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2', hash: 'SHA-256', salt: exactArrayBuffer(salt), iterations: PBKDF2_ITERATIONS
  }, key, 512);
  return new Uint8Array(bits);
}

function constantTimeEqual(actual: Uint8Array, expected: Uint8Array): boolean {
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual[i]! ^ expected[i]!;
  return difference === 0;
}

function canonicalRecord(record: ProvisionedCredential): ArrayBuffer {
  const label = new TextEncoder().encode(`${normalizeEmail(record.email)}\u0000${record.deviceId}\u0000${record.storedAt}\u0000`);
  const parts = [label, record.salt, record.verifier, record.iv, record.ciphertext];
  const bytes = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return bytes.buffer;
}

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

function isFiniteAuthorization(session: SyntheticUserSession, deviceId: string): boolean {
  const issued = Date.parse(session.issued_at);
  const expires = Date.parse(session.expires_at);
  return session.device_id === deviceId && Number.isFinite(issued) && Number.isFinite(expires) &&
    issued <= Date.now() + 60_000 && expires > Date.now() && expires > issued && expires - issued <= DAY_MS + 60_000;
}

function hasValidContextGrant(session: SyntheticUserSession, context: AuthorizedContext): boolean {
  if (context.profile_id !== session.profile_id || !Array.isArray(context.capabilities) || context.capabilities.length === 0 ||
      context.capabilities.some(capability => typeof capability !== 'string' || capability.length === 0) ||
      context.product_id !== 'consubov' || !context.context_id || !context.tenant_id || !context.fazenda_id) return false;
  return session.memberships.some(membership => membership.is_active && membership.profile_id === context.profile_id &&
    membership.tenant_id === context.tenant_id && membership.fazenda_id === context.fazenda_id && membership.retiro_id === context.retiro_id);
}

function validMembership(value: unknown, profileId: string): value is MembershipRecord {
  if (!value || typeof value !== 'object') return false;
  const item = value as MembershipRecord;
  return typeof item.membership_id === 'string' && item.membership_id.length > 0 &&
    typeof item.tenant_id === 'string' && typeof item.tenant_nome === 'string' &&
    typeof item.fazenda_id === 'string' && typeof item.fazenda_nome === 'string' &&
    (item.retiro_id === null || typeof item.retiro_id === 'string') &&
    (item.retiro_nome === null || typeof item.retiro_nome === 'string') && item.profile_id === profileId &&
    typeof item.is_active === 'boolean';
}

function normalizeEmail(email: string): string { return email.trim().toLowerCase(); }
function cancelled(): AuthResult { return { success: false, error: 'A autenticação foi cancelada.' }; }
function errorMessage(error: unknown, fallback: string): string { return error instanceof Error ? error.message : fallback; }

async function parseAuthResponse(response: Response, email: string, deviceId: string): Promise<{ success: true; value: ApiLoginResponse } | { success: false; error: string }> {
  let body: any;
  try { body = await response.json(); }
  catch { return { success: false, error: 'A API de autenticação retornou uma resposta inválida.' }; }
  if (!response.ok) return { success: false, error: typeof body?.message === 'string' ? body.message : 'Autenticação recusada pela API.' };
  if (!body?.session || !Array.isArray(body.available_memberships) || typeof body.requires_context_selection !== 'boolean') {
    return { success: false, error: 'A API de autenticação retornou dados incompletos.' };
  }
  const session = body.session as SyntheticUserSession;
  const profile = session.profile_id;
  if (normalizeEmail(String(session.user_email ?? '')) !== email || session.device_id !== deviceId ||
      !session.user_id || !session.session_id || !['capataz', 'gerente', 'escritorio', 'fabrica'].includes(profile) ||
      !isFiniteAuthorization(session, deviceId) || !Array.isArray(session.memberships) || session.memberships.length === 0 ||
      session.memberships.some(item => !validMembership(item, profile)) ||
      body.available_memberships.length === 0 ||
      body.available_memberships.some((item: unknown) => !validMembership(item, profile) || !(item as MembershipRecord).is_active)) {
    return { success: false, error: 'A API de autenticação retornou identidade, validade ou vínculos inválidos.' };
  }
  if (body.available_memberships.some((available: MembershipRecord) => !session.memberships.some(item =>
    item.membership_id === available.membership_id && item.is_active && item.tenant_id === available.tenant_id &&
    item.fazenda_id === available.fazenda_id && item.retiro_id === available.retiro_id && item.profile_id === available.profile_id))) {
    return { success: false, error: 'A API retornou vínculos disponíveis que não pertencem à sessão.' };
  }
  if (body.requires_context_selection) {
    if (session.active_context !== null || body.tokens !== undefined) return { success: false, error: 'A resposta inicial não pode conceder contexto ou token.' };
  } else {
    const context = session.active_context as AuthorizedContext | null;
    if (!context || !hasValidContextGrant(session, context) || typeof body.tokens?.access_token !== 'string' ||
        body.tokens.access_token.length < 16 || body.tokens.token_type !== 'Bearer' ||
        typeof body.tokens.expires_in !== 'number' || body.tokens.expires_in <= 0 || body.tokens.expires_in > DAY_MS / 1000 ||
        body.tokens.expires_in * 1000 > Date.parse(session.expires_at) - Date.now() + 60_000) {
      return { success: false, error: 'A API de autenticação retornou uma concessão de contexto inválida.' };
    }
  }
  return { success: true, value: body as ApiLoginResponse };
}
