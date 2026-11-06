import { createModuleProjection, type CommandDefinition } from './shared';
import type {
  AtomicCommandEnvelope,
  RegistrarNotaFiscalPayload,
  RegistrarCompraInsumoPayload,
  CriarLotePayload,
  ParticionarLotePayload,
  FecharCustoLotePayload,
  EmitirRelatorioFinanceiroPayload,
  ItemNotaFiscal
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
  localRevision: number;
  persistenceError: string | null;
}


// Extracted existing module mutations. No browser store or runtime is imported.
export function reduceEscritorioNotasRegistrar_Entrada(next: EscritorioState, payload: RegistrarNotaFiscalPayload, command: AtomicCommandEnvelope<unknown>): void {

        next.notasFiscais.unshift({
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
        next.kpis.pendentesConferencia = Math.max(0, next.kpis.pendentesConferencia - 1);
      
}
export function reduceEscritorioComprasCriar_Pedido(next: EscritorioState, payload: RegistrarCompraInsumoPayload, command: AtomicCommandEnvelope<unknown>): void {

        next.pedidosCompra.unshift({
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
        next.kpis.comprasAprovadas += 1;
      
}
export function reduceEscritorioLotesCadastrar(next: EscritorioState, payload: CriarLotePayload, command: AtomicCommandEnvelope<unknown>): void {
next.lotes.push({
        lote_id: payload.lote_id,
        fazenda_id: payload.fazenda_id,
        pasto_id: payload.pasto_id,
        nome_lote: payload.nome_lote,
        categoria_animal: payload.categoria_animal,
        quantidade_cabecas: payload.quantidade_cabecas,
        peso_medio_inicial_kg: payload.peso_medio_inicial_kg,
        data_entrada: payload.data_entrada
      });
}
export function reduceEscritorioLotesParticionar(next: EscritorioState, payload: ParticionarLotePayload, command: AtomicCommandEnvelope<unknown>): void {

        for (let i = 0; i < payload.novos_lotes.length; i++) {
          const nl = payload.novos_lotes[i]!;
          next.lotes.push({
            lote_id: `lote-part-${command.command_id}-${i}`,
            fazenda_id: command.fazenda_id,
            pasto_id: nl.pasto_destino_id,
            nome_lote: nl.nome_lote,
            categoria_animal: 'garrote',
            quantidade_cabecas: nl.quantidade_cabecas,
            peso_medio_inicial_kg: nl.peso_medio_kg,
            data_entrada: payload.data_particao
          });
        }
      
}
export function reduceEscritorioCustosFechar(next: EscritorioState, payload: FecharCustoLotePayload, command: AtomicCommandEnvelope<unknown>): void {
next.fechamentos.push({
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
}
export function reduceEscritorioRelatoriosEmitir(next: EscritorioState, payload: EmitirRelatorioFinanceiroPayload, command: AtomicCommandEnvelope<unknown>): void {
// Existing operation only records a request; no report is generated.
}

const definitions: Record<string, CommandDefinition> = {
  'escritorio.notas.registrar_entrada': { moduleId: 'escritorio', aggregateType: 'nota_fiscal', idField: 'nota_fiscal_id', apply: (state, payload, command) => reduceEscritorioNotasRegistrar_Entrada(state as EscritorioState, payload as Parameters<typeof reduceEscritorioNotasRegistrar_Entrada>[1], command) },
  'escritorio.compras.criar_pedido': { moduleId: 'escritorio', aggregateType: 'pedido_compra', idField: 'pedido_compra_id', apply: (state, payload, command) => reduceEscritorioComprasCriar_Pedido(state as EscritorioState, payload as Parameters<typeof reduceEscritorioComprasCriar_Pedido>[1], command) },
  'escritorio.lotes.cadastrar': { moduleId: 'escritorio', aggregateType: 'lote', idField: 'lote_id', apply: (state, payload, command) => reduceEscritorioLotesCadastrar(state as EscritorioState, payload as Parameters<typeof reduceEscritorioLotesCadastrar>[1], command) },
  'escritorio.lotes.particionar': { moduleId: 'escritorio', aggregateType: 'lote', idField: 'lote_origem_id', apply: (state, payload, command) => reduceEscritorioLotesParticionar(state as EscritorioState, payload as Parameters<typeof reduceEscritorioLotesParticionar>[1], command) },
  'escritorio.custos.fechar': { moduleId: 'escritorio', aggregateType: 'lote', idField: 'lote_id', apply: (state, payload, command) => reduceEscritorioCustosFechar(state as EscritorioState, payload as Parameters<typeof reduceEscritorioCustosFechar>[1], command) },
  'escritorio.relatorios.emitir': { moduleId: 'escritorio', aggregateType: 'relatorio', idField: 'relatorio_id', apply: (state, payload, command) => reduceEscritorioRelatoriosEmitir(state as EscritorioState, payload as Parameters<typeof reduceEscritorioRelatoriosEmitir>[1], command) },
};
const aliases: Record<string, string> = {"registrar_nota_fiscal": "escritorio.notas.registrar_entrada", "registrar_compra_insumo": "escritorio.compras.criar_pedido", "fechar_custo_lote": "escritorio.custos.fechar", "emitir_relatorio_financeiro": "escritorio.relatorios.emitir"};
export const SUPPORTED_COMMANDS: readonly string[] = Object.freeze([...Object.keys(definitions), ...Object.keys(aliases)]);
const apply = createModuleProjection('escritorio', definitions, aliases);
export function applyModuleCommand<T extends object>(moduleId: 'escritorio', current: T, command: AtomicCommandEnvelope<unknown>): T { return apply(current, command); }
