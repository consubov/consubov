import type { AtomicCommandEnvelope, AttachmentRef, CommandAckResponse, CommandApiResponse, SyncPullResponse } from '@consubov/contracts';
import type { SyntheticJwtClaims } from '@consubov/auth-client';
import { applyModuleCommand, getProjectionVersion, toModuleSnapshot, SUPPORTED_COMMANDS } from '@consubov/domain-projection';
import { domainScope, type GrantScope } from '../auth/grants';

type ModuleId = 'capataz' | 'gerente' | 'escritorio' | 'fabrica';
export type CommandAck = CommandAckResponse;
export interface StoredCommandRecord { envelope: AtomicCommandEnvelope; ack: CommandAck; stored_at: string }
export interface CommandLogFilter { tenant_id?: string; user_id?: string; profile_id?: string; command_type?: string; start_date?: string; end_date?: string; status?: string }
interface DomainState { state: Record<string, unknown>; revision: number; modifiedAt: string; events: { revision: number; data: Record<string, unknown>; modifiedAt: string }[] }
interface Attachment { ref: AttachmentRef; bytes: Uint8Array }
type Result = { success: true; ack: CommandAck } | { success: false; status: number; error: CommandApiResponse };
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => JSON.stringify(key) + ':' + canonical(item)).join(',') + '}';
  return JSON.stringify(value);
};

/** Transactional process-memory simulator; a future central adapter must provide durable commits. */
export class InMemoryLedger {
  private commandsById = new Map<string, StoredCommandRecord>();
  private commandsByIdempotency = new Map<string, StoredCommandRecord>();
  private domains = new Map<string, DomainState>();
  private attachments = new Map<string, Attachment>();
  private cursors = new Map<string, { scope: string; offset: number }>();

  initialize(scope: GrantScope, data: Record<string, unknown>, modifiedAt: string): void {
    const key = domainScope(scope);
    if (!this.domains.has(key)) this.domains.set(key, { state: structuredClone(data), revision: 0, modifiedAt, events: [] });
  }
  currentSnapshot(scope: GrantScope): { data: Record<string, unknown>; version: number; modifiedAt: string } | null {
    const domain = this.domains.get(domainScope(scope));
    return domain ? { data: structuredClone(domain.state), version: domain.revision, modifiedAt: domain.modifiedAt } : null;
  }
  getAggregateVersion(tenantId: string, aggregateType: string, aggregateId: string): number {
    const records = [...this.commandsById.values()].filter(r => r.envelope.tenant_id === tenantId && r.envelope.aggregate_type === aggregateType && r.envelope.aggregate_id === aggregateId);
    return Math.max(0, ...records.map(r => r.ack.aggregate_version));
  }
  queryLogs(filter: CommandLogFilter = {}): StoredCommandRecord[] {
    return structuredClone([...this.commandsById.values()].filter(r =>
      (!filter.tenant_id || r.envelope.tenant_id === filter.tenant_id) && (!filter.user_id || r.envelope.user_id === filter.user_id) &&
      (!filter.profile_id || r.envelope.profile_id === filter.profile_id) && (!filter.command_type || r.envelope.command_type === filter.command_type) &&
      (!filter.start_date || r.stored_at >= filter.start_date) && (!filter.end_date || r.stored_at <= filter.end_date) &&
      (!filter.status || r.ack.status.toLowerCase() === filter.status.toLowerCase())
    ).sort((a, b) => b.stored_at.localeCompare(a.stored_at)));
  }
  putAttachment(scope: GrantScope, ref: AttachmentRef, bytes: Uint8Array): boolean {
    const key = JSON.stringify([domainScope(scope), ref.attachment_id]);
    const existing = this.attachments.get(key);
    if (existing) return canonical(existing.ref) === canonical(ref);
    this.attachments.set(key, { ref: structuredClone(ref), bytes: bytes.slice() });
    return true;
  }
  getAttachment(scope: GrantScope, id: string): Attachment | null {
    // Attachment content follows account domain scope across authorized devices.
    for (const [key, attachment] of this.attachments) {
      const [domain, attachmentId] = JSON.parse(key) as string[];
      if (domain === domainScope(scope) && attachmentId === id) return { ref: structuredClone(attachment.ref), bytes: attachment.bytes.slice() };
    }
    return null;
  }
  attachmentRefs(scope: GrantScope, snapshots: Record<string, unknown>[]): AttachmentRef[] {
    const referenced = new Set<string>();
    for (const snapshot of snapshots) {
      const state = snapshot.schema === 'escritorio-state-v1' ? snapshot.state as Record<string, unknown> : snapshot;
      const photos = state?.fotos;
      if (photos && typeof photos === 'object') for (const photo of Object.values(photos)) {
        if (photo && typeof photo === 'object' && 'attachment_id' in photo && typeof photo.attachment_id === 'string') referenced.add(photo.attachment_id);
      }
    }
    return [...this.attachments.entries()].filter(([key, attachment]) => JSON.parse(key)[0] === domainScope(scope) && referenced.has(attachment.ref.attachment_id)).map(([, attachment]) => structuredClone(attachment.ref));
  }
  processCommand(envelope: AtomicCommandEnvelope): Result {
    const scope = { ...envelope, session_id: '' };
    const domainKey = domainScope(scope);
    const identityKey = JSON.stringify([domainKey, envelope.device_id]);
    const idKey = JSON.stringify([identityKey, envelope.command_id]);
    const idemKey = JSON.stringify([identityKey, envelope.idempotency_key]);
    const oldId = this.commandsById.get(idKey), oldKey = this.commandsByIdempotency.get(idemKey);
    const validation = (code: string, field: string, message: string, status = 422): Result => ({ success: false, status, error: { success: false, validation: { error: 'UNPROCESSABLE_ENTITY_422', command_id: envelope.command_id, violations: [{ field, message, code }] } } });
    if (oldId || oldKey) {
      if (oldId && oldId === oldKey && canonical(oldId.envelope) === canonical(envelope)) return { success: true, ack: structuredClone(oldId.ack) };
      return validation('IDEMPOTENCY_MISMATCH', 'idempotency_key', 'Command identity or immutable content differs from the committed command.', 409);
    }
    if (!SUPPORTED_COMMANDS.includes(envelope.command_type)) return validation('UNSUPPORTED_COMMAND', 'command_type', 'No domain projection exists for this command.');
    const domain = this.domains.get(domainKey);
    if (!domain) return validation('CONTEXT_NOT_PROVISIONED', 'profile_id', 'An authorized initial context is required.');
    for (const ref of envelope.attachment_refs) {
      const stored = this.attachments.get(JSON.stringify([domainKey, ref.attachment_id]));
      if (!stored || canonical(ref) !== canonical(stored.ref)) return validation('ATTACHMENT_NOT_PERSISTED', 'attachment_refs', 'Attachment dependency is missing or differs.');
    }
    const photoId = envelope.payload.foto_attachment_id;
    for (const attachmentId of [photoId, envelope.payload.foto_conclusao_attachment_id]) {
      if (attachmentId && !envelope.attachment_refs.some(ref => ref.attachment_id === attachmentId)) return validation('ATTACHMENT_NOT_REFERENCED', 'attachment_refs', 'Photo requires its persisted attachment reference.');
    }
    const metadata = envelope.payload.photo_metadata as Record<string, unknown> | undefined;
    const photoRef = envelope.attachment_refs.find(ref => ref.attachment_id === photoId);
    if (metadata && photoRef && (metadata.compressedSizeBytes !== photoRef.size_bytes || metadata.mimeType !== photoRef.mime_type || (metadata.pastoId && metadata.pastoId !== envelope.payload.pasto_id))) return validation('ATTACHMENT_METADATA_MISMATCH', 'payload', 'Photo metadata differs from its verified attachment or pasture.');
    const moduleId = envelope.profile_id as ModuleId;
    const currentVersion = getProjectionVersion(domain.state, moduleId, envelope.aggregate_id);
    if (currentVersion !== envelope.base_version) return { success: false, status: 409, error: { success: false, conflict: {
      error: 'CONFLICT_409', command_id: envelope.command_id, aggregate_id: envelope.aggregate_id, base_version: envelope.base_version,
      current_version: currentVersion, conflict_reason: 'Aggregate version differs from the committed projection.', resolution_strategy: 'MANUAL_RESOLUTION_REQUIRED'
    } } };
    let state: Record<string, unknown>;
    try { state = toModuleSnapshot(applyModuleCommand(moduleId, domain.state, envelope), moduleId); }
    catch (error) { return validation((error as { code?: string }).code ?? 'INVALID_DOMAIN_PAYLOAD', 'payload', 'Command cannot be applied to the existing domain projection.'); }
    const timestamp = new Date().toISOString();
    const ack: CommandAck = { command_id: envelope.command_id, status: 'COMMITTED', aggregate_id: envelope.aggregate_id, aggregate_version: currentVersion + 1, committed_at: timestamp, correlation_id: envelope.correlation_id };
    const record = { envelope: structuredClone(envelope), ack, stored_at: timestamp };
    // All validation/projection work completed before this synchronous, non-awaiting commit boundary.
    const revision = domain.revision + 1;
    const next = { state, revision, modifiedAt: timestamp, events: [{ revision, data: structuredClone(state), modifiedAt: timestamp }] };
    this.domains.set(domainKey, next);
    this.commandsById.set(idKey, record);
    this.commandsByIdempotency.set(idemKey, record);
    return { success: true, ack: structuredClone(ack) };
  }
  pull(claims: SyntheticJwtClaims, since: string | null, limit: number): SyncPullResponse | null {
    const scope = JSON.stringify([domainScope(claims), claims.device_id, claims.session_id]);
    const cursor = since ? this.cursors.get(since) : undefined;
    if (since && (!cursor || cursor.scope !== scope)) return null;
    const domain = this.domains.get(domainScope(claims));
    const offset = cursor?.offset ?? 0;
    const events = domain?.events.filter(event => event.revision > offset) ?? [];
    // Every event is a complete projection. Replaying older pages after a fresh
    // login could roll a device backwards from its newer server-issued seed.
    const page = events.slice(-Math.min(limit, 1));
    const nextOffset = page.at(-1)?.revision ?? offset;
    const nextCursor = crypto.randomUUID();
    this.cursors.set(nextCursor, { scope, offset: nextOffset });
    return { tenant_id: claims.tenant_id, fazenda_id: claims.fazenda_id, next_cursor: nextCursor, has_more: false, deltas: page.map(event => ({
      delta_id: 'module-revision-' + event.revision, aggregate_type: 'module-state', aggregate_id: 'bootstrap', operation: 'UPSERT', version: event.revision, data: structuredClone(event.data), modified_at: event.modifiedAt
    })), attachment_refs: this.attachmentRefs(claims, page.map(event => event.data)), server_timestamp: new Date().toISOString() };
  }
  clear(): void { this.commandsById.clear(); this.commandsByIdempotency.clear(); this.domains.clear(); this.attachments.clear(); this.cursors.clear(); }
}
