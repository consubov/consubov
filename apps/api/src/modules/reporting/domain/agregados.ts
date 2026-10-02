/**
 * Status de consumo já gravado no lançamento. Este módulo NÃO classifica: ele
 * apenas agrega valores classificados, cuja regra pertence a `nutrition`
 * (apps/web/src/lib/consumoCalc.ts:57-73 e :208-213). O catálogo espelha os
 * literais aceitos pelo legado, incluindo o dialeto legado em caixa alta
 * (apps/web/src/lib/consumoCalc.ts:165-177) que os painéis antigos ainda leem.
 */
export type StatusConsumo =
  | "Baixo"
  | "Atenção"
  | "Ideal"
  | "Alto"
  | "ERRO"
  | "ABAIXO"
  | "ACIMA"
  | "IDEAL";

/**
 * "Atenção" também é um status de consumo gravado em lançamento, e o painel o
 * trata como dentro da meta (apps/web/src/lib/painelMetrics.ts:235-236,258).
 */
export type StatusConsumoCatalogo = StatusConsumo;

export type StatusDist = {
  baixo: number;
  /** Ideal + Atenção. */
  ideal: number;
  alto: number;
  baixoPct: number;
  idealPct: number;
  altoPct: number;
};

/**
 * Contagem por status com "Atenção" somada ao segmento "Ideal", e o percentual
 * de cada segmento sobre o total de lançamentos que possuem status
 * (apps/web/src/lib/painelMetrics.ts:231-247). Lançamento sem status não entra
 * no total.
 */
export function statusDistinguido(
  lancamentos: readonly { status_consumo: StatusConsumoCatalogo | null }[],
): StatusDist {
  const comStatus = lancamentos.filter((lancamento) => lancamento.status_consumo);
  const total = comStatus.length;

  const baixo = comStatus.filter((lancamento) => lancamento.status_consumo === "Baixo").length;
  const ideal = comStatus.filter(
    (lancamento) =>
      lancamento.status_consumo === "Ideal" || lancamento.status_consumo === "Atenção",
  ).length;
  const alto = comStatus.filter((lancamento) => lancamento.status_consumo === "Alto").length;

  return {
    baixo,
    ideal,
    alto,
    baixoPct: total > 0 ? (baixo / total) * 100 : 0,
    idealPct: total > 0 ? (ideal / total) * 100 : 0,
    altoPct: total > 0 ? (alto / total) * 100 : 0,
  };
}

/**
 * Um pasto está na meta quando seu status é Ideal ou Atenção
 * (apps/web/src/lib/painelMetrics.ts:249-259).
 */
export function estaNaMeta(status: StatusConsumoCatalogo | null): boolean {
  return status === "Ideal" || status === "Atenção";
}

/**
 * Agregado do painel. A API NÃO recalcula nenhum destes campos: recebe o
 * agregado já pronto do adaptador. Os campos são os que
 * `calculatePainelMetrics` produz
 * (apps/web/src/lib/painelMetrics.ts:131-146,298-350).
 */
export type PainelMetricsAggregate = {
  totalAnimais: number;
  sacosUtilizados: number;
  consumoMedio: number;
  pastosNaMeta: number;
  totalPastos: number;
  custoDiario: number;
  custoMensal: number;
  eficiencia: number;
  gmdMedio: number;
  totalSalgas: number;
  statusDist: StatusDist;
  totalKgConsumido: number;
  totalCabDias: number;
  totalCusto: number;
};

/**
 * Agregado por retiro, com os mesmos campos de `calculateRetiroMetrics`
 * (apps/web/src/lib/painelMetrics.ts:148-156,352-399).
 */
export type RetiroMetricsAggregate = {
  totalAnimais: number;
  sacosUtilizados: number;
  consumoMedio: number;
  gmd: number;
  totalKgConsumido: number;
  totalCabDias: number;
  totalCusto: number;
};