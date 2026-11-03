import { describe, expect, it } from "vitest";
import { aggregatePainelMaeFallback, type MaeFallbackScope } from "./painelMaeFallback";

const scope: MaeFallbackScope = {
  fazendaId: "farm-a", retiroId: null, mes: 10, ano: 2026, retiroIds: ["r-a"],
};
const row = (overrides = {}) => ({
  fazenda_id: "farm-a", retiro_id: "r-a", pasto_id: "p1",
  mes_referencia: 10, ano_referencia: 2026,
  kg_fornecido: "50", cab_dias_global: "100",
  eficiencia_pasto: "70", status_global: "Ideal",
  peso_medio_kg: "320", ...overrides,
});
const real = (overrides = {}) => ({
  fazenda_id: "farm-a", retiro_id: "r-a", mes_referencia: 10, ano_referencia: 2026,
  kg_fornecido: "40", cab_dias_assumidos: "80", ...overrides,
});
const pasture = (overrides = {}) => ({
  id: "p1", retiro_id: "r-a", num_animais: 10, peso_medio_kg: "300", ...overrides,
});

describe("canonical views fallback for get_painel_mae", () => {
  it("reproduces SQL weighted metrics for the chosen month", () => {
    const metrics = aggregatePainelMaeFallback(
      scope,
      [row(), row({
        pasto_id: "p2", kg_fornecido: "25", cab_dias_global: "50",
        eficiencia_pasto: "90", status_global: "Alto", peso_medio_kg: null,
      })],
      [real(), real({ kg_fornecido: "20", cab_dias_assumidos: "40" })],
      [pasture(), pasture({ id: "p2", num_animais: 20, peso_medio_kg: "350" })],
    );
    expect(metrics).toEqual({
      consumo_real_g_cab_dia: 500,
      consumo_global_g_cab_dia: 500,
      eficiencia: 76.7,
      pastos_na_meta_num: 1,
      pastos_na_meta_den: 2,
      peso_medio_kg: 340,
    });
  });

  it("does not assign pasture weights to another period", () => {
    const metrics = aggregatePainelMaeFallback(scope, [], [], [pasture()]);
    expect(metrics).toEqual({
      consumo_real_g_cab_dia: 0,
      consumo_global_g_cab_dia: 0,
      eficiencia: 0,
      pastos_na_meta_num: 0,
      pastos_na_meta_den: 0,
      peso_medio_kg: 300,
    });
  });

  it("honors a restricted retreat and the attention class", () => {
    expect(aggregatePainelMaeFallback(
      { ...scope, retiroId: "r-a" },
      [row({ status_global: "Aten\u00e7\u00e3o" })],
      [real()],
      [pasture()],
    ).pastos_na_meta_num).toBe(1);
  });

  it("rejects another farm or month instead of exposing its metrics", () => {
    expect(() => aggregatePainelMaeFallback(scope, [row({ fazenda_id: "farm-b" })], [], []))
      .toThrow();
    expect(() => aggregatePainelMaeFallback(scope, [], [real({ mes_referencia: 9 })], []))
      .toThrow();
  });

  it("rejects a pasture outside confirmed retreat scope", () => {
    expect(() => aggregatePainelMaeFallback(scope, [], [], [pasture({ retiro_id: "r-b" })]))
      .toThrow();
  });

  it("rejects duplicate pasture rows and invalid numbers", () => {
    expect(() => aggregatePainelMaeFallback(scope, [row(), row()], [], []))
      .toThrow();
    expect(() => aggregatePainelMaeFallback(scope, [row({ kg_fornecido: "NaN" })], [], []))
      .toThrow();
  });
});
