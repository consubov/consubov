import type { BatidaStatus } from "./batida";
import type { FormulaId } from "./identifiers";

/** Batida tal como entra no cálculo de eficiência. */
export type BatidaParaEficiencia = {
  formulaId: FormulaId;
  quantidadeProduzida: number | null;
  status: BatidaStatus;
};

export type EficienciaBatidas = {
  numBatidas: number;
  /** Soma das quantidades declaradas nas batidas finalizadas. */
  producaoDeclarada: number;
  /** Soma da produção esperada das fórmulas usadas por essas batidas. */
  producaoTeorica: number;
  /** Teórica menos declarada, positiva quando a fábrica produziu menos. */
  diferenca: number;
  eficienciaPct: number;
};

/**
 * Eficiência de produção da fábrica no período.
 *
 * Só batidas finalizadas contam, porque batida iniciada não tem produção
 * declarada; o filtro é reaplicado aqui mesmo quando a leitura já o tenha feito,
 * para que a conta não dependa de quem montou a lista.
 *
 * Batida cuja fórmula não está no mapa de produção esperada não soma teórica, o
 * que zera a eficiência em vez de inflar o denominador. Sem produção esperada a
 * eficiência é zero em vez de divisão por zero.
 * Origem: apps/web/src/components/fabrica/ProducaoTab.tsx:870-883.
 */
export function calcularEficienciaBatidas(
  batidas: readonly BatidaParaEficiencia[],
  producaoEsperadaPorFormula: ReadonlyMap<string, number>,
): EficienciaBatidas {
  let producaoDeclarada = 0;
  let producaoTeorica = 0;
  let numBatidas = 0;

  for (const batida of batidas) {
    if (batida.status !== "finalizada") continue;

    numBatidas += 1;
    producaoDeclarada += Number(batida.quantidadeProduzida ?? 0);
    producaoTeorica += producaoEsperadaPorFormula.get(batida.formulaId) ?? 0;
  }

  return {
    numBatidas,
    producaoDeclarada,
    producaoTeorica,
    diferenca: producaoTeorica - producaoDeclarada,
    eficienciaPct:
      producaoTeorica > 0 ? (producaoDeclarada / producaoTeorica) * 100 : 0,
  };
}
