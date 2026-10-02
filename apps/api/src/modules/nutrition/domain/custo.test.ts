import { describe, expect, test } from "bun:test";
import { calcularCustoLote, naoNegativo } from "./custo";
import { resolverProdutoIdDoLote } from "./produto";

const produto = { peso_saco_kg: 25, preco_por_kg: 2.5 };

describe("naoNegativo", () => {
  test("ausente, não numérico, zero e negativo viram zero", () => {
    expect(naoNegativo(12)).toBe(12);
    expect(naoNegativo(0)).toBe(0);
    expect(naoNegativo(-5)).toBe(0);
    expect(naoNegativo(null)).toBe(0);
    expect(naoNegativo(undefined)).toBe(0);
    expect(naoNegativo(Number.NaN)).toBe(0);
    expect(naoNegativo(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("calcularCustoLote", () => {
  test("saco é a fonte primária de kg", () => {
    expect(
      calcularCustoLote(produto, {
        numSacos: 10,
        consumoGCabDia: 999,
        cabDias: 1000,
      }),
    ).toEqual({
      pesoSacoKg: 25,
      precoKg: 2.5,
      totalKgFromSacos: 250,
      totalKgFallback: 999,
      totalKgConsumido: 250,
      totalCusto: 625,
    });
  });

  test("sem saco informado o consumo por cabeça vira a fonte de kg", () => {
    // 250 g/cab/dia por 1000 animal-dias = 250 kg
    const resultado = calcularCustoLote(produto, {
      numSacos: 0,
      consumoGCabDia: 250,
      cabDias: 1000,
    });

    expect(resultado.totalKgFromSacos).toBe(0);
    expect(resultado.totalKgConsumido).toBe(250);
    expect(resultado.totalCusto).toBe(625);
  });

  test("sem animal-dia o caminho de reserva não produz kg", () => {
    expect(
      calcularCustoLote(produto, {
        numSacos: 0,
        consumoGCabDia: 250,
        cabDias: 0,
      }).totalKgConsumido,
    ).toBe(0);
  });

  test("produto sem preço zera o custo em vez de estimar", () => {
    const resultado = calcularCustoLote(
      { peso_saco_kg: 25, preco_por_kg: null },
      { numSacos: 10, consumoGCabDia: 250, cabDias: 1000 },
    );

    expect(resultado.totalKgConsumido).toBe(250);
    expect(resultado.totalCusto).toBe(0);
  });

  test("produto ausente zera peso, preço e custo", () => {
    const resultado = calcularCustoLote(null, {
      numSacos: 10,
      consumoGCabDia: 250,
      cabDias: 1000,
    });

    expect(resultado.pesoSacoKg).toBe(0);
    expect(resultado.precoKg).toBe(0);
    expect(resultado.totalKgConsumido).toBe(250);
    expect(resultado.totalCusto).toBe(0);
  });
});

describe("resolverProdutoIdDoLote", () => {
  test("o produto do pasto tem precedência sobre o do retiro", () => {
    expect(resolverProdutoIdDoLote("produto-pasto", "produto-retiro")).toBe(
      "produto-pasto",
    );
    expect(resolverProdutoIdDoLote(null, "produto-retiro")).toBe(
      "produto-retiro",
    );
    expect(resolverProdutoIdDoLote(undefined, undefined)).toBeNull();
  });
});
