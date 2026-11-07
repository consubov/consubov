import { describe, expect, it } from "vitest";
import { aggregateGerenteCustos } from "@/lib/gerenteCustosAggregate";
import type { GerenteCustoRetiro } from "@/features/painel/repositories/gerenteCustosRepository";

const rows: GerenteCustoRetiro[] = [
  { retiro_id: "a", total_sacos: 94, total_cab_dias: 19250,
    custo_mensal: 7501.20, custo_diario: 0.3897 },
  { retiro_id: "b", total_sacos: 217, total_cab_dias: 53650,
    custo_mensal: 17316.60, custo_diario: 0.3228 },
  { retiro_id: "c", total_sacos: 191, total_cab_dias: 56831,
    custo_mensal: 15241.80, custo_diario: 0.2682 },
  { retiro_id: "d", total_sacos: 151, total_cab_dias: 29808,
    custo_mensal: 12049.80, custo_diario: 0.4042 },
];
describe("manager cost cards keep canonical weighted mean", () => {
  it("matches October consumption costs without averaging per-retreat rates", () => {
    const result = aggregateGerenteCustos(rows);
    expect(result.sacosUtilizados).toBe(653);
    expect(result.custoMensal).toBeCloseTo(52109.40, 6);
    expect(result.custoDiario).toBeCloseTo(0.3266, 4);
  });
  it("respects selected retreat", () => {
    expect(aggregateGerenteCustos(rows, "b")).toEqual({
      sacosUtilizados: 217, custoMensal: 17316.60,
      custoDiario: 17316.60 / 53650,
    });
  });
  it("an actually empty month is zero, not a data error", () => {
    expect(aggregateGerenteCustos([])).toEqual({
      sacosUtilizados: 0, custoMensal: 0, custoDiario: 0,
    });
  });
});
