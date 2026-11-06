import { describe, expect, it } from "vitest";
import { motivoManualValido, resolverMotivoManual } from "../components/capataz/manualMotivos";

describe("lancamento manual multipastos", () => {
  it("aplica motivo geral aos varios pastos sem especifico", () => {
    const motivos = ["", " ", ""].map((m) => resolverMotivoManual(m, "QR danificado"));
    expect(motivos).toEqual(["QR danificado", "QR danificado", "QR danificado"]);
  });
  it("prioriza motivo especifico por pasto", () => {
    expect(resolverMotivoManual("Celular sem bateria", "QR danificado")).toBe("Celular sem bateria");
    expect(resolverMotivoManual("", "QR danificado")).toBe("QR danificado");
  });
  it("rejeita motivo ausente ou curto", () => {
    expect(motivoManualValido("", "")).toBe(false);
    expect(motivoManualValido("abc", "")).toBe(false);
    expect(motivoManualValido("", "abc")).toBe(false);
    expect(motivoManualValido("", "Falha no QR")).toBe(true);
  });
  it("nao mistura motivos entre pastos", () => {
    const a = resolverMotivoManual("Falha no aparelho", "QR danificado");
    const b = resolverMotivoManual("", "QR danificado");
    expect([a,b]).toEqual(["Falha no aparelho","QR danificado"]);
  });
});
