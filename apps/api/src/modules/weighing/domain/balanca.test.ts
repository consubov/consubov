import { describe, expect, test } from "bun:test";
import {
  QUANTIDADE_BALANCAO_MAXIMA,
  QUANTIDADE_BALANCAO_MINIMA,
  calcularLeituraBalancao,
  normalizarQuantidadeBalancao,
  parsePesoDigitado,
} from "./balanca";
import type { LeituraBalancaoId } from "./identity";

const leituraId = "leitura-1" as LeituraBalancaoId;

describe("parse do peso digitado", () => {
  test("aceita ponto decimal", () => {
    expect(parsePesoDigitado("320.5")).toBe(320.5);
  });

  test("aceita vírgula decimal", () => {
    expect(parsePesoDigitado("320,5")).toBe(320.5);
  });

  test("devolve null para texto não numérico", () => {
    expect(parsePesoDigitado("")).toBeNull();
    expect(parsePesoDigitado("abc")).toBeNull();
  });

  test("devolve null para peso não positivo ou não finito", () => {
    expect(parsePesoDigitado("0")).toBeNull();
    expect(parsePesoDigitado("-10")).toBeNull();
    expect(parsePesoDigitado("Infinity")).toBeNull();
  });
});

describe("quantidade da balançação", () => {
  test("mantém a faixa válida", () => {
    for (
      let quantidade = QUANTIDADE_BALANCAO_MINIMA;
      quantidade <= QUANTIDADE_BALANCAO_MAXIMA;
      quantidade++
    ) {
      expect(normalizarQuantidadeBalancao(quantidade)).toBe(quantidade);
    }
  });

  test("clampa 1 para 2", () => {
    expect(normalizarQuantidadeBalancao(1)).toBe(2);
  });

  test("clampa 7 para 2", () => {
    expect(normalizarQuantidadeBalancao(7)).toBe(2);
  });

  test("clampa zero, negativo e não numérico para 2", () => {
    expect(normalizarQuantidadeBalancao(0)).toBe(2);
    expect(normalizarQuantidadeBalancao(-3)).toBe(2);
    expect(normalizarQuantidadeBalancao(Number.NaN)).toBe(2);
  });
});

describe("leitura de balançação", () => {
  test("peso individual é o total dividido pela quantidade, em 2 casas", () => {
    const leitura = calcularLeituraBalancao({
      id: leituraId,
      ordem: 1,
      pesoTotalKg: 700,
      quantidadeAnimais: normalizarQuantidadeBalancao(3),
    });

    expect(leitura).toEqual({
      id: leituraId,
      tipoBalanca: "balancao",
      ordem: 1,
      pesoTotalKg: 700,
      quantidadeAnimais: 3,
      pesoIndividualKg: 233.33,
    });
  });

  test("devolve null para total não positivo", () => {
    expect(
      calcularLeituraBalancao({
        id: leituraId,
        ordem: 1,
        pesoTotalKg: 0,
        quantidadeAnimais: 2,
      }),
    ).toBeNull();

    expect(
      calcularLeituraBalancao({
        id: leituraId,
        ordem: 1,
        pesoTotalKg: -10,
        quantidadeAnimais: 2,
      }),
    ).toBeNull();
  });

  test("devolve null para total não finito", () => {
    expect(
      calcularLeituraBalancao({
        id: leituraId,
        ordem: 1,
        pesoTotalKg: Number.POSITIVE_INFINITY,
        quantidadeAnimais: 2,
      }),
    ).toBeNull();
  });

  test("devolve null com menos de dois animais", () => {
    expect(
      calcularLeituraBalancao({
        id: leituraId,
        ordem: 1,
        pesoTotalKg: 700,
        quantidadeAnimais: 1,
      }),
    ).toBeNull();
  });

  test("o clamp de quantidade acontece antes da leitura", () => {
    const leitura = calcularLeituraBalancao({
      id: leituraId,
      ordem: 1,
      pesoTotalKg: 1400,
      quantidadeAnimais: normalizarQuantidadeBalancao(7),
    });

    expect(leitura?.quantidadeAnimais).toBe(2);
    expect(leitura?.pesoIndividualKg).toBe(700);
  });
});