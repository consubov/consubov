import { describe, expect, test } from "bun:test";
import { estaNaMeta, statusDistinguido } from "./agregados";

describe("statusDistinguido", () => {
  test("soma Atenção ao segmento Ideal", () => {
    const distribuicao = statusDistinguido([
      { status_consumo: "Baixo" },
      { status_consumo: "Ideal" },
      { status_consumo: "Atenção" },
      { status_consumo: "Alto" },
    ]);

    expect(distribuicao).toEqual({
      baixo: 1,
      ideal: 2,
      alto: 1,
      baixoPct: 25,
      idealPct: 50,
      altoPct: 25,
    });
  });

  test("lançamento sem status fica fora do total", () => {
    const distribuicao = statusDistinguido([
      { status_consumo: "Ideal" },
      { status_consumo: null },
    ]);

    expect(distribuicao.ideal).toBe(1);
    expect(distribuicao.idealPct).toBe(100);
  });

  test("sem nenhum lançamento com status os percentuais são zero", () => {
    expect(statusDistinguido([])).toEqual({
      baixo: 0,
      ideal: 0,
      alto: 0,
      baixoPct: 0,
      idealPct: 0,
      altoPct: 0,
    });

    expect(statusDistinguido([{ status_consumo: null }]).idealPct).toBe(0);
  });
});

describe("estaNaMeta", () => {
  test("Ideal e Atenção estão na meta", () => {
    expect(estaNaMeta("Ideal")).toBe(true);
    expect(estaNaMeta("Atenção")).toBe(true);
  });

  test("Baixo, Alto e ausência de status não estão na meta", () => {
    expect(estaNaMeta("Baixo")).toBe(false);
    expect(estaNaMeta("Alto")).toBe(false);
    expect(estaNaMeta(null)).toBe(false);
  });
});