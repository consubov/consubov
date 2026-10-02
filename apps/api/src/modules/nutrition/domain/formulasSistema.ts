/**
 * Fórmulas de sistema: eficiência e classificação por índice de consumo.
 *
 * Não confundir com a fórmula de fábrica (mistura de matérias-primas) que pertence
 * ao módulo de fábrica de ração. Aqui "fórmula" é a parametrização do sistema.
 */

export type OrigemFormulaSistema = "db" | "fallback";

export type StatusFormulaSistema = "Baixo" | "Ideal" | "Alto";

export type FormulaConfig = {
  eficiencia: {
    /** Recebe um índice de consumo (real/esperado) e devolve 0..100. */
    compute: (indice: number) => number;
    source: OrigemFormulaSistema;
  };
  classificacao: {
    limiteBaixo: number;
    limiteAlto: number;
    classify: (indice: number) => StatusFormulaSistema;
    source: OrigemFormulaSistema;
  };
};

/**
 * Eficiência padrão: distância do índice até o alvo 1,0, limitada a 0..100.
 * Equivale ao padrão registrado em produção da fórmula de eficiência.
 * Origem: apps/web/src/lib/formulasSistema.ts:21-24 e :45-50.
 */
export function computeEficienciaPadrao(indice: number): number {
  const raw = 100 - Math.abs(1 - indice) * 100;
  return Math.max(0, Math.min(100, raw));
}

/**
 * Classificação por limites: abaixo do limite baixo é Baixo, acima do limite alto é
 * Alto, e as bordas pertencem ao ideal.
 * Origem: apps/web/src/lib/formulasSistema.ts:30-34 e :52-58.
 */
export function classificarPorLimites(
  indice: number,
  limiteBaixo: number,
  limiteAlto: number,
): StatusFormulaSistema {
  if (indice < limiteBaixo) return "Baixo";
  if (indice > limiteAlto) return "Alto";
  return "Ideal";
}

/**
 * Parâmetros usados quando a parametrização do sistema não está disponível.
 *
 * O texto da fórmula gravado no banco NÃO é interpretado: a leitura verifica apenas
 * se a entrada existe e, quando existe, aplica o padrão matemático equivalente.
 * Texto diferente do padrão não produz cálculo distinto.
 * Origem: apps/web/src/lib/formulasSistema.ts:19-37 e o comentário em :39-44.
 */
export const FORMULAS_FALLBACK: FormulaConfig = {
  eficiencia: {
    compute: computeEficienciaPadrao,
    source: "fallback",
  },
  classificacao: {
    limiteBaixo: 0.9,
    limiteAlto: 1.1,
    classify: (indice: number) => classificarPorLimites(indice, 0.9, 1.1),
    source: "fallback",
  },
};
