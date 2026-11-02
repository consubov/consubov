import { describe, expect, test } from "bun:test";
import { proximaOrdemAssinante } from "./assinante";

describe("proximaOrdemAssinante", () => {
  test("quando o array é vazio, retorna 1", () => {
    expect(proximaOrdemAssinante([])).toBe(1);
  });

  test("quando há um item, retorna a ordem dele + 1", () => {
    expect(proximaOrdemAssinante([{ ordem: 1 }])).toBe(2);
    expect(proximaOrdemAssinante([{ ordem: 5 }])).toBe(6);
  });

  test("quando há múltiplos itens, retorna a maior ordem + 1", () => {
    expect(
      proximaOrdemAssinante([{ ordem: 1 }, { ordem: 2 }, { ordem: 3 }]),
    ).toBe(4);
  });

  test("quando os itens não estão ordenados, retorna a maior ordem + 1", () => {
    expect(
      proximaOrdemAssinante([{ ordem: 3 }, { ordem: 1 }, { ordem: 5 }, { ordem: 2 }]),
    ).toBe(6);
  });

  test("quando há ordens máximas duplicadas, retorna a máxima + 1", () => {
    expect(
      proximaOrdemAssinante([{ ordem: 4 }, { ordem: 4 }, { ordem: 2 }]),
    ).toBe(5);
  });
});
