import type { GerenteCustoRetiro } from "@/features/painel/repositories/gerenteCustosRepository";

/** The manager cost cards preserve the legacy weighted-head-day formula. */
export function aggregateGerenteCustos(
  rows: readonly GerenteCustoRetiro[],
  retiroId?: string | null,
): { sacosUtilizados: number; custoMensal: number; custoDiario: number } {
  const selected = retiroId ? rows.filter((r) => r.retiro_id === retiroId) : rows;
  const custoMensal = selected.reduce((sum, r) => sum + r.custo_mensal, 0);
  const dias = selected.reduce((sum, r) => sum + r.total_cab_dias, 0);
  return {
    sacosUtilizados: selected.reduce((sum, r) => sum + r.total_sacos, 0),
    custoMensal,
    custoDiario: dias > 0 ? custoMensal / dias : 0,
  };
}
