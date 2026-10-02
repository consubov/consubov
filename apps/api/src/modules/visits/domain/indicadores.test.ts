import { describe, expect, test } from "bun:test";
import { CARGO_FUNCAO_PADRAO_ASSINANTE, proximaOrdemAssinante } from "./assinante";
import { COLUNA_OVERRIDE, resolverValorOverride } from "./cabecalho";
import {
  pesoMedioRebanho,
  resolverTabelaIndicadores,
  resolverValorIndicador,
} from "./indicadores";

describe("proximaOrdemAssinante", () => {
  test("sem assinantes começa em 1", () => {
    expect(proximaOrdemAssinante([])).toBe(1);
  });

  test("soma 1 à maior ordem existente", () => {
    expect(proximaOrdemAssinante([{ ordem: 0 }, { ordem: 2 }])).toBe(3);
  });

  test("cargo padrão é o do app", () => {
    expect(CARGO_FUNCAO_PADRAO_ASSINANTE).toBe("Consultor Técnico");
  });
});

describe("resolverValorOverride", () => {
  test("grava null quando o valor é vazio ou igual ao original", () => {
    expect(resolverValorOverride("", "Fazenda Boa Vista")).toBeNull();
    expect(resolverValorOverride("   ", "Fazenda Boa Vista")).toBeNull();
    expect(resolverValorOverride("Fazenda Boa Vista", "Fazenda Boa Vista")).toBeNull();
    expect(resolverValorOverride(" Fazenda Boa Vista ", "Fazenda Boa Vista")).toBeNull();
  });

  test("grava o valor quando difere do original", () => {
    expect(resolverValorOverride(" Fazenda Nova ", "Fazenda Boa Vista")).toBe(
      "Fazenda Nova",
    );
  });

  test("cada chave do cabeçalho tem sua coluna de override", () => {
    expect(COLUNA_OVERRIDE.consultor_nome).toBe("consultor_nome_override");
    expect(COLUNA_OVERRIDE.fazenda_nome).toBe("fazenda_nome_override");
    expect(COLUNA_OVERRIDE.localizacao).toBe("localizacao_override");
    expect(COLUNA_OVERRIDE.proprietario).toBe("proprietario_override");
    expect(COLUNA_OVERRIDE.responsavel).toBe("responsavel_override");
  });
});

describe("pesoMedioRebanho", () => {
  test("pondera somente pelos pastos com peso maior que zero", () => {
    expect(
      pesoMedioRebanho([
        { qtd_animais: 100, peso_medio_kg: 450 },
        { qtd_animais: 50, peso_medio_kg: null },
      ]),
    ).toBe(450);
  });

  test("arredonda para inteiro", () => {
    // 100×450 + 80×400 + 50×380 = 96.000 kg sobre 230 animais = 417,39 kg
    expect(
      pesoMedioRebanho([
        { qtd_animais: 100, peso_medio_kg: 450 },
        { qtd_animais: 80, peso_medio_kg: 400 },
        { qtd_animais: 50, peso_medio_kg: 380 },
      ]),
    ).toBe(417);
  });

  test("sem nenhum pasto com peso devolve 0", () => {
    expect(pesoMedioRebanho([{ qtd_animais: 10, peso_medio_kg: null }])).toBe(0);
  });
});

describe("resolverValorIndicador", () => {
  test("valor manual não vazio prevalece, mesmo com espaços", () => {
    expect(resolverValorIndicador("  3,50 ", "2,00")).toBe("3,50");
  });

  test("valor manual vazio usa o automático", () => {
    expect(resolverValorIndicador("", "2,00")).toBe("2,00");
    expect(resolverValorIndicador("   ", "2,00")).toBe("2,00");
    expect(resolverValorIndicador(null, "2,00")).toBe("2,00");
    expect(resolverValorIndicador(undefined, "2,00")).toBe("2,00");
  });

  test("a mescla por chave preserva a ordem das linhas do relatório", () => {
    const linhas = [
      { key: "lotes_avaliados" as const, label: "Lotes avaliados", value: "3" },
      { key: "peso_medio_rebanho" as const, label: "Peso médio", value: "" },
    ];

    expect(
      resolverTabelaIndicadores(linhas, {
        manual: { lotes_avaliados: "2" },
        automatico: { peso_medio_rebanho: "416 kg" } as never,
      }),
    ).toEqual([
      { key: "lotes_avaliados", label: "Lotes avaliados", value: "2" },
      { key: "peso_medio_rebanho", label: "Peso médio", value: "416 kg" },
    ]);
  });
});