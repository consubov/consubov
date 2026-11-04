import {
  AtomicCommandEnvelope,
  CommandAckResponse,
  CommandConflictError
} from '@consubov/contracts';

export class FakeApiServer {
  private ledger = new Map<string, CommandAckResponse>(); // chave: tenant_id:idempotency_key
  private aggregateVersions = new Map<string, number>();  // chave: aggregate_id
  private networkPaused: boolean = false;
  private forceStatusCode: number | null = null;

  public setNetworkPaused(paused: boolean): void {
    this.networkPaused = paused;
  }

  public setForceStatusCode(status: number | null): void {
    this.forceStatusCode = status;
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

    const ledgerKey = `${envelope.tenant_id}:${envelope.idempotency_key}`;

    // 1. Verificação de Idempotência
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

    // 2. Verificação de Concorrência Otimista (OCC)
    const currentVer = this.aggregateVersions.get(envelope.aggregate_id) ?? 0;
    if (envelope.base_version !== currentVer) {
      return {
        status: 409,
        body: {
          error: 'CONFLICT_409',
          command_id: envelope.command_id,
          aggregate_id: envelope.aggregate_id,
          base_version: envelope.base_version,
          current_version: currentVer,
          conflict_reason: 'A versão base do registro divergiu no servidor.',
          resolution_strategy: 'MANUAL_RESOLUTION_REQUIRED'
        }
      };
    }

    // 3. Commit e avanço de versão
    const nextVer = currentVer + 1;
    this.aggregateVersions.set(envelope.aggregate_id, nextVer);

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
