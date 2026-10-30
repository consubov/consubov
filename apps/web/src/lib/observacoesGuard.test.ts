import { describe, expect, it } from "vitest";
import { confirmObservationRead, confirmObservationResolved, isObservationContextCurrent, isObservationAccessDenied } from "./observacoesGuard";

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
  });
  it("discards stale tenant/sequence responses", () => {
    expect(isObservationContextCurrent("A","B",3,3)).toBe(false);
    expect(isObservationContextCurrent("A","A",2,3)).toBe(false);
    expect(isObservationContextCurrent("A","A",3,3)).toBe(true);
  });
});