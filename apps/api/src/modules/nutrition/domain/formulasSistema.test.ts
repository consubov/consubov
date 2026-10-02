import { describe, expect, test } from "bun:test";
import {
  FORMULAS_FALLBACK,
  classificarPorLimites,
  computeEficienciaPadrao,
} from "./formulasSistema";

describe("computeEficienciaPadrao", () => {
  test("100 no índice alvo e decai linearmente com a distância", () => {
    expect(computeEficienciaPadrao(1)).toBe(100);
    expect(computeEficienciaPadrao(0.5)).toBe(50);
    expect(computeEficienciaPadrao(1.5)).toBe(50);
    expect(computeEficienciaPadrao(0.9)).toBe(90);
  });

  test("a escala é limitada entre 0 e 100", () => {
    expect(computeEficienciaPadrao(0)).toBe(0);
    expect(computeEficienciaPadrao(2)).toBe(0);
    expect(computeEficienciaPadrao(1.2)).toBe(80);
    expect(computeEficienciaPadrao(3)).toBe(0);
  });
});

describe("classificarPorLimites", () => {
  test("as bordas pertencem ao ideal", () => {
    expect(classificarPorLimites(0.89, 0.9, 1.1)).toBe("Baixo");
    expect(classificarPorLimites(0.9, 0.9, 1.1)).toBe("Ideal");
    expect(classificarPorLimites(1.1, 0.9, 1.1)).toBe("Ideal");
    expect(classificarPorLimites(1.11, 0.9, 1.1)).toBe("Alto");
  });
});

describe("FORMULAS_FALLBACK", () => {
  test("é o contrato de origem fallback", () => {
    expect(FORMULAS_FALLBACK.eficiencia.source).toBe("fallback");
    expect(FORMULAS_FALLBACK.classificacao.source).toBe("fallback");
  });

  test("mantém os limites 0,9 e 1,1 da classificação", () => {
    expect(FORMULAS_FALLBACK.classificacao.limiteBaixo).toBe(0.9);
    expect(FORMULAS_FALLBACK.classificacao.limiteAlto).toBe(1.1);
    expect(FORMULAS_FALLBACK.classificacao.classify(0.9)).toBe("Ideal");
    expect(FORMULAS_FALLBACK.classificacao.classify(1.2)).toBe("Alto");
  });

  test("a eficiência do fallback é o padrão limitado", () => {
    expect(FORMULAS_FALLBACK.eficiencia.compute(1)).toBe(100);
    expect(FORMULAS_FALLBACK.eficiencia.compute(0)).toBe(0);
  });
});
