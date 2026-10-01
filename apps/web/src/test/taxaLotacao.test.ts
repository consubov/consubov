import { describe, it, expect } from "vitest";
import { computeTaxaLotacao } from "@/pages/RevisaoVisitaPage";
describe("taxa lotacao", () => {
  it("3 pastos / 20 alq", () => {
    const p = [
      { qtd_animais: 100, peso_medio_kg: 450 },
      { qtd_animais: 80, peso_medio_kg: 400 },
      { qtd_animais: 50, peso_medio_kg: 380 },
    ];
    const ua = (100*450 + 80*400 + 50*380) / 450;
    const t = computeTaxaLotacao(p, 20)!;
    expect(t).toBeCloseTo(ua/20, 6);
    expect(t.toFixed(2)).toBe("10.67");
  });
  it("sem area -> null", () => expect(computeTaxaLotacao([{qtd_animais:10,peso_medio_kg:400}], null)).toBeNull());
  it("sem pesos -> null", () => expect(computeTaxaLotacao([{qtd_animais:10,peso_medio_kg:null}], 20)).toBeNull());
});

import { resolveAreaTotal, computeIndicadoresAuto } from "@/pages/RevisaoVisitaPage";
const base = { tipo_produto: null, samples: { fezes: [], corporal: [], bebedouro: [] } };
describe("precedência de área", () => {
  const pastos = [
    { ...base, qtd_animais: 100, peso_medio_kg: 450, area_alqueires: 12 },
    { ...base, qtd_animais: 80, peso_medio_kg: 400, area_alqueires: 8 },
    { ...base, qtd_animais: 50, peso_medio_kg: 380, area_alqueires: null },
  ];
  it("soma áreas por pasto quando campo geral vazio", () => {
    const r = resolveAreaTotal(pastos, null);
    expect(r.area).toBe(20);
    expect(r.origem).toBe("pastos");
    expect(r.nota).toContain("2 de 3 pastos");
    const ind = computeIndicadoresAuto(pastos, null);
    expect(ind.taxa_lotacao).toBe("10,67 UA/alqueire");
    expect(ind.taxa_lotacao_ha).toBe("2,20 UA/ha");
  });
  it("ignora manual quando há área por pasto", () => {
    expect(resolveAreaTotal(pastos, 100).area).toBe(20);
  });
  it("usa manual quando nenhum pasto tem área", () => {
    const semArea = pastos.map(p => ({ ...p, area_alqueires: null }));
    const r = resolveAreaTotal(semArea, 20);
    expect(r.origem).toBe("manual");
    expect(r.nota).toBe("Calculado com base na área total informada.");
    expect(computeIndicadoresAuto(semArea, 20).taxa_lotacao).toBe("10,67 UA/alqueire");
  });
  it("sem nenhuma área -> sem taxa", () => {
    const semArea = pastos.map(p => ({ ...p, area_alqueires: null }));
    expect(computeIndicadoresAuto(semArea, null).taxa_lotacao).toBe("—");
  });
});
