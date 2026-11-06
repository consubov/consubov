export interface AdminMembership { id: string; name: string; tenantId: string; farmId: string; retreatId: string | null }
export interface AdminAuditRow { commandId: string; commandType: string; tenantId: string; userId: string; profileId: string; status: string; storedAt: string }
export interface AdminAccessState {
  phase: 'signed-out' | 'choose-context' | 'authorized'; busy: boolean;
  name: string; memberships: readonly AdminMembership[]; audit: readonly AdminAuditRow[];
  error: 'access' | 'unavailable' | 'expired' | null;
}
type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid response');
  return value as JsonObject;
};
const text = (value: unknown, max = 256): string => {
  if (typeof value !== 'string' || !value.length || value.length > max) throw new Error('Invalid field');
  return value;
};
const uuid = (value: unknown) => { const result = text(value); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) throw new Error('Invalid identity'); return result; };
const list = (value: unknown, max: number): unknown[] => { if (!Array.isArray(value) || value.length > max) throw new Error('Invalid list'); return value; };
const date = (value: unknown) => { const result = text(value); if (!Number.isFinite(Date.parse(result))) throw new Error('Invalid date'); return result; };
const empty = (error: AdminAccessState['error'] = null): AdminAccessState => ({ phase: 'signed-out', busy: false, name: '', memberships: [], audit: [], error });
class AccessError extends Error {}

/** Administrative access is online and server-authorized. No credential, token,
 * audit response or synthetic role is restored from browser persistence. */
export class AdminApiService {
  private state = empty();
  private readonly listeners = new Set<() => void>();
  private readonly requests = new Set<AbortController>();
  private readonly deviceId = crypto.randomUUID();
  private epoch = 0;
  private token: string | null = null;
  private expiresAt = 0;
  private pending: { email: string; password: string; memberships: AdminMembership[]; expiresAt: number } | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;
  constructor(private readonly options: { fetch?: typeof fetch; canStart?: () => boolean } = {}) {}
  getSnapshot = (): AdminAccessState => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(state: AdminAccessState) { this.state = state; this.listeners.forEach(listener => listener()); }
  private current(epoch: number) { if (epoch !== this.epoch) throw new DOMException('Access ended', 'AbortError'); }
  private allowed() { if (this.state.busy || this.options.canStart?.() === false) throw new Error('Operation unavailable'); }
  private clear(error: AdminAccessState['error'] = null) {
    this.epoch++; clearTimeout(this.expiryTimer);
    for (const request of this.requests) request.abort();
    this.requests.clear(); this.pending = null; this.token = null; this.expiresAt = 0;
    this.publish(empty(error));
  }
  logout = () => this.clear();
  dispose = () => { this.clear(); this.listeners.clear(); };
  private async request(path: string, init: RequestInit, epoch: number): Promise<JsonObject> {
    this.current(epoch);
    const controller = new AbortController(); this.requests.add(controller);
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await (this.options.fetch ?? fetch)(path, { ...init, signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'error' });
      this.current(epoch);
      if (response.status === 401 || response.status === 403) throw new AccessError();
      if (!response.ok || !response.body) throw new Error('API unavailable');
      const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
      for (;;) {
        const result = await reader.read(); this.current(epoch);
        if (result.done) break;
        size += result.value.byteLength;
        if (size > 4 * 1024 * 1024) { await reader.cancel(); throw new Error('Response too large'); }
        chunks.push(result.value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return object(JSON.parse(new TextDecoder().decode(bytes)));
    } finally { clearTimeout(timer); this.requests.delete(controller); }
  }
  private parseIdentity(body: JsonObject, email: string): { session: JsonObject; memberships: AdminMembership[] } {
    const session = object(body.session);
    if (session.profile_id !== 'administrador' || text(session.user_email).toLowerCase() !== email || session.device_id !== this.deviceId ||
        Date.parse(date(session.expires_at)) <= Date.now() || Date.parse(date(session.issued_at)) > Date.now() + 60000) throw new AccessError();
    uuid(session.user_id); text(session.session_id); text(session.user_name);
    const memberships = list(body.available_memberships, 100).map(value => {
      const member = object(value);
      if (member.profile_id !== 'administrador' || member.is_active !== true) throw new AccessError();
      return { id: text(member.membership_id), name: text(member.tenant_nome), tenantId: uuid(member.tenant_id), farmId: uuid(member.fazenda_id), retreatId: member.retiro_id === null ? null : uuid(member.retiro_id) };
    });
    if (!memberships.length || new Set(memberships.map(member => member.id)).size !== memberships.length) throw new AccessError();
    return { session, memberships };
  }
  private armExpiry(expiresAt: number) {
    clearTimeout(this.expiryTimer);
    this.expiryTimer = setTimeout(() => this.clear('expired'), Math.max(0, Math.min(expiresAt - Date.now(), 2147483647)));
  }
  async login(emailInput: string, password: string): Promise<boolean> {
    this.allowed(); this.clear(); const epoch = this.epoch, email = emailInput.trim().toLowerCase();
    this.publish({ ...empty(), busy: true });
    try {
      if (!email || email.length > 254 || !password || password.length > 1024) throw new AccessError();
      const body = await this.request('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, device_id: this.deviceId }) }, epoch);
      const { session, memberships } = this.parseIdentity(body, email);
      if (body.requires_context_selection !== true || session.active_context !== null || body.tokens !== undefined) throw new AccessError();
      this.current(epoch);
      const expiresAt = Math.min(Date.parse(String(session.expires_at)), Date.now() + 5 * 60000);
      this.pending = { email, password, memberships, expiresAt }; this.armExpiry(expiresAt);
      this.publish({ ...empty(), phase: 'choose-context', name: String(session.user_name), memberships });
      return true;
    } catch (error) { if (epoch === this.epoch) this.clear(error instanceof AccessError ? 'access' : 'unavailable'); return false; }
  }
  private parseAudit(body: JsonObject): AdminAuditRow[] {
    const logs = list(body.logs, 2000);
    if (!Number.isSafeInteger(body.total) || body.total !== logs.length) throw new Error('Invalid audit result');
    return logs.map(value => {
      const row = object(value), envelope = object(row.envelope), ack = object(row.ack);
      const commandId = uuid(envelope.command_id);
      if (ack.command_id !== commandId || ack.status !== 'COMMITTED') throw new Error('Invalid audit acknowledgement');
      return { commandId, commandType: text(envelope.command_type), tenantId: uuid(envelope.tenant_id), userId: uuid(envelope.user_id), profileId: text(envelope.profile_id), status: 'COMMITTED', storedAt: date(row.stored_at) };
    });
  }
  async selectContext(membershipId: string): Promise<boolean> {
    this.allowed(); const pending = this.pending, epoch = this.epoch;
    if (!pending || pending.expiresAt <= Date.now() || !pending.memberships.some(member => member.id === membershipId)) { this.clear('access'); return false; }
    this.publish({ ...this.state, busy: true, error: null });
    try {
      const body = await this.request('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: pending.email, password: pending.password, device_id: this.deviceId, membership_id: membershipId }) }, epoch);
      const { session, memberships } = this.parseIdentity(body, pending.email), context = object(session.active_context), tokens = object(body.tokens);
      const member = memberships.find(item => item.id === membershipId);
      if (!member || body.requires_context_selection !== false || context.profile_id !== 'administrador' || context.product_id !== 'consubov' ||
          context.tenant_id !== member.tenantId || context.fazenda_id !== member.farmId || context.retiro_id !== member.retreatId ||
          !list(context.capabilities, 100).includes('audit:view') || tokens.token_type !== 'Bearer') throw new AccessError();
      const token = text(tokens.access_token, 16384), expiresAt = Date.parse(String(session.expires_at));
      const audit = this.parseAudit(await this.request('/api/v1/admin/audit', { headers: { Authorization: `Bearer ${token}` } }, epoch));
      this.current(epoch);
      if (Date.now() >= expiresAt) throw new AccessError();
      this.token = token; this.expiresAt = expiresAt; this.pending = null; this.armExpiry(expiresAt);
      this.publish({ phase: 'authorized', busy: false, name: String(session.user_name), memberships: [], audit, error: null });
      return true;
    } catch (error) { if (epoch === this.epoch) this.clear(error instanceof AccessError ? 'access' : 'unavailable'); return false; }
  }
  async refreshAudit(): Promise<boolean> {
    this.allowed(); const epoch = this.epoch, token = this.token;
    if (!token || this.state.phase !== 'authorized' || Date.now() >= this.expiresAt) { this.clear('expired'); return false; }
    this.publish({ ...this.state, busy: true, error: null });
    try {
      const audit = this.parseAudit(await this.request('/api/v1/admin/audit', { headers: { Authorization: `Bearer ${token}` } }, epoch));
      this.current(epoch); if (Date.now() >= this.expiresAt) throw new AccessError();
      this.publish({ ...this.state, busy: false, audit }); return true;
    } catch (error) { if (epoch === this.epoch) this.clear(error instanceof AccessError ? 'access' : 'unavailable'); return false; }
  }
}
