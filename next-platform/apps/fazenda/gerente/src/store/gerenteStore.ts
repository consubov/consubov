import { applyModuleCommand, type LoteItem, type CustoRateioItem, type CochoAuditItem, type GerenteState } from '@consubov/domain-projection/gerente';
import {
  AtomicCommandEnvelope,
  DefinirMetasPayload,
  AjustarDietaPayload,
  MovimentacaoLotePayload,
  ApropriarCustosPayload,
  AprovarLeituraCochoPayload,
  type ModuleExecutionContext,
  type ModuleLocalDataAPI,
  type LocalSnapshot
} from '@consubov/contracts';

export type { LoteItem, CustoRateioItem, CochoAuditItem, GerenteState } from '@consubov/domain-projection/gerente';

function isGerenteState(value: unknown): value is GerenteState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<GerenteState>;
  return Boolean(state.kpis && state.gmdConfig && Array.isArray(state.lotes) &&
    Array.isArray(state.custos) && Array.isArray(state.auditoriasCocho) &&
    Array.isArray(state.outbox) && state.baseVersions && typeof state.baseVersions === 'object' &&
    (state.localRevision === undefined || (Number.isSafeInteger(state.localRevision) && state.localRevision >= 0)));
}

export class GerenteStore {
  private state: GerenteState;
  private context: ModuleExecutionContext;
  private localData: ModuleLocalDataAPI;
  private mutationQueue: Promise<void> = Promise.resolve();
  public readonly ready: Promise<void>;
  private hydrationFailed = false;
  private listeners: Set<() => void> = new Set();

  constructor(context: ModuleExecutionContext, localData: ModuleLocalDataAPI) {
    this.context = context;
    this.localData = localData;
    this.state = this.createInitialState();
    this.ready = this.hydrate();
    void this.ready.catch(() => undefined);
  }

  private createInitialState(): GerenteState {
    return {
      kpis: { gmdAtual: 0, gmdMeta: 0, escoreCochoPct: 0, animaisAtivos: 0, custoArrobaBrl: 0, taxaMortalidadePct: 0 },
      gmdConfig: { modo: 'geral', estacao: 'verao', metaGeralKgDia: 0 },
      lotes: [], custos: [], auditoriasCocho: [], outbox: [], baseVersions: {}, localRevision: 0
    };
  }

  private async hydrate(): Promise<void> {
    try {
      const pending = await this.localData.listPendingCommands(500);
      const snapshots = await this.localData.listSnapshots<GerenteState>();
      const latest = snapshots.filter((snapshot): snapshot is LocalSnapshot<GerenteState> => isGerenteState(snapshot.data))
        .sort((a, b) => (b.data.localRevision ?? 0) - (a.data.localRevision ?? 0))[0];
      if (!latest) throw new Error('Dados locais ausentes ou inválidos. Conecte-se e autentique-se novamente para preparar o aplicativo.');
      this.state = latest.data;
      this.state = { ...this.state, outbox: pending.map(item => item.command) };
      this.notify();
      this.hydrationFailed = false;
    } catch (error) {
      this.hydrationFailed = true;
      this.state = this.createInitialState();
      this.notify();
      throw error;
    }
  }

  private mutate<T extends AtomicCommandEnvelope>(action: () => T): Promise<T> {
    const operation = this.mutationQueue.then(async () => {
      await this.ready;
      if (this.hydrationFailed) throw new Error('Dados locais indisponíveis; alteração não gravada.');
      const previous = this.state;
      this.state = structuredClone(previous);
      try {
        const command = action();
        this.state.localRevision = (previous.localRevision ?? 0) + 1;
        await this.localData.commitMutation({
          expectedModuleRevision: previous.localRevision ?? 0,
          command,
          snapshot: {
            aggregateType: command.aggregate_type, aggregateId: command.aggregate_id,
            version: command.base_version + 1, data: this.state as unknown as Record<string, unknown>,
            modifiedAt: command.occurred_at_local
          },
          attachments: []
        });
        this.notify();
        return command;
      } catch (error) {
        this.state = previous;
        if (error instanceof Error && /Estado local desatualizado/.test(error.message)) await this.hydrate();
        throw error;
      }
    });
    this.mutationQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  public refreshFromLocalData(): Promise<void> {
    const operation = this.mutationQueue.then(() => this.hydrate());
    this.mutationQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public getState(): GerenteState {
    return this.state;
  }

  public getContextKey(): string { return JSON.stringify(this.context); }

  private createEnvelope<T>(
    commandType: string,
    aggregateType: string,
    aggregateId: string,
    payload: T,
    profileId: ModuleExecutionContext['profileId'] = 'gerente'
  ): AtomicCommandEnvelope<T> {
    const currentVersion = this.state.baseVersions[aggregateId] ?? 0;
    const commandId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const idempotencyKey = `idemp-${commandId}-${Date.now()}`;

    const envelope: AtomicCommandEnvelope<T> = {
      command_id: commandId,
      idempotency_key: idempotencyKey,
      command_type: commandType,
      aggregate_type: aggregateType,
      aggregate_id: aggregateId,
      base_version: currentVersion,
      user_id: this.context.userId,
      tenant_id: this.context.tenantId,
      product_id: this.context.productId,
      fazenda_id: this.context.farmId,
      retiro_id: this.context.retreatId,
      profile_id: profileId,
      device_id: this.context.deviceId,
      schema_version: 1,
      payload,
      correlation_id: commandId,
      attachment_refs: [],
      occurred_at_local: new Date().toISOString(),
      status: 'PENDENTE',
      attempts: 0,
      last_attempt_at: null,
      error_message: null
    };

    this.state.baseVersions[aggregateId] = currentVersion + 1;
    this.state.outbox.push(envelope);
    return envelope;
  }

  public definirMetas(payload: DefinirMetasPayload): Promise<AtomicCommandEnvelope<DefinirMetasPayload>> {
    return this.mutate(() => {
    const envelope = this.createEnvelope(
      'gerente.metas.definir',
      'lote',
      payload.lote_id,
      payload
    );
    this.state = applyModuleCommand('gerente', this.state, envelope);
    return envelope;
    });
  }

  public ajustarDieta(payload: AjustarDietaPayload): Promise<AtomicCommandEnvelope<AjustarDietaPayload>> {
    return this.mutate(() => {
    const envelope = this.createEnvelope(
      'gerente.gmd.ajustar_curva',
      'lote',
      payload.lote_id,
      payload
    );
    this.state = applyModuleCommand('gerente', this.state, envelope);
    return envelope;
    });
  }

  public transferirPasto(payload: MovimentacaoLotePayload): Promise<AtomicCommandEnvelope<MovimentacaoLotePayload>> {
    return this.mutate(() => {
    const envelope = this.createEnvelope(
      'gerente.lote.transferir_pasto',
      'lote',
      payload.lote_id,
      payload
    );
    this.state = applyModuleCommand('gerente', this.state, envelope);
    return envelope;
    });
  }

  public apropriarCustos(payload: ApropriarCustosPayload): Promise<AtomicCommandEnvelope<ApropriarCustosPayload>> {
    return this.mutate(() => {
    const envelope = this.createEnvelope(
      'gerente.custos.apropriar',
      'lote',
      payload.lote_id,
      payload
    );
    this.state = applyModuleCommand('gerente', this.state, envelope);
    return envelope;
    });
  }

  public aprovarLeituraCocho(payload: AprovarLeituraCochoPayload): Promise<AtomicCommandEnvelope<AprovarLeituraCochoPayload>> {
    return this.mutate(() => {
    const envelope = this.createEnvelope(
      'gerente.leitura_cocho.aprovar',
      'leitura_cocho',
      payload.leitura_cocho_id,
      payload
    );
    this.state = applyModuleCommand('gerente', this.state, envelope);
    return envelope;
    });
  }
}

let defaultGerenteStore: GerenteStore | null = null;

export function getGerenteStore(context: ModuleExecutionContext, localData: ModuleLocalDataAPI): GerenteStore {
  if (!defaultGerenteStore || defaultGerenteStore.getContextKey() !== JSON.stringify(context)) {
    defaultGerenteStore = new GerenteStore(context, localData);
  }
  return defaultGerenteStore;
}
