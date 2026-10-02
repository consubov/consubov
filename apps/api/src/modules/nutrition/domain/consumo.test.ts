import { describe, expect, test } from "bun:test";
import {
  calcConsumoAnimalDia,
  calcConsumoEsperadoGCabDia,
  calcConsumoGCabDia,
  calcIndiceConsumo,
  calcularConsumo,
  consumoStatusUnificado,
  getConsumoPorCategoria,
  getMargemPorCategoria,
  type ConsumoInput,
} from "./consumo";

const produtoMigrado = {
  consumo_recria1: 0.02,
  consumo_recria2: 0.03,
  consumo_engorda: 0.05,
  margem_mais_recria2_pct: 10,
  margem_menos_recria2_pct: 10,
  amarelo_buffer_g: 0,
};

const base: ConsumoInput = {
  num_sacos: 10,
  peso_saco_kg: 25,
  num_animais: 100,
  dias: 10,
  peso_medio_kg: 300,
  consumo_por_100kg_categoria: 0.03,
  margem: 0,
  sexo: null,
};

describe("calcularConsumo", () => {
  test("sem animais, dias ou peso de saco não há consumo calculável", () => {
    expect(calcularConsumo({ ...base, num_animais: 0 })).toBeNull();
    expect(calcularConsumo({ ...base, dias: 0 })).toBeNull();
    expect(calcularConsumo({ ...base, peso_saco_kg: 0 })).toBeNull();
  });

  test("produto sem margens percentuais cai no caminho legado por índice", () => {
    // 250 kg consumidos contra 90 kg esperados => índice 2,78
    expect(calcularConsumo({ ...base, produto: null })).toEqual({
      consumo_real_g_cab_dia: 250,
      consumo_esperado_g_cab_dia: 90,
      consumo_real_kg: 250,
      consumo_esperado_kg: 90,
      indice_consumo: 2.78,
      status_consumo: "ACIMA",
    });
  });

  test("consumo esperado não positivo zera os derivados e marca erro", () => {
    expect(
      calcularConsumo({ ...base, consumo_por_100kg_categoria: 0, produto: null }),
    ).toEqual({
      consumo_real_g_cab_dia: 250,
      consumo_esperado_g_cab_dia: 0,
      consumo_real_kg: 250,
      consumo_esperado_kg: 0,
      indice_consumo: 0,
      status_consumo: "ERRO",
    });
  });

  test("margem legada positiva classifica em três estados", () => {
    // margem legada 0,01 por 100kg com 300kg => 30 g/cab/dia
    const comMargem = { ...base, consumo_por_100kg_categoria: 0.03, margem: 0.01 };

    expect(calcularConsumo({ ...comMargem, produto: null })?.status_consumo).toBe(
      "ACIMA",
    );

    const noAlvo = {
      ...comMargem,
      num_sacos: 4,
      consumo_por_100kg_categoria: 0.03,
    };
    // 100 kg consumidos contra 90 esperados => 100 g/cab/dia, dentro de 30
    expect(calcularConsumo({ ...noAlvo, produto: null })?.status_consumo).toBe(
      "IDEAL",
    );

    const abaixo = { ...noAlvo, num_sacos: 1 };
    // 25 kg consumidos contra 90 esperados => 25 g/cab/dia, abaixo de 60
    expect(calcularConsumo({ ...abaixo, produto: null })?.status_consumo).toBe(
      "ABAIXO",
    );
  });

  test("produto migrado usa a categoria viva e a classificação de quatro estados", () => {
    const resultado = calcularConsumo({
      ...base,
      produto: produtoMigrado,
    });

    // categoria viva de 300kg sem sexo é Recria 2, consumo 0,03 por 100kg
    expect(resultado?.consumo_esperado_g_cab_dia).toBe(90);
    expect(resultado?.status_consumo).toBe("Alto");
  });

  test("a categoria viva do lote tem precedência sobre a coluna genérica", () => {
    // 240kg com fêmea é Recria 2 no dialeto com sexo
    const resultado = calcularConsumo({
      ...base,
      peso_medio_kg: 240,
      sexo: "f",
      produto: produtoMigrado,
      consumo_por_100kg_categoria: 0.05,
    });

    // (0,03 × 240 / 100) × 1000 = 72 g/cab/dia esperados
    expect(resultado?.consumo_esperado_g_cab_dia).toBe(72);
  });

  test("coluna de consumo vazia cede lugar ao valor já informado na entrada", () => {
    const resultado = calcularConsumo({
      ...base,
      produto: { margem_mais_engorda_pct: 10, margem_menos_engorda_pct: 10 },
      consumo_por_100kg_categoria: 0.03,
    });

    expect(resultado?.consumo_esperado_g_cab_dia).toBe(90);
  });

  test("percentual preenchido com zero ainda habilita os quatro estados", () => {
    const resultado = calcularConsumo({
      ...base,
      produto: {
        consumo_recria2: 0.03,
        margem_mais_recria2_pct: 0,
        margem_menos_recria2_pct: 0,
        amarelo_buffer_g: null,
      },
    });

    // faixa útil vira o próprio esperado, então 250 contra 90 é Alto
    expect(resultado?.status_consumo).toBe("Alto");
  });

  test("só um percentual preenchido mantém o caminho legado", () => {
    const resultado = calcularConsumo({
      ...base,
      produto: { consumo_recria2: 0.03, margem_mais_recria2_pct: 10 },
      margem: 0,
    });

    expect(resultado?.status_consumo).toBe("ACIMA");
  });
});

describe("getConsumoPorCategoria e getMargemPorCategoria", () => {
  const produto = {
    consumo_recria1: 0.02,
    consumo_recria2: 0.03,
    consumo_engorda: 0.05,
    margem_recria1: 0.01,
    margem_recria2: 0.02,
    margem_engorda: 0.03,
  };

  test("escolhe a coluna da categoria", () => {
    expect(getConsumoPorCategoria("Recria 1", produto)).toBe(0.02);
    expect(getConsumoPorCategoria("Recria 2", produto)).toBe(0.03);
    expect(getConsumoPorCategoria("Engorda", produto)).toBe(0.05);
    expect(getMargemPorCategoria("Recria 1", produto)).toBe(0.01);
    expect(getMargemPorCategoria("Recria 2", produto)).toBe(0.02);
    expect(getMargemPorCategoria("Engorda", produto)).toBe(0.03);
  });

  test("coluna ausente ou nula vira zero", () => {
    expect(
      getConsumoPorCategoria("Recria 1", {
        consumo_recria1: null,
        consumo_recria2: 0.03,
        consumo_engorda: 0.05,
      }),
    ).toBe(0);
    expect(getMargemPorCategoria("Recria 1", {})).toBe(0);
  });
});

describe("consumoStatusUnificado", () => {
  test("índice não positivo não é classificado", () => {
    expect(consumoStatusUnificado(0)).toBe("—");
    expect(consumoStatusUnificado(-1)).toBe("—");
  });

  test("0,8 e 1,2 pertencem ao ideal", () => {
    expect(consumoStatusUnificado(0.79)).toBe("Baixo");
    expect(consumoStatusUnificado(0.8)).toBe("Ideal");
    expect(consumoStatusUnificado(1.2)).toBe("Ideal");
    expect(consumoStatusUnificado(1.21)).toBe("Alto");
  });
});

describe("calcIndiceConsumo", () => {
  test("divide real por esperado", () => {
    expect(calcIndiceConsumo(100, 80)).toBe(1.25);
  });

  test("qualquer lado não positivo zera o índice", () => {
    expect(calcIndiceConsumo(100, 0)).toBe(0);
    expect(calcIndiceConsumo(0, 100)).toBe(0);
    expect(calcIndiceConsumo(-1, 100)).toBe(0);
  });
});

describe("calcConsumoEsperadoGCabDia", () => {
  test("converte kg por 100kg de peso vivo em g por cabeça por dia", () => {
    expect(calcConsumoEsperadoGCabDia(0.03, 300)).toBe(90);
  });

  test("recomendação ou peso não positivo zera", () => {
    expect(calcConsumoEsperadoGCabDia(0, 300)).toBe(0);
    expect(calcConsumoEsperadoGCabDia(0.03, 0)).toBe(0);
    expect(calcConsumoEsperadoGCabDia(0.03, -10)).toBe(0);
  });
});

describe("calcConsumoGCabDia", () => {
  test("calcula a partir de sacos, peso do saco, animais e dias", () => {
    expect(calcConsumoGCabDia(10, 25, 100, 10)).toBe(250);
  });

  test("qualquer entrada não positiva zera", () => {
    expect(calcConsumoGCabDia(0, 25, 100, 10)).toBe(0);
    expect(calcConsumoGCabDia(10, 0, 100, 10)).toBe(0);
    expect(calcConsumoGCabDia(10, 25, 0, 10)).toBe(0);
    expect(calcConsumoGCabDia(10, 25, 100, 0)).toBe(0);
  });
});

describe("calcConsumoAnimalDia", () => {
  test("pondera pelo animal-dia de cada período", () => {
    const periodos = [
      { numAnimais: 200, dias: 15 },
      { numAnimais: 100, dias: 15 },
    ];

    // 4500 animal-dias: 450 kg => 100 g/cab/dia
    expect(calcConsumoAnimalDia(periodos, 450)).toBe(100);
  });

  test("kg consumido ou animal-dia não positivos zeram", () => {
    expect(calcConsumoAnimalDia([{ numAnimais: 100, dias: 10 }], 0)).toBe(0);
    expect(calcConsumoAnimalDia([], 450)).toBe(0);
    expect(calcConsumoAnimalDia([{ numAnimais: 0, dias: 10 }], 450)).toBe(0);
  });
});
