import { dataLocalSaoPaulo } from "./calendario";
import { calcularGmdLote, diasEntrePesagens } from "./pesagem";

/**
 * Não se finaliza pesagem sem nenhum peso
 * (PecuaristaPesagemExecPage.tsx:502, PesadorPesagemExecPage.tsx:436-439,
 * PesagemFlowModal.tsx:80-83).
 */
export function podeFinalizarPesagem(pesos: readonly number[]): boolean {
  return pesos.length > 0;
}

/**
 * Lote sem identificação não persiste peso por animal: só os totais entram na
 * pesagem (PecuaristaPesagemExecPage.tsx:461-462). Lote identificado persiste o
 * peso de cada animal.
 */
export function persistePesoPorAnimal(loteIdentificado: boolean): boolean {
  return loteIdentificado;
}

export type FechamentoPesagem =
  | { readonly ok: false; readonly motivo: "nenhum_peso_registrado" }
  | {
      readonly ok: true;
      readonly quantidadeAnimais: number;
      readonly pesoTotalKg: number;
      /** Sem arredondamento: é a divisão persistida da coluna (PecuaristaPesagemExecPage.tsx:511, :558). */
      readonly pesoMedioKg: number;
      readonly persistePesoPorAnimal: boolean;
      /** `null` em lote sem identificação: os pesos ficam só nos totais. */
      readonly pesosPorAnimal: readonly number[] | null;
      /** Só existe para lote sem identificação; no identificado o GMD é por animal. */
      readonly gmdLoteKgDia: number | null;
    };

/**
 * Fecha uma pesagem de lote: valida que há pesos, calcula os totais e decide o
 * que pode ser persistido.
 *
 * O GMD do lote é derivado apenas para lote sem identificação, comparando o
 * peso médio com a pesagem anterior de maior data
 * (PecuaristaPesagemExecPage.tsx:513-529, :570-582).
 */
export function planejarFechamentoPesagem(input: {
  loteIdentificado: boolean;
  pesos: readonly number[];
  dataPesagem: string;
  pesoMedioAnteriorKg?: number | null;
  dataAnterior?: string | null;
}): FechamentoPesagem {
  if (!podeFinalizarPesagem(input.pesos)) {
    return { ok: false, motivo: "nenhum_peso_registrado" };
  }

  const pesoTotalKg = input.pesos.reduce((soma, peso) => soma + peso, 0);
  const pesoMedioKg = pesoTotalKg / input.pesos.length;
  const persistir = persistePesoPorAnimal(input.loteIdentificado);

  let gmdLoteKgDia: number | null = null;
  if (!persistir && input.dataAnterior && dataLocalSaoPaulo(input.dataPesagem)) {
    gmdLoteKgDia = calcularGmdLote({
      pesoMedioAtualKg: pesoMedioKg,
      pesoMedioAnteriorKg: input.pesoMedioAnteriorKg ?? null,
      dias: diasEntrePesagens(input.dataAnterior, input.dataPesagem),
    });
  }

  return {
    ok: true,
    quantidadeAnimais: input.pesos.length,
    pesoTotalKg,
    pesoMedioKg,
    persistePesoPorAnimal: persistir,
    pesosPorAnimal: persistir ? [...input.pesos] : null,
    gmdLoteKgDia,
  };
}