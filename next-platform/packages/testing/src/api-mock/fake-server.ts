import type { AtomicCommandEnvelope, CommandAckResponse, CommandApiResponse } from '@consubov/contracts';

/** Unit-only transport failure/version journal. It does not authenticate, apply domain reducers or prove server QA. */
export class FakeApiServer {
  private ledger = new Map<string, { envelope: string; ack: CommandAckResponse }>();
  private ids = new Map<string, string>();
  private aggregateVersions = new Map<string, number>();
  private networkPaused = false;
  private forceStatusCode: number | null = null;
  private accountScope(envelope: AtomicCommandEnvelope): string {
    return JSON.stringify([envelope.user_id, envelope.product_id, envelope.tenant_id, envelope.fazenda_id, envelope.retiro_id, envelope.profile_id]);
  }
  private aggregateKey(envelope: AtomicCommandEnvelope): string { return JSON.stringify([this.accountScope(envelope), envelope.aggregate_type, envelope.aggregate_id]); }
  setNetworkPaused(paused: boolean): void { this.networkPaused = paused; }
  setForceStatusCode(status: number | null): void { this.forceStatusCode = status; }
  getAggregateVersion(tenantId: string, aggregateType: string, aggregateId: string): number {
    const matches = [...this.aggregateVersions.entries()].filter(([key]) => { const [scope, type, id] = JSON.parse(key); return JSON.parse(scope)[2] === tenantId && type === aggregateType && id === aggregateId; });
    return Math.max(0, ...matches.map(([, version]) => version));
  }
  async handleCommand(envelope: AtomicCommandEnvelope): Promise<{ status: number; body: CommandApiResponse | { error: string } }> {
    if (this.networkPaused) throw new Error('NETWORK_UNAVAILABLE: Conexão com servidor recusada (simulação).');
    if (this.forceStatusCode) return { status: this.forceStatusCode, body: { error: `SIMULATED_HTTP_${this.forceStatusCode}` } };
    const scope = JSON.stringify([this.accountScope(envelope), envelope.device_id]);
    const key = JSON.stringify([scope, envelope.idempotency_key]), id = JSON.stringify([scope, envelope.command_id]);
    const serialized = JSON.stringify(envelope), existing = this.ledger.get(key), priorId = this.ids.get(id);
    if (existing || priorId) {
      if (existing && priorId === key && existing.envelope === serialized) return { status: 200, body: { success: true, ack: structuredClone(existing.ack) } };
      return { status: 409, body: { success: false, validation: { error: 'UNPROCESSABLE_ENTITY_422', command_id: envelope.command_id, violations: [{ field: 'idempotency_key', code: 'IDEMPOTENCY_MISMATCH', message: 'Immutable command identity/content changed.' }] } } };
    }
    const aggregate = this.aggregateKey(envelope), current = this.aggregateVersions.get(aggregate) ?? 0;
    if (envelope.base_version !== current) return { status: 409, body: { success: false, conflict: { error: 'CONFLICT_409', command_id: envelope.command_id, aggregate_id: envelope.aggregate_id, base_version: envelope.base_version, current_version: current, conflict_reason: 'Unit fake version differs.', resolution_strategy: 'MANUAL_RESOLUTION_REQUIRED' } } };
    const ack: CommandAckResponse = { command_id: envelope.command_id, status: 'COMMITTED', aggregate_id: envelope.aggregate_id, aggregate_version: current + 1, committed_at: new Date().toISOString(), correlation_id: envelope.correlation_id };
    this.aggregateVersions.set(aggregate, current + 1); this.ledger.set(key, { envelope: serialized, ack }); this.ids.set(id, key);
    return { status: 200, body: { success: true, ack: structuredClone(ack) } };
  }
  clear(): void { this.ledger.clear(); this.ids.clear(); this.aggregateVersions.clear(); this.networkPaused = false; this.forceStatusCode = null; }
}
