import { describe, expect, it } from "vitest";
import { DataReadFailure } from "@/lib/dataReadGuard";
import { canRecoverConsolidatedSnapshot, requireConsumoRows, type ConsumoRowInput } from "@/lib/consumoViewReadGuard";

const fazenda = "fazenda-A";
const retiro = "retiro-A";
const row: ConsumoRowInput = {
  id: "lancamento-1",
  fazenda_id: fazenda,
  retiro_id: retiro,
  pasto_id: "pasto-A",
  num_sacos: 3,
  num_animais: 25,
  dias_no_pasto: 12,
  mes_referencia: 10,
  ano_referencia: 2026,
};

describe("requireConsumoRows", () => {
  it("preserva integralmente registros válidos e sua ordem", () => {
    const entries = [row, { ...row, id: "lancamento-2", num_sacos: 0 }];
    const result = requireConsumoRows(entries, fazenda, [retiro]);
    expect(result).toEqual(entries);
    expect(result[0]).toBe(entries[0]);
    expect(result[1].num_sacos).toBe(0);
  });

  it("preserva lista vazia autorizada", () => {
    expect(requireConsumoRows([], fazenda, [retiro])).toEqual([]);
  });

  it("rejeita lançamento de outra fazenda sem misturar dados", () => {
    expect(() => requireConsumoRows([{ ...row, fazenda_id: "fazenda-B" }], fazenda, [retiro]))
      .toThrow(DataReadFailure);
  });

  it("rejeita retiro não autorizado mesmo na mesma fazenda", () => {
    expect(() => requireConsumoRows([{ ...row, retiro_id: "retiro-B" }], fazenda, [retiro]))
      .toThrow(DataReadFailure);
  });

  it("rejeita identidade ausente sem perder linhas silenciosamente", () => {
    expect(() => requireConsumoRows([{ ...row, id: null }], fazenda, [retiro]))
      .toThrow(DataReadFailure);
  });

  it("rejeita quantidade ou período nulos sem fabricar zeros", () => {
    expect(() => requireConsumoRows([{ ...row, num_animais: null }], fazenda, [retiro]))
      .toThrow(DataReadFailure);
    expect(() => requireConsumoRows([{ ...row, dias_no_pasto: null }], fazenda, [retiro]))
      .toThrow(DataReadFailure);
  });

  it("não altera filtros: aceita apenas retiros explicitamente autorizados", () => {
    expect(() => requireConsumoRows([row], fazenda, [])).toThrow(DataReadFailure);
  });
});

describe("consolidated snapshot failover", () => {
  it("does not fall back after an authorized empty view", () => {
    expect(canRecoverConsolidatedSnapshot({ error: null, status: 200 })).toBe(false);
  });
  it("retries only after transport/statement timeout", () => {
    expect(canRecoverConsolidatedSnapshot({ error: { code: "57014" }, status: 500 })).toBe(true);
    expect(canRecoverConsolidatedSnapshot({ error: { code: "PGRST003" }, status: 504 })).toBe(true);
  });
  it("never bypasses an authentication or RLS denial", () => {
    for (const value of [
      { error: { code: "42501" }, status: 400 },
      { error: { code: "PGRST116" }, status: 403 },
      { error: { code: "unauthorized" }, status: 401 },
    ]) expect(() => canRecoverConsolidatedSnapshot(value)).toThrow(DataReadFailure);
  });
});
