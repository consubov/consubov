/**
 * Taxas derivadas de um agregado de consumo do período.
 *
 * A soma dos campos por linha e a montagem do agregado vivem no módulo dono da
 * leitura (a origem é uma projeção do banco); aqui ficam só as aritméticas de
 * taxa, que não dependem da forma da linha.
 * Origem: apps/web/src/hooks/useConsumoMineral.ts:86-89.
 */

/** Consumo médio em g/cab/dia do período: kg consumidos sobre animal-dia. */
export function consumoMedioGCabDia(
  totalKgConsumido: number,
  totalCabDias: number,
): number {
  return totalCabDias > 0 ? (totalKgConsumido * 1000) / totalCabDias : 0;
}

/** Custo diário por cabeça. */
export function custoDiarioPorCabDia(
  totalCusto: number,
  totalCabDias: number,
): number {
  return totalCabDias > 0 ? totalCusto / totalCabDias : 0;
}

/**
 * GMD médio do período. Somente valores positivos entram na média: pasto sem GMD
 * medido não pode puxar a média do conjunto para zero.
 * Origem: apps/web/src/hooks/useConsumoMineral.ts:81-82, :89.
 */
export function mediaGmdValido(
  valores: readonly (number | null | undefined)[],
): number {
  let soma = 0;
  let contagem = 0;

  for (const valor of valores) {
    const gmd = Number(valor) || 0;
    if (gmd > 0) {
      soma += gmd;
      contagem += 1;
    }
  }

  return contagem > 0 ? soma / contagem : 0;
}
