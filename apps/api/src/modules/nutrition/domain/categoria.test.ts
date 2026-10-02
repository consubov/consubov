import { describe, expect, test } from "bun:test";
import {
  calcularCategoriaViva,
  chaveCategoriaConsumo,
  classificarCategoria,
} from "./categoria";

describe("calcularCategoriaViva (dialeto com sexo: 220/299/360)", () => {
  test("fêmea troca para Recria 2 acima de 220 e engorda acima de 299", () => {
    expect(calcularCategoriaViva(220, "f")).toBe("Recria 1");
    expect(calcularCategoriaViva(220.01, "f")).toBe("Recria 2");
    expect(calcularCategoriaViva(299, "f")).toBe("Recria 2");
    expect(calcularCategoriaViva(299.01, "f")).toBe("Engorda");
  });

  test("macho engorda acima de 360", () => {
    expect(calcularCategoriaViva(220, "m")).toBe("Recria 1");
    expect(calcularCategoriaViva(360, "m")).toBe("Recria 2");
    expect(calcularCategoriaViva(360.01, "m")).toBe("Engorda");
  });

  test("reconheve fêmea por inicial, acento ou grafia sem acento", () => {
    expect(calcularCategoriaViva(280, "Fêmea")).toBe("Recria 2");
    expect(calcularCategoriaViva(280, "femea")).toBe("Recria 2");
    expect(calcularCategoriaViva(280, "FEMEA")).toBe("Recria 2");
  });

  test("sexo ausente ou vazio usa o corte de macho", () => {
    expect(calcularCategoriaViva(320, null)).toBe("Recria 2");
    expect(calcularCategoriaViva(320, "")).toBe("Recria 2");
    expect(calcularCategoriaViva(320)).toBe("Recria 2");
  });
});

describe("classificarCategoria (dialeto por peso: 250/350)", () => {
  test("usa os cortes 250 e 350", () => {
    expect(classificarCategoria(249.99)).toBe("Recria 1");
    expect(classificarCategoria(250)).toBe("Recria 2");
    expect(classificarCategoria(349.99)).toBe("Recria 2");
    expect(classificarCategoria(350)).toBe("Engorda");
  });

test("os dois dialetos divergem no mesmo peso e nenhum corrige o outro", () => {
    // 240kg: fêmea é Recria 2 no dialeto com sexo, Recria 1 no dialeto por peso
    expect(calcularCategoriaViva(240, "f")).toBe("Recria 2");
    expect(classificarCategoria(240)).toBe("Recria 1");

    // 355kg: macho ainda é Recria 2 no dialeto com sexo, já é Engorda no dialeto por peso
    expect(calcularCategoriaViva(355, "m")).toBe("Recria 2");
    expect(classificarCategoria(355)).toBe("Engorda");

    // 221kg: o dialeto com sexo já avançou, o por peso ainda não
    expect(calcularCategoriaViva(221, "m")).toBe("Recria 2");
    expect(classificarCategoria(221)).toBe("Recria 1");
  });
});

describe("chaveCategoriaConsumo", () => {
  test("aceita a categoria com e sem espaço", () => {
    expect(chaveCategoriaConsumo("Recria 1")).toBe("recria1");
    expect(chaveCategoriaConsumo("recria1")).toBe("recria1");
    expect(chaveCategoriaConsumo("Recria 2")).toBe("recria2");
    expect(chaveCategoriaConsumo("Recria2")).toBe("recria2");
  });

  test("texto desconhecido cai em engorda", () => {
    expect(chaveCategoriaConsumo("Engorda")).toBe("engorda");
    expect(chaveCategoriaConsumo("")).toBe("engorda");
    expect(chaveCategoriaConsumo("Terminação")).toBe("engorda");
  });
});
