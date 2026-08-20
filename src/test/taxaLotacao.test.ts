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
