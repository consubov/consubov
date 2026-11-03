import { describe, expect, it } from "vitest";
import { aggregatePainelMaeLight, type MaeLightInput } from "./painelMaeLight";

function fixture(): MaeLightInput {
  const prod = {
    id: "prod", peso_saco_kg: 25, amarelo_buffer_g: 3,
    consumo_recria1: 0.08, consumo_recria2: 0.07, consumo_engorda: 0.05,
    margem_mais_recria1_pct: 10, margem_mais_recria2_pct: 10, margem_mais_engorda_pct: 10,
    margem_menos_recria1_pct: 10, margem_menos_recria2_pct: 10, margem_menos_engorda_pct: 10,
  };
  return {
    scope: { fazendaId: "farm-a", retiroId: null, mes: 10, ano: 2026 },
    retiros: [{ id: "ret-a", fazenda_id: "farm-a", produto_id: "prod", peso_saco_kg: 25 }],
    pastos: [
      { id: "p1", retiro_id: "ret-a", ativo: true, num_animais: 10, peso_medio_kg: 300, sexo: "Fêmea", produto_id: null },
      { id: "p2", retiro_id: "ret-a", ativo: true, num_animais: 20, peso_medio_kg: 200, sexo: "Macho", produto_id: null },
    ],
    produtos: [prod],
    ocupacoes: [
      { id: "o1", retiro_id: "ret-a", pasto_id: "p1", produto_id: "prod" },
      { id: "o2", retiro_id: "ret-a", pasto_id: "p2", produto_id: "prod" },
    ],
    vctr: [
      { id: "a", fazenda_id: "farm-a", retiro_id: "ret-a", pasto_id: "p1",
        mes_referencia: 10, ano_referencia: 2026, num_animais: 10, num_sacos: 2,
        dias_no_pasto: 4, consumo_g_cab_dia: 155, indice_consumo: 0.9,
        peso_medio_kg: 300, created_at: "2026-10-20T10:00:00Z" },
      { id: "b", fazenda_id: "farm-a", retiro_id: "ret-a", pasto_id: "p2",
        mes_referencia: 10, ano_referencia: 2026, num_animais: 20, num_sacos: 1,
        dias_no_pasto: 2, consumo_g_cab_dia: 300, indice_consumo: 1.2,
        peso_medio_kg: 200, created_at: "2026-10-20T10:00:00Z" },
    ],
    reais: [
      { lancamento_id: "a", fazenda_id: "farm-a", retiro_id: "ret-a", pasto_id: "p1",
        mes_referencia: 10, ano_referencia: 2026, ocupacao_id: "o1",
        kg_fornecido: 50, cab_dias_assumidos: 40 },
      { lancamento_id: "b", fazenda_id: "farm-a", retiro_id: "ret-a", pasto_id: "p2",
        mes_referencia: 10, ano_referencia: 2026, ocupacao_id: "o2",
        kg_fornecido: 25, cab_dias_assumidos: 60 },
    ],
  };
}
describe("fast JWT-scoped canonical manager metrics", () => {
  it("matches the weighted real/global/efficiency, category and target formulas", () => {
    expect(aggregatePainelMaeLight(fixture())).toEqual({
      consumo_real_g_cab_dia: 750,
      consumo_global_g_cab_dia: 937.5,
      eficiencia: 85,
      pastos_na_meta_num: 1, pastos_na_meta_den: 2,
      peso_medio_kg: 233.3,
    });
  });
  it("does not borrow records from another month when selected month has none", () => {
    const i = fixture();
    i.vctr = []; i.reais = [];
    expect(aggregatePainelMaeLight(i)).toEqual({
      consumo_real_g_cab_dia: 0, consumo_global_g_cab_dia: 0,
      eficiencia: 0, pastos_na_meta_num: 0, pastos_na_meta_den: 0,
      peso_medio_kg: 233.3,
    });
  });
  it("rejects rows outside the confirmed farm or retreat scope", () => {
    const i = fixture();
    i.reais = [{ ...i.reais[0], fazenda_id: "farm-b" }];
    expect(() => aggregatePainelMaeLight(i)).toThrow();
    const j = fixture(); j.vctr = [{ ...j.vctr[0], retiro_id: "ret-b" }];
    expect(() => aggregatePainelMaeLight(j)).toThrow();
  });
  it("rejects inconsistent cross-farm occupancy and missing corroborating real rows", () => {
    const i = fixture(); i.ocupacoes = [{ ...i.ocupacoes[0], pasto_id: "p2" }];
    expect(() => aggregatePainelMaeLight(i)).toThrow();
    const j = fixture(); j.reais = [];
    expect(() => aggregatePainelMaeLight(j)).toThrow();
  });
  it("selects only the most recent launch per pasture for global/target", () => {
    const i = fixture();
    i.vctr = [...i.vctr, { ...i.vctr[0], id: "old", num_sacos: 20, created_at: "2026-10-01T10:00:00Z" }];
    i.reais = [...i.reais, { ...i.reais[0], lancamento_id: "old", kg_fornecido: 500 }];
    const result = aggregatePainelMaeLight(i);
    expect(result.pastos_na_meta_den).toBe(2);
    expect(result.consumo_global_g_cab_dia).toBe(937.5);
    expect(result.consumo_real_g_cab_dia).toBe(4107.14);
  });
  it("excludes inactive pasture from global/target but retains historic real consumption", () => {
    const i = fixture();
    i.pastos = [{ ...i.pastos[0], ativo: false }, i.pastos[1]];
    const actual = aggregatePainelMaeLight(i);
    expect(actual.pastos_na_meta_den).toBe(1);
    expect(actual.pastos_na_meta_num).toBe(0);
    expect(actual.consumo_global_g_cab_dia).toBe(625);
    expect(actual.consumo_real_g_cab_dia).toBe(750);
    expect(actual.peso_medio_kg).toBe(200);
  });
  it("fails closed for duplicate or invalid numeric source rows", () => {
    const i = fixture(); i.vctr = [i.vctr[0], i.vctr[0]];
    expect(() => aggregatePainelMaeLight(i)).toThrow();
    const j = fixture(); j.vctr = [{ ...j.vctr[0], num_animais: null }];
    expect(() => aggregatePainelMaeLight(j)).toThrow();
  });
});
