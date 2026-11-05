import {
  AtomicCommandEnvelope,
  DefinirMetasPayload,
  AjustarDietaPayload,
  MovimentacaoLotePayload,
  ApropriarCustosPayload,
  AprovarLeituraCochoPayload,
  UserProfileId
} from '@consubov/contracts';

export interface LoteItem {
  lote_id: string;
  nome_lote: string;
  pasto_id: string;
  pasto_nome: string;
  categoria: string;
  quantidade_cabecas: number;
  peso_medio_kg: number;
  gmd_atual_kg_dia: number;
  meta_gmd_kg_dia: number;
  data_alvo_abate: string;
  estrategia_nutricional: string;
  consumo_esperado_g_cab_dia: number;
}

export interface CustoRateioItem {
  centro_custo: string;
  valor: number;
  percentual: number;
}

export interface CochoAuditItem {
  leitura_cocho_id: string;
  pasto_id: string;
  pasto_nome: string;
  escore_registrado: number;
  escore_revisado?: number;
  sacos_fornecidos: number;
  status: 'pendente' | 'aprovado' | 'ajuste_necessario' | 'rejeitado';
  registrado_em: string;
}

export interface GerenteState {
  kpis: {
    gmdAtual: number;
    gmdMeta: number;
    escoreCochoPct: number;
    animaisAtivos: number;
    custoArrobaBrl: number;
    taxaMortalidadePct: number;
  };
  gmdConfig: {
    modo: 'geral' | 'categoria' | 'retiro';
    estacao: 'verao' | 'inverno';
    metaGeralKgDia: number;
  };
  lotes: LoteItem[];
  custos: CustoRateioItem[];
  auditoriasCocho: CochoAuditItem[];
  outbox: AtomicCommandEnvelope<any>[];
  baseVersions: Record<string, number>;
}

export class GerenteStore {
  private state: GerenteState;
  private partitionKey: string;
  private listeners: Set<() => void> = new Set();

  constructor(partitionKey = 'consubov:tenant-default:user-gerente:fazenda-01:gerente') {
    this.partitionKey = partitionKey;
    this.state = this.loadInitialState();
  }

  private loadInitialState(): GerenteState {
    if (typeof localStorage !== 'undefined') {
      try {
        const cached = localStorage.getItem(this.partitionKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch {
        // Fallback para estado padrão
      }
    }

    return {
      kpis: {
        gmdAtual: 1.45,
        gmdMeta: 1.35,
        escoreCochoPct: 98.2,
        animaisAtivos: 3420,
        custoArrobaBrl: 215.5,
        taxaMortalidadePct: 0.8
      },
      gmdConfig: {
        modo: 'geral',
        estacao: 'verao',
        metaGeralKgDia: 1.35
      },
      lotes: [
        {
          lote_id: 'lote-recria-01',
          nome_lote: 'Lote 01 - Garrotes Nelore',
          pasto_id: 'pasto-04',
          pasto_nome: 'Pasto 04 (Mombaça)',
          categoria: 'garrote',
          quantidade_cabecas: 320,
          peso_medio_kg: 340,
          gmd_atual_kg_dia: 1.42,
          meta_gmd_kg_dia: 1.35,
          data_alvo_abate: '2026-12-15T00:00:00.000Z',
          estrategia_nutricional: 'pasto_aguas',
          consumo_esperado_g_cab_dia: 1200
        },
        {
          lote_id: 'lote-terminacao-02',
          nome_lote: 'Lote 02 - Bois Confinamento',
          pasto_id: 'pasto-07',
          pasto_nome: 'Pasto 07 (Piquete Confinamento)',
          categoria: 'boi_gordo',
          quantidade_cabecas: 450,
          peso_medio_kg: 490,
          gmd_atual_kg_dia: 1.58,
          meta_gmd_kg_dia: 1.5,
          data_alvo_abate: '2026-11-30T00:00:00.000Z',
          estrategia_nutricional: 'semi_confinamento',
          consumo_esperado_g_cab_dia: 3500
        }
      ],
      custos: [
        { centro_custo: 'Nutrição Animal', valor: 85400, percentual: 58 },
        { centro_custo: 'Sanidade e Vacinas', valor: 18200, percentual: 12 },
        { centro_custo: 'Pastagem e Adubação', valor: 26500, percentual: 18 },
        { centro_custo: 'Operacional e Mão de Obra', valor: 17600, percentual: 12 }
      ],
      auditoriasCocho: [
        {
          leitura_cocho_id: 'leitura-01',
          pasto_id: 'pasto-04',
          pasto_nome: 'Pasto 04 (Mombaça)',
          escore_registrado: 3,
          sacos_fornecidos: 8,
          status: 'pendente',
          registrado_em: '2026-11-04T07:30:00.000Z'
        },
        {
          leitura_cocho_id: 'leitura-02',
          pasto_id: 'pasto-07',
          pasto_nome: 'Pasto 07 (Piquete)',
          escore_registrado: 4,
          sacos_fornecidos: 12,
          status: 'pendente',
          registrado_em: '2026-11-04T07:45:00.000Z'
        }
      ],
      outbox: [],
      baseVersions: {
        'lote-recria-01': 0,
        'lote-terminacao-02': 0,
        'leitura-01': 0,
        'leitura-02': 0
      }
    };
  }

  private persist(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.partitionKey, JSON.stringify(this.state));
      } catch {
        // quota excedida ou storage inacessível
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

  public getState(): GerenteState {
    return this.state;
  }

  private createEnvelope<T>(
    commandType: string,
    aggregateType: string,
    aggregateId: string,
    payload: T,
    profileId: UserProfileId = 'gerente'
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
      user_id: 'user-gerente-synthetic',
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

  public definirMetas(payload: DefinirMetasPayload): AtomicCommandEnvelope<DefinirMetasPayload> {
    const envelope = this.createEnvelope(
      'gerente.metas.definir',
      'lote',
      payload.lote_id,
      payload
    );

    const lote = this.state.lotes.find(l => l.lote_id === payload.lote_id);
    if (lote) {
      lote.meta_gmd_kg_dia = payload.gmd_alvo_kg_dia;
      lote.data_alvo_abate = payload.data_alvo_abate;
      if (payload.estrategia_nutricional) {
        lote.estrategia_nutricional = payload.estrategia_nutricional;
      }
      if (payload.consumo_esperado_g_cab_dia) {
        lote.consumo_esperado_g_cab_dia = payload.consumo_esperado_g_cab_dia;
      }
    }

    this.state.kpis.gmdMeta = payload.gmd_alvo_kg_dia;
    this.persist();
    return envelope;
  }

  public ajustarDieta(payload: AjustarDietaPayload): AtomicCommandEnvelope<AjustarDietaPayload> {
    const envelope = this.createEnvelope(
      'gerente.gmd.ajustar_curva',
      'lote',
      payload.lote_id,
      payload
    );

    const lote = this.state.lotes.find(l => l.lote_id === payload.lote_id);
    if (lote) {
      lote.consumo_esperado_g_cab_dia = payload.nova_meta_consumo_g_cab_dia;
    }

    this.persist();
    return envelope;
  }

  public transferirPasto(payload: MovimentacaoLotePayload): AtomicCommandEnvelope<MovimentacaoLotePayload> {
    const envelope = this.createEnvelope(
      'gerente.lote.transferir_pasto',
      'lote',
      payload.lote_id,
      payload
    );

    const lote = this.state.lotes.find(l => l.lote_id === payload.lote_id);
    if (lote) {
      lote.pasto_id = payload.pasto_destino_id;
      lote.pasto_nome = payload.pasto_destino_id;
    }

    this.persist();
    return envelope;
  }

  public apropriarCustos(payload: ApropriarCustosPayload): AtomicCommandEnvelope<ApropriarCustosPayload> {
    const envelope = this.createEnvelope(
      'gerente.custos.apropriar',
      'lote',
      payload.lote_id,
      payload
    );

    const total = payload.valor_total_apropriado;
    this.state.custos = payload.itens_apropriacao.map(item => ({
      centro_custo: item.centro_custo,
      valor: item.valor,
      percentual: total > 0 ? Math.round((item.valor / total) * 100) : 0
    }));

    this.persist();
    return envelope;
  }

  public aprovarLeituraCocho(payload: AprovarLeituraCochoPayload): AtomicCommandEnvelope<AprovarLeituraCochoPayload> {
    const envelope = this.createEnvelope(
      'gerente.leitura_cocho.aprovar',
      'leitura_cocho',
      payload.leitura_cocho_id,
      payload
    );

    const leitura = this.state.auditoriasCocho.find(a => a.leitura_cocho_id === payload.leitura_cocho_id);
    if (leitura) {
      leitura.status = payload.status_aprovacao;
      if (payload.escore_revisado !== undefined) {
        leitura.escore_revisado = payload.escore_revisado;
      }
      if (payload.novo_fornecimento_sacos !== undefined) {
        leitura.sacos_fornecidos = payload.novo_fornecimento_sacos;
      }
    }

    this.persist();
    return envelope;
  }
}

let defaultGerenteStore: GerenteStore | null = null;

export function getGerenteStore(partitionKey?: string): GerenteStore {
  if (!defaultGerenteStore || partitionKey) {
    defaultGerenteStore = new GerenteStore(partitionKey);
  }
  return defaultGerenteStore;
}
