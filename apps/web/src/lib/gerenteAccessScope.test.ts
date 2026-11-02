import { describe, expect, it } from "vitest";
import { resolveGerenteAccessScope } from "./gerenteAccessScope";

const farmA = { id: "fazenda-a", nome: "Fazenda A" };
const farmB = { id: "fazenda-b", nome: "Fazenda B" };

describe("confirmed gerente farm scope", () => {
  it("does not query a stored farm before links are confirmed", () => {
    expect(resolveGerenteAccessScope("gerente-a", null, [farmA], farmA.id)).toEqual({
      fazendasAutorizadas: [], activeFazendaId: "",
    });
  });
  it("rejects a farm from a previous role after switching profiles", () => {
    expect(resolveGerenteAccessScope("gerente-b", "gerente-a", [farmA], farmA.id).activeFazendaId).toBe("");
  });
  it("keeps a confirmed and selected farm", () => {
    expect(resolveGerenteAccessScope("gerente-a", "gerente-a", [farmA, farmB], farmB.id).activeFazendaId).toBe(farmB.id);
  });
  it("ignores an unauthorized persisted farm and selects a confirmed fallback", () => {
    expect(resolveGerenteAccessScope("gerente-a", "gerente-a", [farmA], farmB.id).activeFazendaId).toBe(farmA.id);
  });
  it("does not invent a farm after a successful empty response", () => {
    expect(resolveGerenteAccessScope("gerente-a", "gerente-a", [], farmA.id).activeFazendaId).toBe("");
  });
  it("does not authorize a farm without an active role", () => {
    expect(resolveGerenteAccessScope(null, null, [farmA], farmA.id).activeFazendaId).toBe("");
  });
});
