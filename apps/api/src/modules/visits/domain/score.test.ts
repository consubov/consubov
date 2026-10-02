import { describe, expect, test } from "bun:test";
import { mediaNotasScore, normalizarNotaScore, notaScoreValida } from "./score";

describe("notaScoreValida", () => {
  test("aceita apenas inteiros de 1 a 5", () => {
    expect(notaScoreValida(1)).toBe(true);
    expect(notaScoreValida(3)).toBe(true);
    expect(notaScoreValida(5)).toBe(true);
  });

  test("recusa 0, 6 e decimais", () => {
    expect(notaScoreValida(0)).toBe(false);
    expect(notaScoreValida(6)).toBe(false);
    expect(notaScoreValida(3.5)).toBe(false);
    expect(notaScoreValida(-1)).toBe(false);
    expect(notaScoreValida("3")).toBe(false);
    expect(notaScoreValida(Number.NaN)).toBe(false);
  });
});

describe("normalizarNotaScore", () => {
  test("devolve a nota quando válida", () => {
    expect(normalizarNotaScore(4)).toBe(4);
  });

  test("devolve null sem arredondar nem saturar", () => {
    expect(normalizarNotaScore(0)).toBeNull();
    expect(normalizarNotaScore(6)).toBeNull();
    expect(normalizarNotaScore(2.4)).toBeNull();
  });
});

describe("mediaNotasScore", () => {
  test("média aritmética simples de todas as amostras", () => {
    expect(mediaNotasScore([2, 3, 4])).toBe(3);
    expect(mediaNotasScore([1, 2])).toBeCloseTo(1.5, 10);
  });

  test("sem amostras não há média", () => {
    expect(mediaNotasScore([])).toBeNull();
  });
});