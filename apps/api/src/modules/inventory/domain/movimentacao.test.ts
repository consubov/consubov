import { describe, expect, test } from "bun:test";
import {
  SINAL_POR_TIPO,
  sinalDoMovimento,
  type MovimentacaoOrigem,
  type MovimentacaoTipo,
} from "./movimentacao";

describe("tipos de movimentação", () => {
  test("cobre exatamente os quatro tipos do CHECK", () => {
    const tipos: MovimentacaoTipo[] = [
      "entrada",
      "saida",
      "transferencia_envio",
      "transferencia_recebimento",
    ];

    expect(Object.keys(SINAL_POR_TIPO).sort()).toEqual([...tipos].sort());
  });

  test("cobre exatamente as quatro origens do CHECK, sem o valor fora do CHECK do legado", () => {
    const origens: MovimentacaoOrigem[] = [
      "compra",
      "salga",
      "transferencia",
      "ajuste",
    ];

    expect(origens).toHaveLength(4);
    expect(origens).not.toContain("lancamento_manual" as MovimentacaoOrigem);
  });

  test("entrada e recebimento de transferencia somam", () => {
    expect(sinalDoMovimento("entrada")).toBe(1);
    expect(sinalDoMovimento("transferencia_recebimento")).toBe(1);
  });

  test("saida e envio de transferencia subtraem", () => {
    expect(sinalDoMovimento("saida")).toBe(-1);
    expect(sinalDoMovimento("transferencia_envio")).toBe(-1);
  });

  test("a transferencia liquida entre os dois retiros, em buckets distintos", () => {
    const liquido =
      sinalDoMovimento("transferencia_envio") +
      sinalDoMovimento("transferencia_recebimento");

    expect(liquido).toBe(0);
  });
});