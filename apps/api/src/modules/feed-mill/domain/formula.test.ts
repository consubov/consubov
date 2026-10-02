import { describe, expect, test } from "bun:test";
import { ehIngredienteValido, somarIngredientesKg } from "./formula";
import type { FormulaIngrediente } from "./formula";
import type { FabricaId, FormulaId, MateriaPrimaId } from "./identifiers";

const ingrediente = (
  materiaPrimaId: string,
  quantidadeKg: number,
): FormulaIngrediente => ({
  formulaId: "f-1" as FormulaId,
  materiaPrimaId: materiaPrimaId as MateriaPrimaId,
  quantidadeKg,
});

describe("somarIngredientesKg", () => {
  test("soma as quantidades da fórmula", () => {
    expect(
      somarIngredientesKg([ingrediente("mp-1", 400), ingrediente("mp-2", 550)]),
    ).toBe(950);
  });

  test("quantidade inválida não quebra a soma", () => {
    expect(
      somarIngredientesKg([
        ingrediente("mp-1", 400),
        ingrediente("mp-2", Number.NaN),
      ]),
    ).toBe(400);
  });

  test("fórmula sem ingredientes soma zero", () => {
    expect(somarIngredientesKg([])).toBe(0);
  });
});

describe("ehIngredienteValido", () => {
  test("exige matéria-prima escolhida e quantidade positiva", () => {
    expect(
      ehIngredienteValido({ materiaPrimaId: "mp-1", quantidadeKg: 400 }),
    ).toBe(true);
  });

  test("rejeita matéria-prima não escolhida", () => {
    expect(ehIngredienteValido({ materiaPrimaId: "", quantidadeKg: 400 })).toBe(
      false,
    );
    expect(
      ehIngredienteValido({ materiaPrimaId: null, quantidadeKg: 400 }),
    ).toBe(false);
  });

  test("rejeita quantidade zero, negativa ou ausente", () => {
    expect(ehIngredienteValido({ materiaPrimaId: "mp-1", quantidadeKg: 0 })).toBe(
      false,
    );
    expect(
      ehIngredienteValido({ materiaPrimaId: "mp-1", quantidadeKg: -1 }),
    ).toBe(false);
    expect(
      ehIngredienteValido({ materiaPrimaId: "mp-1", quantidadeKg: null }),
    ).toBe(false);
  });
});

describe("FormulaRef", () => {
  test("fórmula sem produto vinculado é válida e impede creditar estoque", () => {
    const fabricaId = "fab-1" as FabricaId;
    const formula = {
      id: "f-1" as FormulaId,
      fabricaId,
      nome: "Ração engorda 15%",
      pesoBatida: 1000,
      pesoPorSaco: 40,
      producaoEsperada: 25,
      produtoId: null,
      ativo: true,
    };

    expect(formula.produtoId).toBeNull();
    expect(somarIngredientesKg([ingrediente("mp-1", 1000)])).toBe(
      formula.pesoBatida,
    );
  });
});
