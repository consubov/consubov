import { describe, expect, test } from "bun:test";
import {
  acumularEstoqueProdutoAcabado,
  aplicarBaixaDeEstoque,
  calcularKgProduzidos,
  hasEstoqueSuficiente,
  resolverPesoPorSaco,
} from "./estoque";
import type { MateriaPrimaRef } from "./materiaPrima";
import type { FabricaId, MateriaPrimaId } from "./identifiers";

const materia = (
  unidade: MateriaPrimaRef["unidade"],
  pesoPorSaco: number | null,
  estoqueAtual: number | null = null,
): MateriaPrimaRef => ({
  id: "mp-1" as MateriaPrimaId,
  fabricaId: "fab-1" as FabricaId,
  nome: "Milho moído",
  unidade,
  pesoPorSaco,
  estoqueAtual,
  estoqueMinimo: null,
  ativo: true,
});

describe("hasEstoqueSuficiente", () => {
  test("compara contra a quantidade convertida, não contra os kg", () => {
    // 120 kg exigem 3 sacos de 50 kg
    expect(hasEstoqueSuficiente(120, materia("saco", 50, 3))).toBe(true);
    expect(hasEstoqueSuficiente(120, materia("saco", 50, 2))).toBe(false);
  });

  test("em kg a comparação é direta e estoque ausente é zero", () => {
    expect(hasEstoqueSuficiente(100, materia("kg", null, 100))).toBe(true);
    expect(hasEstoqueSuficiente(100, materia("kg", null, 99))).toBe(false);
    expect(hasEstoqueSuficiente(100, materia("kg", null, null))).toBe(false);
    expect(hasEstoqueSuficiente(0, materia("kg", null, null))).toBe(true);
  });
});

describe("aplicarBaixaDeEstoque", () => {
  test("baixa a quantidade convertida do estoque", () => {
    // 120 kg exigem 3 sacos de 50 kg
    expect(aplicarBaixaDeEstoque(10, 120, materia("saco", 50))).toBe(7);
    // em kg a baixa é o próprio valor
    expect(aplicarBaixaDeEstoque(250, 100, materia("kg", null))).toBe(150);
  });

  test("baixa maior que o estoque tem piso zero, nunca negativo", () => {
    expect(aplicarBaixaDeEstoque(2, 120, materia("saco", 50))).toBe(0);
    expect(aplicarBaixaDeEstoque(10, 100, materia("kg", null))).toBe(0);
    expect(aplicarBaixaDeEstoque(0, 100, materia("kg", null))).toBe(0);
  });

  test("estoque ausente vale zero", () => {
    expect(aplicarBaixaDeEstoque(null, 100, materia("kg", null))).toBe(0);
  });
});

describe("resolverPesoPorSaco", () => {
  test("o peso do produto tem precedência sobre o da fórmula", () => {
    expect(resolverPesoPorSaco({ peso_saco_kg: 25 }, { pesoPorSaco: 20 })).toBe(25);
  });

  test("sem peso do produto usa o peso da fórmula", () => {
    expect(resolverPesoPorSaco(null, { pesoPorSaco: 20 })).toBe(20);
    expect(resolverPesoPorSaco({ peso_saco_kg: null }, { pesoPorSaco: 20 })).toBe(
      20,
    );
  });

  test("sem nenhuma referência o peso é zero e o kg produzido zera", () => {
    expect(resolverPesoPorSaco(null, { pesoPorSaco: 0 })).toBe(0);
    expect(calcularKgProduzidos(10, 0)).toBe(0);
  });

  test("converte sacos em kg", () => {
    expect(calcularKgProduzidos(10, 25)).toBe(250);
  });
});

describe("acumularEstoqueProdutoAcabado", () => {
  test("soma sobre o estoque existente", () => {
    expect(
      acumularEstoqueProdutoAcabado(
        { quantidadeSacos: 5, quantidadeKg: 125 },
        2,
        50,
      ),
    ).toEqual({ quantidadeSacos: 7, quantidadeKg: 175 });
  });

  test("sem estoque anterior o acúmulo é a própria batida", () => {
    expect(acumularEstoqueProdutoAcabado(null, 2, 50)).toEqual({
      quantidadeSacos: 2,
      quantidadeKg: 50,
    });
    expect(
      acumularEstoqueProdutoAcabado(undefined, 2, 50),
    ).toEqual({ quantidadeSacos: 2, quantidadeKg: 50 });
  });

  test("quantidade anterior nula vale zero", () => {
    expect(
      acumularEstoqueProdutoAcabado(
        { quantidadeSacos: null, quantidadeKg: null },
        2,
        50,
      ),
    ).toEqual({ quantidadeSacos: 2, quantidadeKg: 50 });
  });
});
