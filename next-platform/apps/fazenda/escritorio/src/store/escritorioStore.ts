import { applyModuleCommand, type NotaFiscalRecord, type PedidoCompraRecord, type LoteEscritorioRecord, type FechamentoCustoRecord, type EscritorioState } from '@consubov/domain-projection/escritorio';
import {
  AtomicCommandEnvelope,
  RegistrarNotaFiscalPayload,
  RegistrarCompraInsumoPayload,
  CriarLotePayload,
  ParticionarLotePayload,
  FecharCustoLotePayload,
  EmitirRelatorioFinanceiroPayload,
  ItemNotaFiscal,
  type ModuleExecutionContext,
  type ModuleLocalDataAPI,
  type LocalSnapshot
} from '@consubov/contracts';

export type { NotaFiscalRecord, PedidoCompraRecord, LoteEscritorioRecord, FechamentoCustoRecord, EscritorioState } from '@consubov/domain-projection/escritorio';

export class EscritorioStore {
  private state: EscritorioState;
  private context: ModuleExecutionContext;
  private localData: ModuleLocalDataAPI;
  private operationQueue: Promise<void> = Promise.resolve();
  private hydrationFailed = false;
  public readonly ready: Promise<void>;
  private listeners: Set<() => void> = new Set();

  constructor(context: ModuleExecutionContext, localData: ModuleLocalDataAPI) {
    this.context = context;
    this.localData = localData;
    this.state = this.createInitialState();
    this.ready = this.hydrate();
    void this.ready.catch(() => undefined);
  }

  private createInitialState(): EscritorioState {
    return {
      kpis: { pendentesConferencia: 0, comprasAprovadas: 0, totalComprometidoBrl: 0 },
      notasFiscais: [], pedidosCompra: [], lotes: [], fechamentos: [],
      outbox: [], baseVersions: {}, localRevision: 0, persistenceError: null
    };
  }

  private async hydrate(): Promise<void> {
    try {
      const [snapshots, pending] = await Promise.all([
        this.localData.listSnapshots(),
        this.localData.listPendingCommands(500)
      ]);
      const latest = [...snapshots]
        .filter(snapshot => snapshot.data?.schema === 'escritorio-state-v1' && snapshot.data.state && typeof snapshot.data.state === 'object')
        .sort((a, b) => Number(b.data.revision ?? 0) - Number(a.data.revision ?? 0) || b.modifiedAt.localeCompare(a.modifiedAt))
        .slice(0, 500)[0];
      if (latest) {
        const stored = latest.data.state as EscritorioState;
        if (!this.isValidState(stored) || latest.data.revision !== stored.localRevision) throw new Error('Snapshot local inválido.');
        this.state = { ...stored, outbox: pending.map(item => item.command), persistenceError: null };
        this.hydrationFailed = false;
      } else {
        throw new Error('Snapshot local ausente.');
      }
    } catch {
      this.hydrationFailed = true;
      this.state = {
        kpis: { pendentesConferencia: 0, comprasAprovadas: 0, totalComprometidoBrl: 0 },
        notasFiscais: [], pedidosCompra: [], lotes: [], fechamentos: [], outbox: [], baseVersions: {}, localRevision: 0,
        persistenceError: 'Não foi possível carregar os dados locais. Conecte-se e autentique-se novamente para preparar o aplicativo.'
      };
      this.notify();
      throw new Error(this.state.persistenceError!);
    }
    this.notify();
  }

  private isValidState(value: unknown): value is EscritorioState {
    if (!value || typeof value !== 'object') return false;
    const state = value as Partial<EscritorioState>;
    return Boolean(state.kpis && Array.isArray(state.notasFiscais) && Array.isArray(state.pedidosCompra) &&
      Array.isArray(state.lotes) && Array.isArray(state.fechamentos) && Array.isArray(state.outbox) &&
      state.baseVersions && typeof state.baseVersions === 'object' && Number.isSafeInteger(state.localRevision) && Number(state.localRevision) >= 0);
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async commit<T>(
    commandType: string,
    aggregateType: string,
    aggregateId: string,
    payload: T
  ): Promise<AtomicCommandEnvelope<T>> {
    return this.enqueue(async () => {
      await this.ready;
      if (this.hydrationFailed) throw new Error('Dados locais indisponíveis; alteração não gravada.');
      const next = structuredClone(this.state);
      const baseVersion = next.baseVersions[aggregateId] ?? 0;
      const commandId = crypto.randomUUID();
      const occurredAt = new Date().toISOString();
      const envelope: AtomicCommandEnvelope<T> = {
        command_id: commandId,
        idempotency_key: `idemp-${commandId}-${Date.now()}`,
        command_type: commandType,
        aggregate_type: aggregateType,
        aggregate_id: aggregateId,
        base_version: baseVersion,
        user_id: this.context.userId,
        tenant_id: this.context.tenantId,
        product_id: this.context.productId,
        fazenda_id: this.context.farmId,
        retiro_id: this.context.retreatId,
        profile_id: this.context.profileId,
        device_id: this.context.deviceId,
        schema_version: 1,
        payload,
        correlation_id: commandId,
        attachment_refs: [],
        occurred_at_local: occurredAt,
        status: 'PENDENTE',
        attempts: 0,
        last_attempt_at: null,
        error_message: null
      };
      Object.assign(next, applyModuleCommand('escritorio', next, envelope));
      next.baseVersions[aggregateId] = baseVersion + 1;
      next.localRevision = this.state.localRevision + 1;
      next.outbox.push(envelope);
      next.persistenceError = null;
      const snapshot: LocalSnapshot = {
        aggregateType,
        aggregateId,
        version: baseVersion + 1,
        data: { schema: 'escritorio-state-v1', revision: next.localRevision, state: next as unknown as Record<string, unknown> },
        modifiedAt: occurredAt
      };
      try {
        await this.localData.commitMutation({
          expectedModuleRevision: this.state.localRevision,
          command: envelope,
          snapshot,
          attachments: []
        });
      } catch (error) {
        if (error instanceof Error && /Estado local desatualizado/.test(error.message)) await this.hydrate();
        const errorMessage = 'Falha ao gravar dados locais. Nenhuma alteração foi confirmada.';
        this.state = { ...this.state, persistenceError: errorMessage };
        this.notify();
        throw new Error(errorMessage);
      }
      this.state = next;
      this.notify();
      return envelope;
    });
  }

  public refreshFromLocalData(): Promise<void> { return this.enqueue(() => this.hydrate()); }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public getState(): EscritorioState {
    return this.state;
  }

  public registrarNotaFiscal(payload: RegistrarNotaFiscalPayload): Promise<AtomicCommandEnvelope<RegistrarNotaFiscalPayload>> {
    return this.commit(
      'escritorio.notas.registrar_entrada',
      'nota_fiscal',
      payload.nota_fiscal_id,
      payload
    );
  }

  public criarPedidoCompra(payload: RegistrarCompraInsumoPayload): Promise<AtomicCommandEnvelope<RegistrarCompraInsumoPayload>> {
    return this.commit(
      'escritorio.compras.criar_pedido',
      'pedido_compra',
      payload.pedido_compra_id,
      payload
    );
  }

  public cadastrarLote(payload: CriarLotePayload): Promise<AtomicCommandEnvelope<CriarLotePayload>> {
    return this.commit(
      'escritorio.lotes.cadastrar',
      'lote',
      payload.lote_id,
      payload
    );
  }

  public particionarLote(payload: ParticionarLotePayload): Promise<AtomicCommandEnvelope<ParticionarLotePayload>> {
    return this.commit(
      'escritorio.lotes.particionar',
      'lote',
      payload.lote_origem_id,
      payload
    );
  }

  public fecharCustoLote(payload: FecharCustoLotePayload): Promise<AtomicCommandEnvelope<FecharCustoLotePayload>> {
    return this.commit(
      'escritorio.custos.fechar',
      'lote',
      payload.lote_id,
      payload
    );
  }

  public emitirRelatorio(payload: EmitirRelatorioFinanceiroPayload): Promise<AtomicCommandEnvelope<EmitirRelatorioFinanceiroPayload>> {
    return this.commit(
      'escritorio.relatorios.emitir',
      'relatorio',
      payload.relatorio_id,
      payload
    );
  }
}

export function getEscritorioStore(context: ModuleExecutionContext, localData: ModuleLocalDataAPI): EscritorioStore {
  return new EscritorioStore(context, localData);
}
