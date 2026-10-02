import { describe, expect, test } from "bun:test";
import { InventarioContratoError } from "./errors";
import {
  ANO_MAXIMO,
  ANO_MINIMO,
  JANELA_CONSUMO_DIAS,
  MES_MAXIMO,
  MES_MINIMO,
  criarBucketPeriodo,
  mesmoBucket,
} from "./periodo";

describe("bucket de período", () => {
  test("aceita os limites dos CHECKs de mes e ano", () => {
    expect(criarBucketPeriodo(MES_MINIMO, ANO_MINIMO)).toEqual({
      mes: 1,
      ano: 2020,
    });
    expect(criarBucketPeriodo(MES_MAXIMO, ANO_MAXIMO)).toEqual({
      mes: 12,
      ano: 2100,
    });
  });

  test("rejeita mes fora de 1..12", () => {
    expect(() => criarBucketPeriodo(0, 2026)).toThrow(InventarioContratoError);
    expect(() => criarBucketPeriodo(13, 2026)).toThrow(InventarioContratoError);
    expect(() => criarBucketPeriodo(6.5, 2026)).toThrow(InventarioContratoError);
  });

  test("rejeita ano fora de 2020..2100", () => {
    expect(() => criarBucketPeriodo(6, 2019)).toThrow(InventarioContratoError);
    expect(() => criarBucketPeriodo(6, 2101)).toThrow(InventarioContratoError);
  });

  test("identifica o erro pelo codigo de contrato", () => {
    try {
      criarBucketPeriodo(6, 1999);
      throw new Error("deveria ter falhado");
    } catch (erro) {
      expect(erro).toBeInstanceOf(InventarioContratoError);
      expect((erro as InventarioContratoError).codigo).toBe("ANO_INVALIDO");
    }
  });

  test("janela de consumo e 30 dias", () => {
    expect(JANELA_CONSUMO_DIAS).toBe(30);
  });

  test("compara buckets por mes e ano", () => {
    expect(mesmoBucket({ mes: 3, ano: 2026 }, { mes: 3, ano: 2026 })).toBe(true);
    expect(mesmoBucket({ mes: 3, ano: 2026 }, { mes: 4, ano: 2026 })).toBe(false);
    expect(mesmoBucket({ mes: 3, ano: 2026 }, { mes: 3, ano: 2027 })).toBe(false);
  });
});