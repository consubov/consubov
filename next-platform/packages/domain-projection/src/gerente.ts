import { createModuleProjection, type CommandDefinition } from './shared';
import type {
  AtomicCommandEnvelope,
  DefinirMetasPayload,
  AjustarDietaPayload,
  MovimentacaoLotePayload,
  ApropriarCustosPayload,
  AprovarLeituraCochoPayload
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
  localRevision: number;
}


// Extracted existing module mutations. No browser store or runtime is imported.
export function reduceGerenteMetasDefinir(next: GerenteState, payload: DefinirMetasPayload, command: AtomicCommandEnvelope<unknown>): void {

    const lote = next.lotes.find(l => l.lote_id === payload.lote_id);
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

    next.kpis.gmdMeta = payload.gmd_alvo_kg_dia;
}
export function reduceGerenteGmdAjustar_Curva(next: GerenteState, payload: AjustarDietaPayload, command: AtomicCommandEnvelope<unknown>): void {

    const lote = next.lotes.find(l => l.lote_id === payload.lote_id);
    if (lote) {
      lote.consumo_esperado_g_cab_dia = payload.nova_meta_consumo_g_cab_dia;
    }

}
export function reduceGerenteLoteTransferir_Pasto(next: GerenteState, payload: MovimentacaoLotePayload, command: AtomicCommandEnvelope<unknown>): void {

    const lote = next.lotes.find(l => l.lote_id === payload.lote_id);
    if (lote) {
      lote.pasto_id = payload.pasto_destino_id;
      lote.pasto_nome = payload.pasto_destino_id;
    }

}
export function reduceGerenteCustosApropriar(next: GerenteState, payload: ApropriarCustosPayload, command: AtomicCommandEnvelope<unknown>): void {

    const total = payload.valor_total_apropriado;
    next.custos = payload.itens_apropriacao.map(item => ({
      centro_custo: item.centro_custo,
      valor: item.valor,
      percentual: total > 0 ? Math.round((item.valor / total) * 100) : 0
    }));

}
export function reduceGerenteLeitura_CochoAprovar(next: GerenteState, payload: AprovarLeituraCochoPayload, command: AtomicCommandEnvelope<unknown>): void {

    const leitura = next.auditoriasCocho.find(a => a.leitura_cocho_id === payload.leitura_cocho_id);
    if (leitura) {
      leitura.status = payload.status_aprovacao;
      if (payload.escore_revisado !== undefined) {
        leitura.escore_revisado = payload.escore_revisado;
      }
      if (payload.novo_fornecimento_sacos !== undefined) {
        leitura.sacos_fornecidos = payload.novo_fornecimento_sacos;
      }
    }

}

const definitions: Record<string, CommandDefinition> = {
  'gerente.metas.definir': { moduleId: 'gerente', aggregateType: 'lote', idField: 'lote_id', apply: (state, payload, command) => reduceGerenteMetasDefinir(state as GerenteState, payload as Parameters<typeof reduceGerenteMetasDefinir>[1], command) },
  'gerente.gmd.ajustar_curva': { moduleId: 'gerente', aggregateType: 'lote', idField: 'lote_id', apply: (state, payload, command) => reduceGerenteGmdAjustar_Curva(state as GerenteState, payload as Parameters<typeof reduceGerenteGmdAjustar_Curva>[1], command) },
  'gerente.lote.transferir_pasto': { moduleId: 'gerente', aggregateType: 'lote', idField: 'lote_id', apply: (state, payload, command) => reduceGerenteLoteTransferir_Pasto(state as GerenteState, payload as Parameters<typeof reduceGerenteLoteTransferir_Pasto>[1], command) },
  'gerente.custos.apropriar': { moduleId: 'gerente', aggregateType: 'lote', idField: 'lote_id', apply: (state, payload, command) => reduceGerenteCustosApropriar(state as GerenteState, payload as Parameters<typeof reduceGerenteCustosApropriar>[1], command) },
  'gerente.leitura_cocho.aprovar': { moduleId: 'gerente', aggregateType: 'leitura_cocho', idField: 'leitura_cocho_id', apply: (state, payload, command) => reduceGerenteLeitura_CochoAprovar(state as GerenteState, payload as Parameters<typeof reduceGerenteLeitura_CochoAprovar>[1], command) },
};
const aliases: Record<string, string> = {"definir_metas": "gerente.metas.definir", "aprovar_leitura_cocho": "gerente.leitura_cocho.aprovar", "ajustar_dieta": "gerente.gmd.ajustar_curva"};
export const SUPPORTED_COMMANDS: readonly string[] = Object.freeze([...Object.keys(definitions), ...Object.keys(aliases)]);
const apply = createModuleProjection('gerente', definitions, aliases);
export function applyModuleCommand<T extends object>(moduleId: 'gerente', current: T, command: AtomicCommandEnvelope<unknown>): T { return apply(current, command); }
