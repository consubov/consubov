import { describe, expect, it } from "vitest";
import { confirmObservationRead, confirmObservationResolved, isObservationContextCurrent, isObservationAccessDenied, confirmObservationSynced, observationInScope } from "./observacoesGuard";

const row = { id: "obs-a", fazenda_id: "farm-a", resolvido: true,
  resolvido_em: "2026-10-29T12:00:00Z", resolvido_por: "gerente-a" };
const ok = <T,>(data: T[]) => ({ data, error: null });
const denied = { data: null, error: { code: "42501", message: "INTERNAL SQL MESSAGE" } };

describe("F12-L34 observation client guard", () => {
  it("accepts empty confirmed SELECT and own farm rows", () => {
    expect(confirmObservationRead(ok([]), "farm-a")).toEqual([]);
    expect(confirmObservationRead(ok([row]), "farm-a")).toEqual([row]);
  });
  it("fails closed on 42501 or absent data without leaking SQL detail", () => {
    expect(() => confirmObservationRead(denied, "farm-a")).toThrow(/confirmar/);
    expect(() => confirmObservationRead(denied, "farm-a")).not.toThrow(/INTERNAL SQL MESSAGE/);
    expect(() => confirmObservationRead({data:null,error:null}, "farm-a")).toThrow();
  });
  it("rejects cross-farm rows, duplicate ids and empty context", () => {
    expect(() => confirmObservationRead(ok([row]), "farm-b")).toThrow();
    expect(() => confirmObservationRead(ok([row, row]), "farm-a")).toThrow();
    expect(() => confirmObservationRead(ok([row]), " ")).toThrow();
  });
  it("confirms exactly one resolved row with matching identity and valid timestamp", () => {
    expect(confirmObservationResolved(ok([row]), "obs-a", "farm-a")).toEqual(row);
    expect(() => confirmObservationResolved(ok([]), "obs-a", "farm-a")).toThrow();
    expect(() => confirmObservationResolved(ok([row,row]), "obs-a", "farm-a")).toThrow();
    expect(() => confirmObservationResolved(denied, "obs-a", "farm-a")).toThrow();
    expect(() => confirmObservationResolved(ok([row]), "obs-b", "farm-a")).toThrow();
    expect(() => confirmObservationResolved(ok([row]), "obs-a", "farm-b")).toThrow();
    expect(() => confirmObservationResolved(ok([{...row,resolvido:false}]), "obs-a", "farm-a")).toThrow();
    expect(() => confirmObservationResolved(ok([{...row,resolvido_em:"bad"}]), "obs-a", "farm-a")).toThrow();
  });
  it("detects access revocation while keeping transient errors distinct", () => {
    expect(isObservationAccessDenied({code:"42501"})).toBe(true);
    expect(isObservationAccessDenied({status:401})).toBe(true);
    expect(isObservationAccessDenied({status:403})).toBe(true);
    expect(isObservationAccessDenied({code:"PGRST116"})).toBe(false);
    expect(isObservationAccessDenied({code:"NETWORK_ERROR"})).toBe(false);
    expect(isObservationAccessDenied(null)).toBe(false);
    expect(isObservationAccessDenied({ code: "PGRST_GENERIC" }, 403)).toBe(true);
    expect(isObservationAccessDenied(null, 401)).toBe(true);
    expect(isObservationAccessDenied(null, 503)).toBe(false);
  });
  it("discards stale tenant/sequence responses", () => {
    expect(isObservationContextCurrent("A","B",3,3)).toBe(false);
    expect(isObservationContextCurrent("A","A",2,3)).toBe(false);
    expect(isObservationContextCurrent("A","A",3,3)).toBe(true);
  });
});

describe("F12-L34 offline sync acknowledgment", () => {
  const persisted = { id: "obs-1", fazenda_id: "farm-a", retiro_id: "ret-a",
    pasto_id: "pasto-a", capataz_nome: "cap-a", tipo: "geral",
    descricao: "cocho", foto_url: "data:image/jpeg;base64,abc" };
  it("accepts a confirmed new row or an already resolved retry", () => {
    expect(() => confirmObservationSynced(ok([{ ...persisted, resolvido: false }]), persisted)).not.toThrow();
    expect(() => confirmObservationSynced(ok([{ ...persisted, resolvido: true }]), persisted)).not.toThrow();
  });
  it("keeps command pending on missing ACK, duplicate or RLS rejection", () => {
    expect(() => confirmObservationSynced(ok([]), persisted)).toThrow();
    expect(() => confirmObservationSynced(ok([persisted, persisted]), persisted)).toThrow();
    expect(() => confirmObservationSynced(denied, persisted)).toThrow(/confirmar/);
  });
  it("rejects a cross-farm record and mismatched immutable fields", () => {
    for (const [field, value] of [["fazenda_id", "farm-b"], ["retiro_id", "ret-b"],
      ["pasto_id", "pasto-b"], ["descricao", "different"], ["tipo", "other"],
      ["foto_url", "other"], ["capataz_nome", "another"], ["id", "obs-2"]] as const) {
      expect(() => confirmObservationSynced(ok([{...persisted,[field]:value}]),persisted)).toThrow();
    }
  });
});


describe("F12-L34 scoped offline observations", () => {
  const row = { fazenda_id: "farm-a", retiro_id: "ret-a" };
  it("denies a different tenant, retiro or missing scope", () => {
    expect(observationInScope(row, "farm-a", "ret-a")).toBe(true);
    expect(observationInScope(row, "farm-b", "ret-a")).toBe(false);
    expect(observationInScope(row, "farm-a", "ret-b")).toBe(false);
    expect(observationInScope(row, "", "ret-a")).toBe(false);
    expect(observationInScope(row, "farm-a", null)).toBe(false);
  });
});
