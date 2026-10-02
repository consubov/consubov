import { describe, expect, test } from "bun:test";
import type { PastoId } from "./identity";
import { totalCabecasRetiro } from "./rebanho";

const p1 = "p1" as PastoId;
const p2 = "p2" as PastoId;

const PASTOS = [
  { id: p1, num_animais: 100 },
  { id: p2, num_animais: null },
];

const LANCAMENTOS = [
  { pasto_id: p1, num_animais: 80 },
  { pasto_id: p1, num_animais: 90 },
  { pasto_id: p1, num_animais: 60 },
  { pasto_id: p2, num_animais: 20 },
];

describe("total de cabeças do retiro", () => {
  test("ciclo aberto soma os pastos", () => {
    expect(
      totalCabecasRetiro({
        cicloFechado: false,
        pastos: PASTOS,
        lancamentos: LANCAMENTOS,
      }),
    ).toBe(100);
  });

  test("ciclo inexistente também usa os pastos", () => {
    expect(
      totalCabecasRetiro({
        cicloFechado: null,
        pastos: PASTOS,
        lancamentos: LANCAMENTOS,
      }),
    ).toBe(100);
  });

  test("ciclo fechado soma o máximo por pasto dos lançamentos", () => {
    expect(
      totalCabecasRetiro({
        cicloFechado: true,
        pastos: PASTOS,
        lancamentos: LANCAMENTOS,
      }),
    ).toBe(110);
  });

  test("ciclo fechado sem lançamentos devolve zero", () => {
    expect(
      totalCabecasRetiro({
        cicloFechado: true,
        pastos: PASTOS,
        lancamentos: [],
      }),
    ).toBe(0);
  });

  test("lançamento nulo entra como zero e não derruba o máximo", () => {
    expect(
      totalCabecasRetiro({
        cicloFechado: true,
        pastos: PASTOS,
        lancamentos: [
          { pasto_id: p1, num_animais: null },
          { pasto_id: p1, num_animais: 40 },
        ],
      }),
    ).toBe(40);
  });

  test("pastos sem animais não alteram o total", () => {
    expect(
      totalCabecasRetiro({ cicloFechado: false, pastos: [], lancamentos: [] }),
    ).toBe(0);
  });
});
