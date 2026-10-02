import { describe, expect, test } from "bun:test";
import { classificarConsumo4, getPctPorCategoria } from "./classificacao";

const produto = {
  margem_mais_recria1_pct: 15,
  margem_menos_recria1_pct: 5,
  margem_mais_recria2_pct: 10,
  margem_menos_recria2_pct: 10,
  margem_mais_engorda_pct: null,
  margem_menos_engorda_pct: 20,
  amarelo_buffer_g: 50,
};

describe("getPctPorCategoria", () => {
  test("lê o par de percentuais da categoria", () => {
    expect(getPctPorCategoria("Recria 1", produto)).toEqual({
      mais: 15,
      menos: 5,
    });
    expect(getPctPorCategoria("Recria 2", produto)).toEqual({
      mais: 10,
      menos: 10,
    });
    expect(getPctPorCategoria("Engorda", produto)).toEqual({
      mais: null,
      menos: 20,
    });
  });

  test("zero é percentual válido e não vira nulo", () => {
    expect(
      getPctPorCategoria("Recria 1", {
        margem_mais_recria1_pct: 0,
        margem_menos_recria1_pct: 0,
      }),
    ).toEqual({ mais: 0, menos: 0 });
  });
});

describe("classificarConsumo4", () => {
  test("esperado não positivo é erro, inclusive quando o consumo é zero", () => {
    expect(classificarConsumo4(500, 0, 10, 10, 50)).toBe("ERRO");
    expect(classificarConsumo4(500, -1, 10, 10, 50)).toBe("ERRO");
    expect(classificarConsumo4(0, 0, 10, 10, 50)).toBe("ERRO");
  });

  test("classifica as faixas em torno do esperado com buffer nas bordas", () => {
    // esperado 1000, margens 10/10 => faixa útil 900..1100, buffer 50
    expect(classificarConsumo4(800, 1000, 10, 10, 50)).toBe("Baixo");
    expect(classificarConsumo4(920, 1000, 10, 10, 50)).toBe("Atenção");
    expect(classificarConsumo4(950, 1000, 10, 10, 50)).toBe("Ideal");
    expect(classificarConsumo4(1080, 1000, 10, 10, 50)).toBe("Atenção");
    expect(classificarConsumo4(1050, 1000, 10, 10, 50)).toBe("Ideal");
    expect(classificarConsumo4(1100, 1000, 10, 10, 50)).toBe("Atenção");
    expect(classificarConsumo4(1100.01, 1000, 10, 10, 50)).toBe("Alto");
  });

  test("buffer negativo é tratado como zero", () => {
    // sem buffer, 900 já é o limite inferior exato e entra em Ideal
    expect(classificarConsumo4(899, 1000, 10, 10, -5)).toBe("Baixo");
    expect(classificarConsumo4(900, 1000, 10, 10, -5)).toBe("Ideal");
  });

  test("margens assimétricas estrem a faixa só pelo lado informado", () => {
    // esperado 1000, acima 20%, abaixo 5% => faixa útil 950..1200
    expect(classificarConsumo4(949, 1000, 20, 5, 0)).toBe("Baixo");
    expect(classificarConsumo4(950, 1000, 20, 5, 0)).toBe("Ideal");
    expect(classificarConsumo4(1200, 1000, 20, 5, 0)).toBe("Ideal");
    expect(classificarConsumo4(1201, 1000, 20, 5, 0)).toBe("Alto");
  });

  test("consumo exatamente no limite inferior com buffer é atenção", () => {
    expect(classificarConsumo4(900, 1000, 10, 10, 50)).toBe("Atenção");
  });
});
