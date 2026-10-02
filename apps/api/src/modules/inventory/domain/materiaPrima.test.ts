import { describe, expect, test } from "bun:test";
import {
  creditarEntradaMateriaPrima,
  estoqueAbaixoDoMinimo,
} from "./materiaPrima";

describe("crédito de matéria-prima por entrada", () => {
  test("soma o estoque atual com a quantidade da entrada", () => {
    expect(creditarEntradaMateriaPrima(100, 20)).toBe(120);
  });

  test("trata nulo como zero em qualquer dos dois lados", () => {
    expect(creditarEntradaMateriaPrima(null, 20)).toBe(20);
    expect(creditarEntradaMateriaPrima(100, null)).toBe(100);
    expect(creditarEntradaMateriaPrima(null, null)).toBe(0);
  });

  test("nao tem piso zero: entrada negativa produz saldo negativo", () => {
    expect(creditarEntradaMateriaPrima(10, -25)).toBe(-15);
  });

  test("nao credita sozinho: o movimento continua sendo da tabela de entrada", () => {
    expect(creditarEntradaMateriaPrima(50, 0)).toBe(50);
  });
});

describe("sinalização de estoque abaixo do mínimo", () => {
  test("sinaliza quando o estoque está abaixo do mínimo", () => {
    expect(
      estoqueAbaixoDoMinimo({ estoqueAtual: 90, estoqueMinimo: 100 }),
    ).toBe(true);
  });

  test("nao sinaliza no minimo exato", () => {
    expect(
      estoqueAbaixoDoMinimo({ estoqueAtual: 100, estoqueMinimo: 100 }),
    ).toBe(false);
  });

  test("minimo zero ou nulo significa sem mínimo cadastrado", () => {
    expect(estoqueAbaixoDoMinimo({ estoqueAtual: 0, estoqueMinimo: 0 })).toBe(
      false,
    );
    expect(estoqueAbaixoDoMinimo({ estoqueAtual: 0, estoqueMinimo: null })).toBe(
      false,
    );
  });

  test("trata estoque nulo como zero na comparação", () => {
    expect(
      estoqueAbaixoDoMinimo({ estoqueAtual: null, estoqueMinimo: 10 }),
    ).toBe(true);
    expect(
      estoqueAbaixoDoMinimo({ estoqueAtual: 10, estoqueMinimo: 10 }),
    ).toBe(false);
  });

  test("é só sinalização: não devolve movimento nem altera saldo", () => {
    const resultado = estoqueAbaixoDoMinimo({
      estoqueAtual: 1,
      estoqueMinimo: 100,
    });

    expect(resultado).toBe(true);
  });
});