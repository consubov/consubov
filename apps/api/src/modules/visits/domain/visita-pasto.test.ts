import { describe, expect, test } from "bun:test";
import { proximaLetraPasto, proximaOrdem } from "./visita-pasto";

describe("proximaLetraPasto", () => {
  test("devolve a primeira letra livre a partir de A", () => {
    expect(proximaLetraPasto([])).toBe("A");
    expect(proximaLetraPasto([{ letra: "A" }])).toBe("B");
    expect(proximaLetraPasto([{ letra: "A" }, { letra: "C" }])).toBe("B");
  });

  test("ignora a caixa das letras já usadas", () => {
    expect(proximaLetraPasto([{ letra: "a" }, { letra: "b" }])).toBe("C");
  });

  test("sem letra disponível devolve string vazia", () => {
    const usados = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letra) => ({ letra }));

    expect(proximaLetraPasto(usados)).toBe("");
  });
});

describe("proximaOrdem", () => {
  test("sem pastos começa em 0", () => {
    expect(proximaOrdem([])).toBe(0);
  });

  test("soma 1 à maior ordem existente", () => {
    expect(proximaOrdem([{ ordem: 0 }])).toBe(1);
    expect(proximaOrdem([{ ordem: 0 }, { ordem: 3 }, { ordem: 1 }])).toBe(4);
  });
});