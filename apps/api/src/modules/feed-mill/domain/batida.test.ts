import { describe, expect, test } from "bun:test";
import { quantidadeUtilizadaPadraoKg } from "./batida";

describe("quantidadeUtilizadaPadraoKg", () => {
  test("returns the same amount when a valid number is provided", () => {
    expect(quantidadeUtilizadaPadraoKg({ quantidadeEsperadaKg: 100 })).toBe(100);
    expect(quantidadeUtilizadaPadraoKg({ quantidadeEsperadaKg: 0 })).toBe(0);
    expect(quantidadeUtilizadaPadraoKg({ quantidadeEsperadaKg: 50.5 })).toBe(50.5);
  });

  test("returns 0 when amount is null", () => {
    expect(quantidadeUtilizadaPadraoKg({ quantidadeEsperadaKg: null })).toBe(0);
  });

  test("returns 0 when amount is undefined", () => {
    expect(quantidadeUtilizadaPadraoKg({ quantidadeEsperadaKg: undefined })).toBe(0);
  });
});
