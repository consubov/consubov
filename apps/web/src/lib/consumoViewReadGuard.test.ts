import { describe, expect, it } from "vitest";
import { DataReadFailure } from "@/lib/dataReadGuard";
import { requireConsumoRows, type ConsumoRowInput } from "@/lib/consumoViewReadGuard";

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
