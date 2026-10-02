import { describe, expect, test } from "bun:test";
import {
  ALQUEIRES_POR_HECTARE,
  computarTaxaDeOcupacao,
  computarTaxaDeOcupacaoDoPasto,
  computarUnidadeAnimal,
} from "./lotacao";

describe("computarUnidadeAnimal", () => {
  test("UA = (qtd_animais × peso_medio_kg) / 450", () => {
    expect(computarUnidadeAnimal(100, 450)).toBe(100);
    expect(computarUnidadeAnimal(80, 400)).toBeCloseTo(71.111, 3);
  });

  test("devolve 0 quando quantidade ou peso não são positivos", () => {
    expect(computarUnidadeAnimal(0, 450)).toBe(0);
    expect(computarUnidadeAnimal(100, 0)).toBe(0);
    expect(computarUnidadeAnimal(null, null)).toBe(0);
    expect(computarUnidadeAnimal(100, null)).toBe(0);
  });
});

describe("computarTaxaDeOcupacao", () => {
  const pastos = [
    { qtd_animais: 100, peso_medio_kg: 450 },
    { qtd_animais: 80, peso_medio_kg: 400 },
    { qtd_animais: 50, peso_medio_kg: 380 },
  ];

  test("soma as UA dos pastos e divide pela área em alqueires", () => {
    const taxa = computarTaxaDeOcupacao(pastos, 20);

    expect(taxa).not.toBeNull();
    expect(taxa!.porAlqueire).toBeCloseTo(10.6666, 3);
    expect(taxa!.porAlqueire.toFixed(2)).toBe("10.67");
  });

  test("UA/ha usa o fator 4,84 e não 2,42", () => {
    const taxa = computarTaxaDeOcupacao(pastos, 20)!;

    expect(ALQUEIRES_POR_HECTARE).toBe(4.84);
    expect(taxa.porHectare).toBeCloseTo(taxa.porAlqueire / 4.84, 10);
    expect(taxa.porHectare.toFixed(2)).toBe("2.20");
  });

  test("sem área ou sem peso não há taxa", () => {
    expect(computarTaxaDeOcupacao(pastos, null)).toBeNull();
    expect(computarTaxaDeOcupacao(pastos, 0)).toBeNull();
    expect(
      computarTaxaDeOcupacao([{ qtd_animais: 10, peso_medio_kg: null }], 20),
    ).toBeNull();
  });
});

describe("computarTaxaDeOcupacaoDoPasto", () => {
  test("UA do pasto sobre a área em alqueires convertida para hectare", () => {
    const taxa = computarTaxaDeOcupacaoDoPasto(100, 450, 20)!;

    expect(taxa.porAlqueire).toBe(5);
    expect(taxa.porHectare).toBeCloseTo(5 / 4.84, 10);
  });

  test("sem área ou sem UA do pasto devolve null", () => {
    expect(computarTaxaDeOcupacaoDoPasto(100, 450, null)).toBeNull();
    expect(computarTaxaDeOcupacaoDoPasto(0, 450, 20)).toBeNull();
  });
});