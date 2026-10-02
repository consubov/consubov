import { describe, expect, test } from "bun:test";
import type { PastoId } from "../../pastures";
import { decidirAbate, decidirMortalidade } from "./baixas";

const pasto = { pastoId: "p1" as PastoId, numAnimais: 100, pesoMedioKg: 400 };

describe("abate", () => {
  test("recusa quantidade não positiva", () => {
    for (const quantidade of [0, -5]) {
      expect(decidirAbate({ pasto, quantidade })).toEqual({
        ok: false,
        motivo: "QUANTIDADE_INVALIDA",
      });
    }
  });

  test("recusa quantidade acima do saldo do pasto", () => {
    expect(decidirAbate({ pasto, quantidade: 101 })).toEqual({
      ok: false,
      motivo: "QUANTIDADE_ACIMA_DO_SALDO",
    });
  });

  test("abatimento parcial sem peso informado preserva o peso médio", () => {
    expect(decidirAbate({ pasto, quantidade: 30 })).toEqual({
      ok: true,
      num_animais_restante: 70,
      peso_medio_kg: 400,
    });
  });

  test("abatimento parcial recalcula o peso médio com uma casa decimal", () => {
    // (100 × 400 − 30 × 500) / 70 = 357,142857…
    expect(decidirAbate({ pasto, quantidade: 30, pesoAbateKg: 500 })).toEqual({
      ok: true,
      num_animais_restante: 70,
      peso_medio_kg: 357.1,
    });
  });

  test("abate de todo o saldo deixa o pasto sem peso médio", () => {
    expect(decidirAbate({ pasto, quantidade: 100, pesoAbateKg: 480 })).toEqual({
      ok: true,
      num_animais_restante: 0,
      peso_medio_kg: null,
    });
  });

  test("pasto sem peso médio conhecido continua sem peso médio", () => {
    expect(
      decidirAbate({
        pasto: { ...pasto, pesoMedioKg: null },
        quantidade: 10,
        pesoAbateKg: 480,
      }),
    ).toEqual({
      ok: true,
      num_animais_restante: 90,
      peso_medio_kg: null,
    });
  });

  test("peso médio nunca fica negativo", () => {
    expect(decidirAbate({ pasto, quantidade: 10, pesoAbateKg: 9000 })).toEqual({
      ok: true,
      num_animais_restante: 90,
      peso_medio_kg: 0,
    });
  });
});

describe("mortalidade", () => {
  const base = {
    pastoId: "p1" as PastoId,
    numAnimaisNoPasto: 100,
    quantidade: 1,
    fotoAnimalUrl: "data:animal",
    fotoBrincoUrl: "data:brinco",
  };

  test("exige pasto, foto do animal e foto do brinco", () => {
    expect(decidirMortalidade({ ...base, pastoId: null })).toEqual({
      ok: false,
      motivo: "PASTO_NAO_INFORMADO",
    });
    expect(decidirMortalidade({ ...base, fotoAnimalUrl: null })).toEqual({
      ok: false,
      motivo: "FOTO_ANIMAL_OBRIGATORIA",
    });
    expect(decidirMortalidade({ ...base, fotoBrincoUrl: null })).toEqual({
      ok: false,
      motivo: "FOTO_BRINCO_OBRIGATORIA",
    });
  });

  test("recusa quantidade fora de 1..saldo", () => {
    for (const quantidade of [0, -1, 101]) {
      expect(decidirMortalidade({ ...base, quantidade })).toEqual({
        ok: false,
        motivo: "QUANTIDADE_INVALIDA",
      });
    }
  });

  test("desconta apenas o saldo, sem mexer no peso médio", () => {
    expect(decidirMortalidade({ ...base, quantidade: 4 })).toEqual({
      ok: true,
      num_animais_restante: 96,
    });
  });

  test("aceita retirar todo o saldo do pasto", () => {
    expect(decidirMortalidade({ ...base, quantidade: 100 })).toEqual({
      ok: true,
      num_animais_restante: 0,
    });
  });
});
