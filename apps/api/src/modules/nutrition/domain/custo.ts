import type { ProdutoCustoRef } from "./produto";

/**
 * Entrada do custo de um lançamento. `cabDias` chega pronto porque o cálculo de
 * animal-dia a partir da linha do lançamento, com o recorte do mês de referência,
 * pertence ao módulo dono desse registro — não a nutrição.
 * Origem da divisão: apps/web/src/lib/painelMetrics.ts:178-186.
 */
export type EntradaCustoLote = {
  numSacos: number | null | undefined;
  consumoGCabDia: number | null | undefined;
  cabDias: number;
};

export type CustoLote = {
  pesoSacoKg: number;
  precoKg: number;
  totalKgFromSacos: number;
  totalKgFallback: number;
  totalKgConsumido: number;
  totalCusto: number;
};

/**
 * Normaliza para não negativo: ausente, não numérico, zero e negativo viram 0.
 * Origem: apps/web/src/lib/painelMetrics.ts:163-172.
 */
export function naoNegativo(valor: number | null | undefined): number {
  const parsed = Number(valor ?? 0);
  const base = Number.isFinite(parsed) ? parsed : 0;
  return base > 0 ? base : 0;
}

/**
 * Custo e quantidade consumida de um lançamento.
 * Origem: apps/web/src/lib/painelMetrics.ts:284-289.
 *
 * Sacos é a fonte primária de kg; o consumo por cabeça guardado no lançamento só
 * entra quando não há saco informado. Preço ou peso do saco ausentes zeram o custo
 * em vez de gerar custo parcial, porque não há base confiável para estimar.
 */
export function calcularCustoLote(
  produto: ProdutoCustoRef | null | undefined,
  entrada: EntradaCustoLote,
): CustoLote {
  const pesoSacoKg = naoNegativo(produto?.peso_saco_kg);
  const precoKg = naoNegativo(produto?.preco_por_kg);

  const totalKgFromSacos = naoNegativo(entrada.numSacos) * pesoSacoKg;
  const totalKgFallback =
    entrada.cabDias > 0
      ? (naoNegativo(entrada.consumoGCabDia) * entrada.cabDias) / 1000
      : 0;

  const totalKgConsumido =
    totalKgFromSacos > 0 ? totalKgFromSacos : totalKgFallback;
  const totalCusto =
    totalKgConsumido > 0 && precoKg > 0 ? totalKgConsumido * precoKg : 0;

  return {
    pesoSacoKg,
    precoKg,
    totalKgFromSacos,
    totalKgFallback,
    totalKgConsumido,
    totalCusto,
  };
}
