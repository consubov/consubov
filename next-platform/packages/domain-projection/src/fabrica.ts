import { createModuleProjection, type CommandDefinition } from './shared';
import type {
  AtomicCommandEnvelope,
  CriarFormulaRacaoPayload,
  IniciarBatidaPayload,
  ConcluirBatidaPayload,
  AjustarEstoqueMateriaPrimaPayload,
  ReceberMateriaPrimaPayload,
  CalibrarBalancaMisturadorPayload,
  IngredienteFormula
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
  localRevision: number;
}


// Extracted existing module mutations. No browser store or runtime is imported.
export function reduceFabricaFormulasSalvar(next: FabricaState, payload: CriarFormulaRacaoPayload, command: AtomicCommandEnvelope<unknown>): void {

    const existingIndex = next.formulas.findIndex(f => f.formula_id === payload.formula_id);
    if (existingIndex >= 0) {
      next.formulas[existingIndex] = payload;
    } else {
      next.formulas.push(payload);
    }

}
export function reduceFabricaBatidasIniciar(next: FabricaState, payload: IniciarBatidaPayload, command: AtomicCommandEnvelope<unknown>): void {

    next.batidas.unshift({
      batida_id: payload.batida_id,
      ordem_producao_id: payload.ordem_producao_id,
      formula_id: payload.formula_id,
      misturador_id: payload.misturador_id,
      quantidade_planejada_kg: payload.quantidade_planejada_kg,
      operador_id: payload.operador_id,
      iniciado_em: payload.iniciado_em,
      status: 'em_andamento'
    });

    const mixer = next.misturadores.find(m => m.misturador_id === payload.misturador_id);
    if (mixer) {
      mixer.status = 'misturando';
      mixer.batida_atual_id = payload.batida_id;
    }

}
export function reduceFabricaBatidasConcluir(next: FabricaState, payload: ConcluirBatidaPayload, command: AtomicCommandEnvelope<unknown>): void {

    const batida = next.batidas.find(b => b.batida_id === payload.batida_id);
    if (batida) {
      batida.quantidade_realizada_kg = payload.quantidade_realizada_kg;
      batida.tempo_mistura_segundos = payload.tempo_mistura_segundos;
      batida.finalizado_em = payload.finalizado_em;
      batida.desvio_peso_kg = payload.desvio_peso_kg;
      batida.status = 'concluida';

      const mixer = next.misturadores.find(m => m.misturador_id === batida.misturador_id);
      if (mixer) {
        mixer.status = 'ocioso';
        mixer.batida_atual_id = undefined;
      }

      // Baixa automática proporcional das matérias-primas nos silos correspondentes
      const formula = next.formulas.find(f => f.formula_id === batida.formula_id);
      if (formula) {
        for (const ing of formula.ingredientes) {
          const consumoKg = (payload.quantidade_realizada_kg * ing.porcentagem_inclusao) / 100;
          const silo = next.silos.find(s => s.materia_prima_id === ing.materia_prima_id);
          if (silo) {
            silo.nivel_atual_kg = Math.max(0, silo.nivel_atual_kg - consumoKg);
            silo.ocupacao_pct = Math.round((silo.nivel_atual_kg / silo.capacidade_total_kg) * 1000) / 10;
          }
        }
      }

      next.kpis.producaoHojeKg += payload.quantidade_realizada_kg;
    }

}
export function reduceFabricaEstoqueAjustar(next: FabricaState, payload: AjustarEstoqueMateriaPrimaPayload, command: AtomicCommandEnvelope<unknown>): void {

    const silo = next.silos.find(s => s.silo_id === payload.silo_id);
    if (silo) {
      silo.nivel_atual_kg = payload.quantidade_ajustada_kg;
      silo.ocupacao_pct = Math.round((payload.quantidade_ajustada_kg / silo.capacidade_total_kg) * 1000) / 10;
    }

}
export function reduceFabricaMateria_PrimaReceber(next: FabricaState, payload: ReceberMateriaPrimaPayload, command: AtomicCommandEnvelope<unknown>): void {

    const silo = next.silos.find(s => s.silo_id === payload.silo_destino_id);
    if (silo) {
      silo.nivel_atual_kg += payload.quantidade_kg;
      silo.ocupacao_pct = Math.round((silo.nivel_atual_kg / silo.capacidade_total_kg) * 1000) / 10;
    }

}
export function reduceFabricaBalancaCalibrar(next: FabricaState, payload: CalibrarBalancaMisturadorPayload, command: AtomicCommandEnvelope<unknown>): void {

    next.calibracoes.unshift({
      balanca_id: payload.balanca_id,
      equipamento_tipo: payload.equipamento_tipo,
      peso_padrao_kg: payload.peso_padrao_afericao_kg,
      peso_medido_kg: payload.peso_medido_kg,
      desvio_pct: payload.desvio_percentual,
      calibrado: payload.calibrado,
      data_calibracao: payload.data_calibracao
    });

}

const definitions: Record<string, CommandDefinition> = {
  'fabrica.formulas.salvar': { moduleId: 'fabrica', aggregateType: 'formula', idField: 'formula_id', apply: (state, payload, command) => reduceFabricaFormulasSalvar(state as FabricaState, payload as Parameters<typeof reduceFabricaFormulasSalvar>[1], command) },
  'fabrica.batidas.iniciar': { moduleId: 'fabrica', aggregateType: 'batida', idField: 'batida_id', apply: (state, payload, command) => reduceFabricaBatidasIniciar(state as FabricaState, payload as Parameters<typeof reduceFabricaBatidasIniciar>[1], command) },
  'fabrica.batidas.concluir': { moduleId: 'fabrica', aggregateType: 'batida', idField: 'batida_id', apply: (state, payload, command) => reduceFabricaBatidasConcluir(state as FabricaState, payload as Parameters<typeof reduceFabricaBatidasConcluir>[1], command) },
  'fabrica.estoque.ajustar': { moduleId: 'fabrica', aggregateType: 'silo', idField: 'silo_id', apply: (state, payload, command) => reduceFabricaEstoqueAjustar(state as FabricaState, payload as Parameters<typeof reduceFabricaEstoqueAjustar>[1], command) },
  'fabrica.materia_prima.receber': { moduleId: 'fabrica', aggregateType: 'silo', idField: 'silo_destino_id', apply: (state, payload, command) => reduceFabricaMateria_PrimaReceber(state as FabricaState, payload as Parameters<typeof reduceFabricaMateria_PrimaReceber>[1], command) },
  'fabrica.balanca.calibrar': { moduleId: 'fabrica', aggregateType: 'balanca', idField: 'balanca_id', apply: (state, payload, command) => reduceFabricaBalancaCalibrar(state as FabricaState, payload as Parameters<typeof reduceFabricaBalancaCalibrar>[1], command) },
};
const aliases: Record<string, string> = {"criar_formula_racao": "fabrica.formulas.salvar", "ajustar_estoque_materia_prima": "fabrica.estoque.ajustar", "calibrar_balanca_misturador": "fabrica.balanca.calibrar"};
export const SUPPORTED_COMMANDS: readonly string[] = Object.freeze([...Object.keys(definitions), ...Object.keys(aliases)]);
const apply = createModuleProjection('fabrica', definitions, aliases);
export function applyModuleCommand<T extends object>(moduleId: 'fabrica', current: T, command: AtomicCommandEnvelope<unknown>): T { return apply(current, command); }
