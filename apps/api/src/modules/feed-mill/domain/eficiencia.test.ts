import { describe, expect, test } from "bun:test";
import { calcularEficienciaBatidas } from "./eficiencia";
import type { BatidaParaEficiencia } from "./eficiencia";
import type { FormulaId } from "./identifiers";

const batida = (
  formulaId: string,
  quantidadeProduzida: number | null,
  status: BatidaParaEficiencia["status"] = "finalizada",
): BatidaParaEficiencia => ({
  formulaId: formulaId as FormulaId,
  quantidadeProduzida,
  status,
});

describe("calcularEficienciaBatidas", () => {
  test("compara declarada contra a teórica das fórmulas usadas", () => {
    const resultado = calcularEficienciaBatidas(
      [batida("f1", 100), batida("f1", 80)],
      new Map([
        ["f1", 100],
        ["f2", 50],
      ]),
    );

    expect(resultado).toEqual({
      numBatidas: 2,
      producaoDeclarada: 180,
      producaoTeorica: 200,
      diferenca: 20,
      eficienciaPct: 90,
    });
  });

  test("batida iniciada não conta", () => {
    const resultado = calcularEficienciaBatidas(
      [batida("f1", 100), batida("f1", 200, "iniciada")],
      new Map([["f1", 100]]),
    );

    expect(resultado.numBatidas).toBe(1);
    expect(resultado.producaoDeclarada).toBe(100);
    expect(resultado.producaoTeorica).toBe(100);
    expect(resultado.eficienciaPct).toBe(100);
  });

  test("fórmula fora do mapa não levanta a teórica", () => {
    const resultado = calcularEficienciaBatidas(
      [batida("f1", 100), batida("desconhecida", 50)],
      new Map([["f1", 100]]),
    );

    expect(resultado.numBatidas).toBe(2);
    expect(resultado.producaoDeclarada).toBe(150);
    expect(resultado.producaoTeorica).toBe(100);
    expect(resultado.eficienciaPct).toBe(150);
  });

  test("produção declarada ausente conta como zero", () => {
    const resultado = calcularEficienciaBatidas(
      [batida("f1", null)],
      new Map([["f1", 100]]),
    );

    expect(resultado.producaoDeclarada).toBe(0);
    expect(resultado.diferenca).toBe(100);
    expect(resultado.eficienciaPct).toBe(0);
  });

  test("sem produção esperada a eficiência é zero", () => {
    expect(calcularEficienciaBatidas([batida("f1", 100)], new Map())).toEqual({
      numBatidas: 1,
      producaoDeclarada: 100,
      producaoTeorica: 0,
      diferenca: -100,
      eficienciaPct: 0,
    });
  });

  test("sem batida a diferença é zero", () => {
    expect(
      calcularEficienciaBatidas([], new Map([["f1", 100]])).eficienciaPct,
    ).toBe(0);
  });
});
