import {
  AtomicCommandEnvelope,
  RegistrarNotaFiscalPayload,
  RegistrarCompraInsumoPayload,
  CriarLotePayload,
  ParticionarLotePayload,
  FecharCustoLotePayload,
  EmitirRelatorioFinanceiroPayload,
  ItemNotaFiscal,
  UserProfileId
} from '@consubov/contracts';

export interface NotaFiscalRecord {
  nota_fiscal_id: string;
  numero_nf: string;
  serie: string;
  chave_acesso_nfe: string;
  fornecedor_nome: string;
  fornecedor_cnpj_cpf: string;
  valor_total_brl: number;
  data_emissao: string;
  itens: ItemNotaFiscal[];
}

export interface PedidoCompraRecord {
  pedido_compra_id: string;
  fornecedor_id: string;
  fornecedor_nome: string;
  produto_insumo_id: string;
  produto_nome: string;
  quantidade_pedida: number;
  unidade: 'kg' | 'sc' | 'ton' | 'litro';
  preco_unitario_brl: number;
  condicao_pagamento: string;
  previsao_entrega: string;
  status: 'aprovado' | 'pendente' | 'entregue';
}

export interface LoteEscritorioRecord {
  lote_id: string;
  fazenda_id: string;
  pasto_id: string;
  nome_lote: string;
  categoria_animal: string;
  quantidade_cabecas: number;
  peso_medio_inicial_kg: number;
  data_entrada: string;
}

export interface FechamentoCustoRecord {
  lote_id: string;
  periodo_mes: number;
  periodo_ano: number;
  custo_nutricao_brl: number;
  custo_sanidade_brl: number;
  custo_pastagem_brl: number;
  custo_operacional_brl: number;
  valor_total_apropriado_brl: number;
  fechado_em: string;
}

export interface EscritorioState {
  kpis: {
    pendentesConferencia: number;
    comprasAprovadas: number;
    totalComprometidoBrl: number;
  };
  notasFiscais: NotaFiscalRecord[];
  pedidosCompra: PedidoCompraRecord[];
  lotes: LoteEscritorioRecord[];
  fechamentos: FechamentoCustoRecord[];
  outbox: AtomicCommandEnvelope<any>[];
  baseVersions: Record<string, number>;
}

export class EscritorioStore {
  private state: EscritorioState;
  private partitionKey: string;
  private listeners: Set<() => void> = new Set();

  constructor(partitionKey = 'consubov:tenant-default:user-escritorio:fazenda-01:escritorio') {
    this.partitionKey = partitionKey;
    this.state = this.loadInitialState();
  }

  private loadInitialState(): EscritorioState {
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
        pendentesConferencia: 3,
        comprasAprovadas: 8,
        totalComprometidoBrl: 148500
      },
      notasFiscais: [
        {
          nota_fiscal_id: 'nfe-001-2026',
          numero_nf: '10482',
          serie: '1',
          chave_acesso_nfe: '35261112345678000195550010000104821234567890',
          fornecedor_nome: 'NutriAgro Nutrição Animal Ltda',
          fornecedor_cnpj_cpf: '12345678000195',
          valor_total_brl: 45000,
          data_emissao: '2026-11-03T10:00:00.000Z',
          itens: [
            {
              produto_descricao: 'Milho Grão Padrão',
              quantidade: 30000,
              unidade_medida: 'kg',
              valor_unitario_brl: 1.2,
              valor_total_item_brl: 36000
            },
            {
              produto_descricao: 'Núcleo Mineral Confinamento',
              quantidade: 1500,
              unidade_medida: 'kg',
              valor_unitario_brl: 6.0,
              valor_total_item_brl: 9000
            }
          ]
        }
      ],
      pedidosCompra: [
        {
          pedido_compra_id: 'oc-2026-081',
          fornecedor_id: 'forn-01',
          fornecedor_nome: 'NutriAgro Nutrição Animal',
          produto_insumo_id: 'insumo-farelo-soja',
          produto_nome: 'Farelo de Soja 46%',
          quantidade_pedida: 25,
          unidade: 'ton',
          preco_unitario_brl: 2200,
          condicao_pagamento: '30_dias',
          previsao_entrega: '2026-11-10T00:00:00.000Z',
          status: 'aprovado'
        }
      ],
      lotes: [
        {
          lote_id: 'lote-adm-01',
          fazenda_id: 'fazenda-01',
          pasto_id: 'pasto-04',
          nome_lote: 'Lote 01 - Recria 2026',
          categoria_animal: 'garrote',
          quantidade_cabecas: 320,
          peso_medio_inicial_kg: 280,
          data_entrada: '2026-10-01T00:00:00.000Z'
        }
      ],
      fechamentos: [],
      outbox: [],
      baseVersions: {
        'nfe-001-2026': 0,
        'oc-2026-081': 0,
        'lote-adm-01': 0
      }
    };
  }

  private persist(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.partitionKey, JSON.stringify(this.state));
      } catch {
        // storage fallback
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

  public getState(): EscritorioState {
    return this.state;
  }

  private createEnvelope<T>(
    commandType: string,
    aggregateType: string,
    aggregateId: string,
    payload: T,
    profileId: UserProfileId = 'escritorio'
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
      user_id: 'user-escritorio-synthetic',
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

  public registrarNotaFiscal(payload: RegistrarNotaFiscalPayload): AtomicCommandEnvelope<RegistrarNotaFiscalPayload> {
    const envelope = this.createEnvelope(
      'escritorio.notas.registrar_entrada',
      'nota_fiscal',
      payload.nota_fiscal_id,
      payload
    );

    this.state.notasFiscais.unshift({
      nota_fiscal_id: payload.nota_fiscal_id,
      numero_nf: payload.numero_nf,
      serie: payload.serie,
      chave_acesso_nfe: payload.chave_acesso_nfe,
      fornecedor_nome: payload.fornecedor_nome,
      fornecedor_cnpj_cpf: payload.fornecedor_cnpj_cpf,
      valor_total_brl: payload.valor_total_brl,
      data_emissao: payload.data_emissao,
      itens: payload.itens
    });

    this.state.kpis.pendentesConferencia = Math.max(0, this.state.kpis.pendentesConferencia - 1);
    this.persist();
    return envelope;
  }

  public criarPedidoCompra(payload: RegistrarCompraInsumoPayload): AtomicCommandEnvelope<RegistrarCompraInsumoPayload> {
    const envelope = this.createEnvelope(
      'escritorio.compras.criar_pedido',
      'pedido_compra',
      payload.pedido_compra_id,
      payload
    );

    this.state.pedidosCompra.unshift({
      pedido_compra_id: payload.pedido_compra_id,
      fornecedor_id: payload.fornecedor_id,
      fornecedor_nome: payload.fornecedor_id,
      produto_insumo_id: payload.produto_insumo_id,
      produto_nome: payload.produto_insumo_id,
      quantidade_pedida: payload.quantidade_pedida,
      unidade: payload.unidade,
      preco_unitario_brl: payload.preco_unitario_brl,
      condicao_pagamento: payload.condicao_pagamento,
      previsao_entrega: payload.previsao_entrega,
      status: 'pendente'
    });

    this.state.kpis.comprasAprovadas += 1;
    this.persist();
    return envelope;
  }

  public cadastrarLote(payload: CriarLotePayload): AtomicCommandEnvelope<CriarLotePayload> {
    const envelope = this.createEnvelope(
      'escritorio.lotes.cadastrar',
      'lote',
      payload.lote_id,
      payload
    );

    this.state.lotes.push({
      lote_id: payload.lote_id,
      fazenda_id: payload.fazenda_id,
      pasto_id: payload.pasto_id,
      nome_lote: payload.nome_lote,
      categoria_animal: payload.categoria_animal,
      quantidade_cabecas: payload.quantidade_cabecas,
      peso_medio_inicial_kg: payload.peso_medio_inicial_kg,
      data_entrada: payload.data_entrada
    });

    this.persist();
    return envelope;
  }

  public particionarLote(payload: ParticionarLotePayload): AtomicCommandEnvelope<ParticionarLotePayload> {
    const envelope = this.createEnvelope(
      'escritorio.lotes.particionar',
      'lote',
      payload.lote_origem_id,
      payload
    );

    // Adiciona os novos lotes desdobrados
    for (let i = 0; i < payload.novos_lotes.length; i++) {
      const nl = payload.novos_lotes[i]!;
      this.state.lotes.push({
        lote_id: `lote-part-${Date.now()}-${i}`,
        fazenda_id: 'fazenda-01',
        pasto_id: nl.pasto_destino_id,
        nome_lote: nl.nome_lote,
        categoria_animal: 'garrote',
        quantidade_cabecas: nl.quantidade_cabecas,
        peso_medio_inicial_kg: nl.peso_medio_kg,
        data_entrada: payload.data_particao
      });
    }

    this.persist();
    return envelope;
  }

  public fecharCustoLote(payload: FecharCustoLotePayload): AtomicCommandEnvelope<FecharCustoLotePayload> {
    const envelope = this.createEnvelope(
      'escritorio.custos.fechar',
      'lote',
      payload.lote_id,
      payload
    );

    this.state.fechamentos.push({
      lote_id: payload.lote_id,
      periodo_mes: payload.periodo_mes,
      periodo_ano: payload.periodo_ano,
      custo_nutricao_brl: payload.custo_nutricao_brl,
      custo_sanidade_brl: payload.custo_sanidade_brl,
      custo_pastagem_brl: payload.custo_pastagem_brl,
      custo_operacional_brl: payload.custo_operacional_brl,
      valor_total_apropriado_brl: payload.valor_total_apropriado_brl,
      fechado_em: payload.fechado_em
    });

    this.persist();
    return envelope;
  }

  public emitirRelatorio(payload: EmitirRelatorioFinanceiroPayload): AtomicCommandEnvelope<EmitirRelatorioFinanceiroPayload> {
    const envelope = this.createEnvelope(
      'escritorio.relatorios.emitir',
      'relatorio',
      payload.relatorio_id,
      payload
    );

    this.persist();
    return envelope;
  }
}

let defaultEscritorioStore: EscritorioStore | null = null;

export function getEscritorioStore(partitionKey?: string): EscritorioStore {
  if (!defaultEscritorioStore || partitionKey) {
    defaultEscritorioStore = new EscritorioStore(partitionKey);
  }
  return defaultEscritorioStore;
}
