import { describe, expect, test } from "bun:test";
import { calcularMediaCalculada, calcularPesoMedioAplicado } from "./medias";

describe("média calculada", () => {
  test("média dos pesados com 1 casa", () => {
    expect(calcularMediaCalculada([300, 200])).toBe(250);
    expect(calcularMediaCalculada([300.44, 200.46])).toBe(250.5);
  });

  test("devolve null sem pesos", () => {
    expect(calcularMediaCalculada([])).toBeNull();
  });
});

describe("peso médio aplicado", () => {
  test("sem pesos, o pasto continua com a média anterior", () => {
    expect(
      calcularPesoMedioAplicado({
        pesos: [],
        quantidadeAnimais: 10,
        pesoMedioAtual: 210.5,
      }),
    ).toBe(210.5);

    expect(
      calcularPesoMedioAplicado({
        pesos: [],
        quantidadeAnimais: 10,
        pesoMedioAtual: null,
      }),
    ).toBeNull();
  });

  test("com todos os animais pesados, aplica a média dos pesados", () => {
    expect(
      calcularPesoMedioAplicado({
        pesos: [300, 200, 250],
        quantidadeAnimais: 3,
        pesoMedioAtual: 180,
      }),
    ).toBe(250);
  });

  test("com mais pesados que animais, aplica a média dos pesados", () => {
    expect(
      calcularPesoMedioAplicado({
        pesos: [300, 200],
        quantidadeAnimais: 1,
        pesoMedioAtual: 180,
      }),
    ).toBe(250);
  });

  test("sem média anterior válida, aplica a média dos pesados", () => {
    expect(
      calcularPesoMedioAplicado({
        pesos: [300, 200],
        quantidadeAnimais: 10,
        pesoMedioAtual: null,
      }),
    ).toBe(250);

    expect(
      calcularPesoMedioAplicado({
        pesos: [300, 200],
        quantidadeAnimais: 10,
        pesoMedioAtual: 0,
      }),
    ).toBe(250);
  });

  test("com parte dos animais pesados, pondera a média anterior dos não pesados", () => {
    const pesos = [300, 200];
    const quantidadeAnimais = 4;
    const pesoMedioAtual = 200;

    const mediaPesados = 250;
    const naoPesados = quantidadeAnimais - pesos.length;
    const esperado = Math.round(
      ((pesoMedioAtual * naoPesados + mediaPesados * pesos.length) /
        quantidadeAnimais) *
        10,
    ) / 10;

    expect(
      calcularPesoMedioAplicado({
        pesos,
        quantidadeAnimais,
        pesoMedioAtual,
      }),
    ).toBe(esperado);
    expect(esperado).toBe(225);
  });

  test("média aplicada e média calculada são campos diferentes", () => {
    const pesos = [300, 200];

    expect(calcularMediaCalculada(pesos)).toBe(250);
    expect(
      calcularPesoMedioAplicado({
        pesos,
        quantidadeAnimais: 4,
        pesoMedioAtual: 200,
      }),
    ).toBe(225);
  });

  test("aplica 1 casa decimal", () => {
    expect(
      calcularPesoMedioAplicado({
        pesos: [300],
        quantidadeAnimais: 3,
        pesoMedioAtual: 200.04,
      }),
    ).toBe(233.4);
  });
});