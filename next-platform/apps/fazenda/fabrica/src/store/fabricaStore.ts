import {
  AtomicCommandEnvelope,
  CriarFormulaRacaoPayload,
  IniciarBatidaPayload,
  ConcluirBatidaPayload,
  AjustarEstoqueMateriaPrimaPayload,
  ReceberMateriaPrimaPayload,
  CalibrarBalancaMisturadorPayload,
  IngredienteFormula,
  UserProfileId
} from '@consubov/contracts';

export interface MisturadorRecord {
  misturador_id: string;
  nome: string;
  status: 'ocioso' | 'misturando' | 'descarregando';
  batida_atual_id?: string;
  capacidade_kg: number;
}

export interface FormulaRecord {
  formula_id: string;
  nome_formula: string;
  tipo_raca_destino: string;
  ingredientes: IngredienteFormula[];
  tamanho_batida_padrao_kg: number;
  ativo: boolean;
}

export interface BatidaRecord {
  batida_id: string;
  ordem_producao_id: string;
  formula_id: string;
  misturador_id: string;
  quantidade_planejada_kg: number;
  quantidade_realizada_kg?: number;
  tempo_mistura_segundos?: number;
  operador_id: string;
  iniciado_em: string;
  finalizado_em?: string;
  desvio_peso_kg?: number;
  status: 'em_andamento' | 'concluida';
}

export interface SiloRecord {
  silo_id: string;
  nome_silo: string;
  materia_prima_id: string;
  materia_prima_nome: string;
  capacidade_total_kg: number;
  nivel_atual_kg: number;
  ocupacao_pct: number;
}

export interface CalibracaoRecord {
  balanca_id: string;
  equipamento_tipo: string;
  peso_padrao_kg: number;
  peso_medido_kg: number;
  desvio_pct: number;
  calibrado: boolean;
  data_calibracao: string;
}

export interface FabricaState {
  kpis: {
    misturadoresAtivos: number;
    producaoHojeKg: number;
    metaHojeKg: number;
    silosAlertaCount: number;
  };
  misturadores: MisturadorRecord[];
  formulas: FormulaRecord[];
  batidas: BatidaRecord[];
  silos: SiloRecord[];
  calibracoes: CalibracaoRecord[];
  outbox: AtomicCommandEnvelope<any>[];
  baseVersions: Record<string, number>;
}

export class FabricaStore {
  private state: FabricaState;
  private partitionKey: string;
  private listeners: Set<() => void> = new Set();

  constructor(partitionKey = 'consubov:tenant-default:user-fabrica:fazenda-01:fabrica') {
    this.partitionKey = partitionKey;
    this.state = this.loadInitialState();
  }

  private loadInitialState(): FabricaState {
    if (typeof localStorage !== 'undefined') {
      try {
        const cached = localStorage.getItem(this.partitionKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch {
        // Fallback
      }
    }

    return {
      kpis: {
        misturadoresAtivos: 1,
        producaoHojeKg: 12500,
        metaHojeKg: 20000,
        silosAlertaCount: 0
      },
      misturadores: [
        {
          misturador_id: 'misturador-01',
          nome: 'Misturador Horizontal 01 (2000kg)',
          status: 'misturando',
          batida_atual_id: 'batida-42',
          capacidade_kg: 2000
        },
        {
          misturador_id: 'misturador-02',
          nome: 'Misturador Vertical 02 (1500kg)',
          status: 'ocioso',
          capacidade_kg: 1500
        }
      ],
      formulas: [
        {
          formula_id: 'form-terminacao-22',
          nome_formula: 'Terminação 22%',
          tipo_raca_destino: 'racao_confinamento',
          tamanho_batida_padrao_kg: 2000,
          ativo: true,
          ingredientes: [
            { materia_prima_id: 'mp-milho', nome_ingrediente: 'Milho Moído', porcentagem_inclusao: 65 },
            { materia_prima_id: 'mp-soja', nome_ingrediente: 'Farelo de Soja 46%', porcentagem_inclusao: 25 },
            { materia_prima_id: 'mp-nucleo', nome_ingrediente: 'Núcleo Confinamento', porcentagem_inclusao: 7 },
            { materia_prima_id: 'mp-calcario', nome_ingrediente: 'Calcário Calcítico', porcentagem_inclusao: 3 }
          ]
        }
      ],
      batidas: [
        {
          batida_id: 'batida-42',
          ordem_producao_id: 'op-2026-1104',
          formula_id: 'form-terminacao-22',
          misturador_id: 'misturador-01',
          quantidade_planejada_kg: 2000,
          operador_id: 'user-fabrica-synthetic',
          iniciado_em: '2026-11-04T09:30:00.000Z',
          status: 'em_andamento'
        }
      ],
      silos: [
        {
          silo_id: 'silo-01',
          nome_silo: 'Silo 01',
          materia_prima_id: 'mp-milho',
          materia_prima_nome: 'Milho Moído',
          capacidade_total_kg: 60000,
          nivel_atual_kg: 42000,
          ocupacao_pct: 70
        },
        {
          silo_id: 'silo-02',
          nome_silo: 'Silo 02',
          materia_prima_id: 'mp-soja',
          materia_prima_nome: 'Farelo de Soja',
          capacidade_total_kg: 40000,
          nivel_atual_kg: 33800,
          ocupacao_pct: 84.5
        },
        {
          silo_id: 'silo-03',
          nome_silo: 'Silo 03',
          materia_prima_id: 'mp-nucleo',
          materia_prima_nome: 'Núcleo Mineral',
          capacidade_total_kg: 20000,
          nivel_atual_kg: 14500,
          ocupacao_pct: 72.5
        }
      ],
      calibracoes: [
        {
          balanca_id: 'balanca-misturador-01',
          equipamento_tipo: 'celula_carga_misturador',
          peso_padrao_kg: 1000,
          peso_medido_kg: 1002,
          desvio_pct: 0.2,
          calibrado: true,
          data_calibracao: '2026-11-01T08:00:00.000Z'
        }
      ],
      outbox: [],
      baseVersions: {
        'form-terminacao-22': 0,
        'batida-42': 0,
        'silo-01': 0,
        'silo-02': 0,
        'silo-03': 0,
        'balanca-misturador-01': 0
      }
    };
  }

  private persist(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.partitionKey, JSON.stringify(this.state));
      } catch {
        // quota
      }
    }
    this.notify();
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

  private createEnvelope<T>(
    commandType: string,
    aggregateType: string,
    aggregateId: string,
    payload: T,
    profileId: UserProfileId = 'fabrica'
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
      user_id: 'user-fabrica-synthetic',
      tenant_id: 'tenant-default',
      product_id: 'consubov',
      fazenda_id: 'fazenda-01',
      retiro_id: null,
      profile_id: profileId,
      device_id: 'device-local-pwa',
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

  public salvarFormula(payload: CriarFormulaRacaoPayload): AtomicCommandEnvelope<CriarFormulaRacaoPayload> {
    // Validação matemática estrita de 100% de inclusão
    const totalInclusao = payload.ingredientes.reduce((sum, item) => sum + item.porcentagem_inclusao, 0);
    if (Math.abs(totalInclusao - 100) > 0.01) {
      throw new Error(`Soma das porcentagens de inclusão deve ser exatamente 100%. Total atual: ${totalInclusao}%`);
    }

    const envelope = this.createEnvelope(
      'fabrica.formulas.salvar',
      'formula',
      payload.formula_id,
      payload
    );

    const existingIndex = this.state.formulas.findIndex(f => f.formula_id === payload.formula_id);
    if (existingIndex >= 0) {
      this.state.formulas[existingIndex] = payload;
    } else {
      this.state.formulas.push(payload);
    }

    this.persist();
    return envelope;
  }

  public iniciarBatida(payload: IniciarBatidaPayload): AtomicCommandEnvelope<IniciarBatidaPayload> {
    const envelope = this.createEnvelope(
      'fabrica.batidas.iniciar',
      'batida',
      payload.batida_id,
      payload
    );

    this.state.batidas.unshift({
      batida_id: payload.batida_id,
      ordem_producao_id: payload.ordem_producao_id,
      formula_id: payload.formula_id,
      misturador_id: payload.misturador_id,
      quantidade_planejada_kg: payload.quantidade_planejada_kg,
      operador_id: payload.operador_id,
      iniciado_em: payload.iniciado_em,
      status: 'em_andamento'
    });

    const mixer = this.state.misturadores.find(m => m.misturador_id === payload.misturador_id);
    if (mixer) {
      mixer.status = 'misturando';
      mixer.batida_atual_id = payload.batida_id;
    }

    this.persist();
    return envelope;
  }

  public concluirBatida(payload: ConcluirBatidaPayload): AtomicCommandEnvelope<ConcluirBatidaPayload> {
    const envelope = this.createEnvelope(
      'fabrica.batidas.concluir',
      'batida',
      payload.batida_id,
      payload
    );

    const batida = this.state.batidas.find(b => b.batida_id === payload.batida_id);
    if (batida) {
      batida.quantidade_realizada_kg = payload.quantidade_realizada_kg;
      batida.tempo_mistura_segundos = payload.tempo_mistura_segundos;
      batida.finalizado_em = payload.finalizado_em;
      batida.desvio_peso_kg = payload.desvio_peso_kg;
      batida.status = 'concluida';

      const mixer = this.state.misturadores.find(m => m.misturador_id === batida.misturador_id);
      if (mixer) {
        mixer.status = 'ocioso';
        mixer.batida_atual_id = undefined;
      }

      // Baixa automática proporcional das matérias-primas nos silos correspondentes
      const formula = this.state.formulas.find(f => f.formula_id === batida.formula_id);
      if (formula) {
        for (const ing of formula.ingredientes) {
          const consumoKg = (payload.quantidade_realizada_kg * ing.porcentagem_inclusao) / 100;
          const silo = this.state.silos.find(s => s.materia_prima_id === ing.materia_prima_id);
          if (silo) {
            silo.nivel_atual_kg = Math.max(0, silo.nivel_atual_kg - consumoKg);
            silo.ocupacao_pct = Math.round((silo.nivel_atual_kg / silo.capacidade_total_kg) * 1000) / 10;
          }
        }
      }

      this.state.kpis.producaoHojeKg += payload.quantidade_realizada_kg;
    }

    this.persist();
    return envelope;
  }

  public ajustarEstoque(payload: AjustarEstoqueMateriaPrimaPayload): AtomicCommandEnvelope<AjustarEstoqueMateriaPrimaPayload> {
    const envelope = this.createEnvelope(
      'fabrica.estoque.ajustar',
      'silo',
      payload.silo_id,
      payload
    );

    const silo = this.state.silos.find(s => s.silo_id === payload.silo_id);
    if (silo) {
      silo.nivel_atual_kg = payload.quantidade_ajustada_kg;
      silo.ocupacao_pct = Math.round((payload.quantidade_ajustada_kg / silo.capacidade_total_kg) * 1000) / 10;
    }

    this.persist();
    return envelope;
  }

  public receberMateriaPrima(payload: ReceberMateriaPrimaPayload): AtomicCommandEnvelope<ReceberMateriaPrimaPayload> {
    const envelope = this.createEnvelope(
      'fabrica.materia_prima.receber',
      'silo',
      payload.silo_destino_id,
      payload
    );

    const silo = this.state.silos.find(s => s.silo_id === payload.silo_destino_id);
    if (silo) {
      silo.nivel_atual_kg += payload.quantidade_kg;
      silo.ocupacao_pct = Math.round((silo.nivel_atual_kg / silo.capacidade_total_kg) * 1000) / 10;
    }

    this.persist();
    return envelope;
  }

  public calibrarBalanca(payload: CalibrarBalancaMisturadorPayload): AtomicCommandEnvelope<CalibrarBalancaMisturadorPayload> {
    const envelope = this.createEnvelope(
      'fabrica.balanca.calibrar',
      'balanca',
      payload.balanca_id,
      payload
    );

    this.state.calibracoes.unshift({
      balanca_id: payload.balanca_id,
      equipamento_tipo: payload.equipamento_tipo,
      peso_padrao_kg: payload.peso_padrao_afericao_kg,
      peso_medido_kg: payload.peso_medido_kg,
      desvio_pct: payload.desvio_percentual,
      calibrado: payload.calibrado,
      data_calibracao: payload.data_calibracao
    });

    this.persist();
    return envelope;
  }
}

let defaultFabricaStore: FabricaStore | null = null;

export function getFabricaStore(partitionKey?: string): FabricaStore {
  if (!defaultFabricaStore || partitionKey) {
    defaultFabricaStore = new FabricaStore(partitionKey);
  }
  return defaultFabricaStore;
}
