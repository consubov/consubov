import { describe, expect, it } from "vitest";
import { assertMutation, expectedGmd, parseGmd, validateLoadedGmd, verifyGmdReadback, type GmdRow } from "./gmdGuards";

const id = "farm-a";
const retreat = "retreat-a";
const summer = { ini: 2, fim: 8 };
const emptyCategories = { "Engorda": "", "Recria 1": "", "Recria 2": "", "Cria": "" };
const geral: GmdRow = {
  id: "row-1", fazenda_id: id, retiro_id: null, categoria: null,
  gmd_kg: null, gmd_verao_kg: 0.5, gmd_inverno_kg: 0.2,
};

describe("GMD: permissões observáveis e consistência do readback", () => {
  it("normaliza valores e rejeita números fora do intervalo", () => {
    expect(parseGmd("0,125")).toBe(0.125);
    expect(parseGmd("")).toBeNull();
    expect(parseGmd("3.1")).toBe("invalid");
    expect(parseGmd("Infinity")).toBe("invalid");
    expect(parseGmd(undefined as unknown as string)).toBe("invalid");
  });
  it("nunca confirma UPDATE de zero linhas", () => {
    expect(() => assertMutation({ data: [], error: null }, "update", 1, ["row-1"])).toThrow();
  });
  it("nunca confirma retorno sem linhas", () => {
    expect(() => assertMutation({ data: null, error: null }, "delete", 1, ["row-1"])).toThrow();
  });
  it("nunca confirma ID diferente do solicitado", () => {
    expect(() => assertMutation({ data: [{ id: "row-2" }], error: null }, "update", 1, ["row-1"])).toThrow();
  });
  it("nunca confirma IDs repetidos na exclusão em lote", () => {
    expect(() => assertMutation({ data: [{ id: "a" }, { id: "a" }], error: null }, "delete", 2, ["a", "b"])).toThrow();
  });
  it("rejeita erro explícito mesmo que haja dados", () => {
    expect(() => assertMutation({ data: [{ id: "a" }], error: { code: "42501" } }, "update", 1)).toThrow();
  });
  it("aceita registro exato confirmado pelo banco", () => {
    expect(() => assertMutation({ data: [{ id: "a" }], error: null }, "update", 1, ["a"])).not.toThrow();
  });
  it("falha com dados de outra fazenda", () => {
    expect(() => validateLoadedGmd([{ ...geral, fazenda_id: "farm-b" }], id, [] )).toThrow();
  });
  it("falha se uma categoria/regra geral está duplicada", () => {
    expect(() => validateLoadedGmd([geral, { ...geral, id: "row-2" }], id, [])).toThrow();
  });
  it("falha se a regra está ligada a um retiro não visível", () => {
    expect(() => validateLoadedGmd([{ ...geral, retiro_id: retreat, categoria: "Engorda" }], id, [])).toThrow();
  });
  it("aceita configuração geral válida", () => {
    expect(() => validateLoadedGmd([geral], id, [])).not.toThrow();
  });
  it("bloqueia modo com formulário de categoria incompleto", () => {
    expect(() => expectedGmd("categoria", summer, { verao: "", inverno: "" }, { faz: { "Engorda": "0,4" } }, [])).toThrow();
  });
  it("bloqueia verão inválido", () => {
    expect(() => expectedGmd("geral", { ini: 13, fim: 8 }, { verao: "0,5", inverno: "0,2" }, {}, [])).toThrow();
  });
  it("bloqueia valores GMD fora de faixa", () => {
    expect(() => expectedGmd("geral", summer, { verao: "9", inverno: "0,2" }, {}, [])).toThrow();
  });
  it("confirma somente quando modo, meses e valores batem", () => {
    const expectState = expectedGmd("geral", summer, { verao: "0,5", inverno: "0,2" }, {}, []);
    const farm = { id, gmd_modo: "geral", verao_mes_inicio: 2, verao_mes_fim: 8 };
    expect(verifyGmdReadback(farm, [geral], expectState)).toBe(true);
    expect(verifyGmdReadback({ ...farm, gmd_modo: "categoria" }, [geral], expectState)).toBe(false);
    expect(verifyGmdReadback({ ...farm, verao_mes_inicio: 3 }, [geral], expectState)).toBe(false);
    expect(verifyGmdReadback(farm, [{ ...geral, gmd_verao_kg: 0.1 }], expectState)).toBe(false);
  });
  it("readback não aceita regra inesperada inserida por concorrente", () => {
    const target = expectedGmd("categoria", summer, { verao: "", inverno: "" },
      { faz: { ...emptyCategories, "Engorda": "0,4" } }, []);
    const farm = { id, gmd_modo: "categoria", verao_mes_inicio: 2, verao_mes_fim: 8 };
    const row: GmdRow = { ...geral, retiro_id: null, categoria: "Engorda", gmd_kg: 0.4 };
    expect(verifyGmdReadback(farm, [row], target)).toBe(true);
    expect(verifyGmdReadback(farm, [row, { ...row, id: "other", categoria: "Cria", gmd_kg: 0.9 }], target)).toBe(false);
    expect(verifyGmdReadback(farm, [row, { ...geral, id: "extra" }], target)).toBe(false);
  });
  it("readback não aceita regra de retiro extra concorrente", () => {
    const target = expectedGmd("retiro", summer, { verao: "", inverno: "" },
      { [retreat]: { ...emptyCategories, "Engorda": "0,4" } }, [retreat]);
    const farm = { id, gmd_modo: "retiro", verao_mes_inicio: 2, verao_mes_fim: 8 };
    const row: GmdRow = { ...geral, retiro_id: retreat, categoria: "Engorda", gmd_kg: 0.4 };
    expect(verifyGmdReadback(farm, [row], target)).toBe(true);
    expect(verifyGmdReadback(farm, [row, { ...row, id: "other", retiro_id: "retreat-b" }], target)).toBe(false);
  });
  it("permite valores nulos sem regra, mas não inventa registros", () => {
    const target = expectedGmd("geral", { ini: null, fim: null }, { verao: "", inverno: "" }, {}, []);
    expect(verifyGmdReadback({ id, gmd_modo: "geral", verao_mes_inicio: null, verao_mes_fim: null }, [], target)).toBe(true);
    expect(verifyGmdReadback({ id, gmd_modo: "geral", verao_mes_inicio: null, verao_mes_fim: null }, [geral], target)).toBe(false);
  });
});
