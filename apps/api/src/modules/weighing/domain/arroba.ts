import { truncar2 } from "./arredondamento";

/**
 * Arroba de CARCAÇA: `peso_carcaca (peso_vivo × rendimento%) ÷ 15`
 * (pesagemCompra.ts:33-34, :66, :98). É a unidade de pagamento.
 */
export const KG_POR_ARROBA_CARCACA = 15;

/**
 * Arroba de RÓTULO: peso vivo ÷ 30, usada só para exibição
 * (PecuaristaPesagemExecPage.tsx:698, PecuaristaPesagemResumoPage.tsx:154).
 *
 * Não é usada para pagar: as duas derivações divergem de propósito e não devem
 * ser unificadas.
 */
export const KG_POR_ARROBA_ROTULO = 30;

export function arrobaDeCarcaça(pesoKg: number): number {
  return truncar2(pesoKg / KG_POR_ARROBA_CARCACA);
}

export function kgDeArrobaDeCarcaça(arroba: number): number {
  return arroba * KG_POR_ARROBA_CARCACA;
}

export function arrobaDeRotulo(pesoKg: number): number {
  return pesoKg / KG_POR_ARROBA_ROTULO;
}

export function kgDeArrobaDeRotulo(arroba: number): number {
  return arroba * KG_POR_ARROBA_ROTULO;
}

/**
 * Peso pagável de um animal: peso vivo × percentual de rendimento
 * (pesagemCompra.ts:65, :97).
 */
export function calcularPesoPagavel(pesoKg: number, percentual: number): number {
  return (pesoKg * percentual) / 100;
}