import { applyModuleCommand, type MisturadorRecord, type FormulaRecord, type BatidaRecord, type SiloRecord, type CalibracaoRecord, type FabricaState } from '@consubov/domain-projection/fabrica';
import {
  AtomicCommandEnvelope,
  CriarFormulaRacaoPayload,
  IniciarBatidaPayload,
  ConcluirBatidaPayload,
  AjustarEstoqueMateriaPrimaPayload,
  ReceberMateriaPrimaPayload,
  CalibrarBalancaMisturadorPayload,
  IngredienteFormula,
  type ModuleExecutionContext,
  type ModuleLocalDataAPI
} from '@consubov/contracts';
import type { LocalSnapshot } from '@consubov/contracts';

export type { MisturadorRecord, FormulaRecord, BatidaRecord, SiloRecord, CalibracaoRecord, FabricaState } from '@consubov/domain-projection/fabrica';

function isFabricaState(value: unknown): value is FabricaState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<FabricaState>;
  return Boolean(
    state.kpis && Array.isArray(state.misturadores) && Array.isArray(state.formulas) &&
    Array.isArray(state.batidas) && Array.isArray(state.silos) &&
    Array.isArray(state.calibracoes) && Array.isArray(state.outbox) &&
    state.baseVersions && typeof state.baseVersions === 'object' &&
    (state.localRevision === undefined || (Number.isSafeInteger(state.localRevision) && state.localRevision >= 0))
  );
}

export class FabricaStore {
  private state: FabricaState;
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

  private createInitialState(): FabricaState {
    return {
      kpis: { misturadoresAtivos: 0, producaoHojeKg: 0, metaHojeKg: 0, silosAlertaCount: 0 },
      misturadores: [], formulas: [], batidas: [], silos: [], calibracoes: [],
      outbox: [], baseVersions: {}, localRevision: 0
    };
  }

  private async hydrate(): Promise<void> {
    try {
      const pending = await this.localData.listPendingCommands(500);
      const candidates = await this.localData.listSnapshots<FabricaState>();
      const latest = candidates.filter((snapshot): snapshot is LocalSnapshot<FabricaState> => isFabricaState(snapshot.data))
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
      const draft = structuredClone(previous);
      this.state = draft;
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

  public getState(): FabricaState {
    return this.state;
  }

  public getContextKey(): string {
    return JSON.stringify(this.context);
  }

  private createEnvelope<T>(
    commandType: string,
    aggregateType: string,
    aggregateId: string,
    payload: T,
    profileId: ModuleExecutionContext['profileId'] = 'fabrica'
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

  public salvarFormula(payload: CriarFormulaRacaoPayload): Promise<AtomicCommandEnvelope<CriarFormulaRacaoPayload>> {
    // Validação matemática estrita de 100% de inclusão
    const totalInclusao = payload.ingredientes.reduce((sum, item) => sum + item.porcentagem_inclusao, 0);
    if (Math.abs(totalInclusao - 100) > 0.01) {
      throw new Error(`Soma das porcentagens de inclusão deve ser exatamente 100%. Total atual: ${totalInclusao}%`);
    }

    return this.mutate(() => {
    const envelope = this.createEnvelope(
      'fabrica.formulas.salvar',
      'formula',
      payload.formula_id,
      payload
    );
    this.state = applyModuleCommand('fabrica', this.state, envelope);
    return envelope;
    });
  }

  public iniciarBatida(payload: IniciarBatidaPayload): Promise<AtomicCommandEnvelope<IniciarBatidaPayload>> {
    return this.mutate(() => {
    const envelope = this.createEnvelope(
      'fabrica.batidas.iniciar',
      'batida',
      payload.batida_id,
      payload
    );
    this.state = applyModuleCommand('fabrica', this.state, envelope);
    return envelope;
    });
  }

  public concluirBatida(payload: ConcluirBatidaPayload): Promise<AtomicCommandEnvelope<ConcluirBatidaPayload>> {
    return this.mutate(() => {
    const envelope = this.createEnvelope(
      'fabrica.batidas.concluir',
      'batida',
      payload.batida_id,
      payload
    );
    this.state = applyModuleCommand('fabrica', this.state, envelope);
    return envelope;
    });
  }

  public ajustarEstoque(payload: AjustarEstoqueMateriaPrimaPayload): Promise<AtomicCommandEnvelope<AjustarEstoqueMateriaPrimaPayload>> {
    return this.mutate(() => {
    const envelope = this.createEnvelope(
      'fabrica.estoque.ajustar',
      'silo',
      payload.silo_id,
      payload
    );
    this.state = applyModuleCommand('fabrica', this.state, envelope);
    return envelope;
    });
  }

  public receberMateriaPrima(payload: ReceberMateriaPrimaPayload): Promise<AtomicCommandEnvelope<ReceberMateriaPrimaPayload>> {
    return this.mutate(() => {
    const envelope = this.createEnvelope(
      'fabrica.materia_prima.receber',
      'silo',
      payload.silo_destino_id,
      payload
    );
    this.state = applyModuleCommand('fabrica', this.state, envelope);
    return envelope;
    });
  }

  public calibrarBalanca(payload: CalibrarBalancaMisturadorPayload): Promise<AtomicCommandEnvelope<CalibrarBalancaMisturadorPayload>> {
    return this.mutate(() => {
    const envelope = this.createEnvelope(
      'fabrica.balanca.calibrar',
      'balanca',
      payload.balanca_id,
      payload
    );
    this.state = applyModuleCommand('fabrica', this.state, envelope);
    return envelope;
    });
  }
}

let defaultFabricaStore: FabricaStore | null = null;

export function getFabricaStore(context: ModuleExecutionContext, localData: ModuleLocalDataAPI): FabricaStore {
  if (!defaultFabricaStore || defaultFabricaStore.getContextKey() !== JSON.stringify(context)) {
    defaultFabricaStore = new FabricaStore(context, localData);
  }
  return defaultFabricaStore;
}
