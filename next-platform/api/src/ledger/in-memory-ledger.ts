import { AtomicCommandEnvelope } from '@consubov/contracts';

export interface CommandAck {
  command_id: string;
  status: 'acked';
  idempotent_replay: boolean;
  server_received_at: string;
  aggregate_type: string;
  aggregate_id: string;
  new_version: number;
}

export interface StoredCommandRecord {
  envelope: AtomicCommandEnvelope;
  ack: CommandAck;
  stored_at: string;
}

export interface CommandLogFilter {
  tenant_id?: string;
  user_id?: string;
  profile_id?: string;
  command_type?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
}

export class InMemoryLedger {
  private commandsById = new Map<string, StoredCommandRecord>();
  private commandsByIdempotency = new Map<string, StoredCommandRecord>();
  private aggregateVersions = new Map<string, number>();

  private getCompositeKey(tenantId: string, idempotencyKey: string): string {
    return `${tenantId}::${idempotencyKey}`;
  }

  private getAggregateKey(tenantId: string, aggregateType: string, aggregateId: string): string {
    return `${tenantId}::${aggregateType}::${aggregateId}`;
  }

  public getAggregateVersion(tenantId: string, aggregateType: string, aggregateId: string): number {
    const key = this.getAggregateKey(tenantId, aggregateType, aggregateId);
    return this.aggregateVersions.get(key) ?? 0;
  }

  public queryLogs(filter?: CommandLogFilter): StoredCommandRecord[] {
    let records = Array.from(this.commandsById.values());

    if (filter) {
      if (filter.tenant_id) {
        records = records.filter(r => r.envelope.tenant_id === filter.tenant_id);
      }
      if (filter.user_id) {
        records = records.filter(r => r.envelope.user_id === filter.user_id);
      }
      if (filter.profile_id) {
        records = records.filter(r => r.envelope.profile_id === filter.profile_id);
      }
      if (filter.command_type) {
        records = records.filter(r => r.envelope.command_type === filter.command_type);
      }
      if (filter.start_date) {
        records = records.filter(r => r.stored_at >= filter.start_date! || r.envelope.occurred_at_local >= filter.start_date!);
      }
      if (filter.end_date) {
        records = records.filter(r => r.stored_at <= filter.end_date! || r.envelope.occurred_at_local <= filter.end_date!);
      }
      if (filter.status) {
        records = records.filter(r => r.ack.status.toLowerCase() === filter.status!.toLowerCase());
      }
    }

    records.sort((a, b) => new Date(b.stored_at).getTime() - new Date(a.stored_at).getTime());
    return records;
  }

  public processCommand(envelope: AtomicCommandEnvelope): { success: true; ack: CommandAck } | { success: false; status: number; error: Record<string, unknown> } {
    const { tenant_id, idempotency_key, command_id, aggregate_type, aggregate_id, base_version } = envelope;

    // 1. Checagem de Idempotência
    const idempKey = this.getCompositeKey(tenant_id, idempotency_key);
    const existing = this.commandsByIdempotency.get(idempKey);
    if (existing) {
      // Reenvio idempotente: devolve o mesmo ACK registrado anteriormente
      return {
        success: true,
        ack: {
          ...existing.ack,
          idempotent_replay: true
        }
      };
    }

    // 2. Checagem de Concorrência (base_version)
    const aggKey = this.getAggregateKey(tenant_id, aggregate_type, aggregate_id);
    const currentVersion = this.aggregateVersions.get(aggKey) ?? 0;

    if (base_version !== currentVersion) {
      return {
        success: false,
        status: 409,
        error: {
          error: 'CONCURRENCY_CONFLICT',
          message: `Versão de base inválida para agregado ${aggregate_type}/${aggregate_id}. Esperada: ${currentVersion}, Recebida: ${base_version}`,
          expected_base_version: currentVersion,
          received_base_version: base_version
        }
      };
    }

    // 3. Aplicação do Comando e Avanço de Versão
    const newVersion = currentVersion + 1;
    this.aggregateVersions.set(aggKey, newVersion);

    const ack: CommandAck = {
      command_id,
      status: 'acked',
      idempotent_replay: false,
      server_received_at: new Date().toISOString(),
      aggregate_type,
      aggregate_id,
      new_version: newVersion
    };

    const record: StoredCommandRecord = {
      envelope,
      ack,
      stored_at: new Date().toISOString()
    };

    this.commandsById.set(command_id, record);
    this.commandsByIdempotency.set(idempKey, record);

    return { success: true, ack };
  }

  public clear(): void {
    this.commandsById.clear();
    this.commandsByIdempotency.clear();
    this.aggregateVersions.clear();
  }
}
