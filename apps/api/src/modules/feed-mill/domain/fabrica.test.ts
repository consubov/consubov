import { describe, expect, test } from "bun:test";
import { qrIdentificaFabrica } from "./fabrica";
import { quantidadeUtilizadaPadraoKg } from "./batida";
import type { FabricaId } from "./identifiers";

const fabricaId = "fab-1" as FabricaId;

describe("qrIdentificaFabrica", () => {
  test("aceita o código cadastrado e o próprio identificador", () => {
    expect(qrIdentificaFabrica("FAB-01", "FAB-01", fabricaId)).toBe(true);
    expect(qrIdentificaFabrica("fab-1", "FAB-01", fabricaId)).toBe(true);
  });

  test("ignora espaços nas pontas do valor lido", () => {
    expect(qrIdentificaFabrica("  FAB-01  ", "FAB-01", fabricaId)).toBe(true);
    expect(qrIdentificaFabrica("FAB-01", "  FAB-01  ", fabricaId)).toBe(true);
  });

  test("sem código cadastrado o identificador é a única referência", () => {
    expect(qrIdentificaFabrica("fab-1", null, fabricaId)).toBe(true);
    expect(qrIdentificaFabrica("FAB-01", "", fabricaId)).toBe(false);
  });

  test("código de outra fábrica não identifica", () => {
    expect(qrIdentificaFabrica("FAB-02", "FAB-01", fabricaId)).toBe(false);
    expect(qrIdentificaFabrica("fab-2", "FAB-01", fabricaId)).toBe(false);
  });

  test("leitura vazia nunca identifica", () => {
    expect(qrIdentificaFabrica("", "FAB-01", fabricaId)).toBe(false);
    expect(qrIdentificaFabrica("   ", "FAB-01", fabricaId)).toBe(false);
    expect(qrIdentificaFabrica(null, "FAB-01", fabricaId)).toBe(false);
    expect(qrIdentificaFabrica(undefined, undefined, fabricaId)).toBe(false);
  });
});

describe("quantidadeUtilizadaPadraoKg", () => {
  test("a quantidade confirmada é a esperada, sem leitura do operador", () => {
    expect(quantidadeUtilizadaPadraoKg({ quantidadeEsperadaKg: 400 })).toBe(400);
    expect(quantidadeUtilizadaPadraoKg({ quantidadeEsperadaKg: 0 })).toBe(0);
  });

  test("quantidade esperada ausente vira zero", () => {
    expect(quantidadeUtilizadaPadraoKg({ quantidadeEsperadaKg: null })).toBe(0);
  });
});
