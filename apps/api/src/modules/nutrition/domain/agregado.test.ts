import { describe, expect, test } from "bun:test";
import {
  consumoMedioGCabDia,
  custoDiarioPorCabDia,
  mediaGmdValido,
} from "./agregado";

describe("consumoMedioGCabDia", () => {
  test("converte kg do período em g por animal-dia", () => {
    expect(consumoMedioGCabDia(900, 4500)).toBe(200);
  });

  test("sem animal-dia não há consumo médio", () => {
    expect(consumoMedioGCabDia(900, 0)).toBe(0);
  });
});

describe("custoDiarioPorCabDia", () => {
  test("divide o custo pelo animal-dia", () => {
    expect(custoDiarioPorCabDia(4500, 4500)).toBe(1);
  });

  test("sem animal-dia não há custo diário", () => {
    expect(custoDiarioPorCabDia(4500, 0)).toBe(0);
  });
});

describe("mediaGmdValido", () => {
  test("somente valores positivos entram na média", () => {
    expect(mediaGmdValido([0.9, 1.1, 0, null, undefined])).toBe(1);
  });

  test("sem nenhum valor positivo a média é zero", () => {
    expect(mediaGmdValido([0, null, undefined])).toBe(0);
    expect(mediaGmdValido([])).toBe(0);
  });
});
