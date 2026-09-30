import { describe, it, expect } from "vitest";
import { normalizarConsumoPasto } from "@/lib/consumoPasto";

describe("normalizarConsumoPasto", () => {
  it("mineral: 143 animais, 350kg, meta 25, 50kg em 4 dias", () => {
    const n = normalizarConsumoPasto({
      tipo_produto: "mineral", qtd_animais: 143, peso_medio_kg: 350,
      meta_g_100kg: 25, kg_consumidos: 50, dias_consumo: 4,
    });
    expect(n.espCab * 1000).toBeCloseTo(87.5, 1);
    expect(n.realCab * 1000).toBeCloseTo(87.4, 1);
    expect(n.indice).toBeCloseTo(99.9, 1);
  });

  it("ração: 100 animais, 350kg, 700kg em 2 dias", () => {
    const n = normalizarConsumoPasto({
      tipo_produto: "racao", qtd_animais: 100, peso_medio_kg: 350,
      kg_consumidos: 700, dias_consumo: 2,
    });
    expect(n.realCab).toBeCloseTo(3.5, 3);
    expect((n.realCab / 350) * 100).toBeCloseTo(1.0, 3);
    expect(n.realTotal).toBeCloseTo(350, 3);
  });

  it("outro: 120 animais, 400kg, 96kg em 2 dias", () => {
    const n = normalizarConsumoPasto({
      tipo_produto: "outro", qtd_animais: 120, peso_medio_kg: 400,
      kg_consumidos: 96, dias_consumo: 2,
    });
    expect(n.realCab).toBeCloseTo(0.4, 3);
    expect(n.realCab * 1000).toBeCloseTo(400, 1);
  });

  it("proteinado 0,5% pasto 15A: esperado é total do lote", () => {
    const n = normalizarConsumoPasto({
      tipo_produto: "proteinado_05", percentual_pv: "0,5%",
      qtd_animais: 37, peso_medio_kg: 580,
      consumo_esperado_kg: 0.9, consumo_real_kg: 120,
    });
    expect(n.pesoVivoTotal).toBe(21460);
    expect(n.espTotal).toBeCloseTo(107.3, 1);
    expect(n.indice).toBeGreaterThan(80);
    expect(n.indice).toBeLessThan(130);
    expect(n.realCab).toBeCloseTo(3.243, 2);
  });
});
