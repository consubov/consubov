import { describe, expect, test } from "bun:test";
import {
  CATEGORIAS_PASTO,
  faltaCategoria,
  isCategoriaValida,
} from "./identity";

describe("categoria do pasto", () => {
  test("lista as quatro categorias aceitas", () => {
    expect([...CATEGORIAS_PASTO]).toEqual([
      "Engorda",
      "Recria 1",
      "Recria 2",
      "Cria",
    ]);
  });

  test("aceita somente as categorias da lista", () => {
    for (const categoria of CATEGORIAS_PASTO) {
      expect(isCategoriaValida(categoria)).toBe(true);
    }
    expect(isCategoriaValida("recria 1")).toBe(false);
    expect(isCategoriaValida("Vaca")).toBe(false);
  });

  test("rejeita vazio, nulo e indefinido", () => {
    expect(isCategoriaValida(null)).toBe(false);
    expect(isCategoriaValida(undefined)).toBe(false);
    expect(isCategoriaValida("")).toBe(false);
  });
});

describe("faltaCategoria", () => {
  test("exige categoria quando o pasto fica com animais", () => {
    expect(faltaCategoria(10, null)).toBe(true);
    expect(faltaCategoria(10, "Vaca")).toBe(true);
  });

  test("aceita pasto com animais quando a categoria é válida", () => {
    expect(faltaCategoria(10, "Recria 1")).toBe(false);
    expect(faltaCategoria(10, "Cria")).toBe(false);
  });

  test("não exige categoria quando o pasto termina sem animais", () => {
    expect(faltaCategoria(0, null)).toBe(false);
    expect(faltaCategoria(0, "Vaca")).toBe(false);
    expect(faltaCategoria(-3, null)).toBe(false);
  });
});
