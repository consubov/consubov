import {
  AtomicCommandEnvelope,
  CommandAckResponse,
  CommandConflictError
} from '@consubov/contracts';

export class FakeApiServer {
  // Chave canônica: `${tenant_id}::${idempotency_key}`
  private ledger = new Map<string, CommandAckResponse>();

  // Chave canônica: `${tenant_id}::${aggregate_type}::${aggregate_id}`
  private aggregateVersions = new Map<string, number>();

  private networkPaused: boolean = false;
  private forceStatusCode: number | null = null;

  private getIdempotencyKey(tenantId: string, idempotencyKey: string): string {
    return `${tenantId}::${idempotencyKey}`;
  }

  private getAggregateKey(tenantId: string, aggregateType: string, aggregateId: string): string {
    return `${tenantId}::${aggregateType}::${aggregateId}`;
  }

  public setNetworkPaused(paused: boolean): void {
    this.networkPaused = paused;
  }

  public setForceStatusCode(status: number | null): void {
    this.forceStatusCode = status;
  }

  public getAggregateVersion(tenantId: string, aggregateType: string, aggregateId: string): number {
    const key = this.getAggregateKey(tenantId, aggregateType, aggregateId);
    return this.aggregateVersions.get(key) ?? 0;
  }

  public async handleCommand(envelope: AtomicCommandEnvelope): Promise<
    | { status: 200; body: CommandAckResponse }
    | { status: 409; body: CommandConflictError }
    | { status: number; body: { error: string } }
  > {
    if (this.networkPaused) {
      throw new Error('NETWORK_UNAVAILABLE: Conexão com servidor recusada (simulação).');
    }

    if (this.forceStatusCode) {
      return {
        status: this.forceStatusCode,
        body: { error: `SIMULATED_HTTP_${this.forceStatusCode}` }
      };
    }

    const ledgerKey = this.getIdempotencyKey(envelope.tenant_id, envelope.idempotency_key);

    // 1. Verificação de Idempotência Particionada por Tenant
    if (this.ledger.has(ledgerKey)) {
      const stored = this.ledger.get(ledgerKey)!;
      return {
        status: 200,
        body: {
          ...stored,
          idempotent_replay: true
        }
      };
    }

    // 2. Verificação de Concorrência Otimista (OCC) Particionada por Tenant
    const aggKey = this.getAggregateKey(
      envelope.tenant_id,
      envelope.aggregate_type,
      envelope.aggregate_id
    );
    const currentVer = this.aggregateVersions.get(aggKey) ?? 0;

    if (envelope.base_version !== currentVer) {
      return {
        status: 409,
        body: {
          error: 'CONFLICT_409',
          command_id: envelope.command_id,
          aggregate_id: envelope.aggregate_id,
          base_version: envelope.base_version,
          current_version: currentVer,
          conflict_reason: `A versão base do registro divergiu no servidor para o tenant ${envelope.tenant_id}. Esperada: ${currentVer}, Recebida: ${envelope.base_version}`,
          resolution_strategy: 'MANUAL_RESOLUTION_REQUIRED'
        }
      };
    }

    // 3. Commit e avanço de versão isolado para este tenant
    const nextVer = currentVer + 1;
    this.aggregateVersions.set(aggKey, nextVer);

    const ack: CommandAckResponse = {
      command_id: envelope.command_id,
      status: 'COMMITTED',
      aggregate_id: envelope.aggregate_id,
      aggregate_version: nextVer,
      committed_at: new Date().toISOString(),
      correlation_id: envelope.correlation_id,
      idempotent_replay: false
    };

    this.ledger.set(ledgerKey, ack);

    return { status: 200, body: ack };
  }

  public clear(): void {
    this.ledger.clear();
    this.aggregateVersions.clear();
    this.networkPaused = false;
    this.forceStatusCode = null;
  }
}
