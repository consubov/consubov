import { describe, expect, it } from "vitest";
import { readLegacyProtocoloId } from "./syncvetManejoProtocolo";

describe("SyncVet: leitura compatível do protocolo legado", () => {
  it("preserva um ID de protocolo existente", () => {
    expect(readLegacyProtocoloId({ id: "m1", protocolo_id: "protocolo-123" })).toBe("protocolo-123");
  });

  it("trata ausência ou valor nulo como sem protocolo", () => {
    expect(readLegacyProtocoloId({ id: "m1" })).toBeNull();
    expect(readLegacyProtocoloId({ protocolo_id: null })).toBeNull();
    expect(readLegacyProtocoloId(null)).toBeNull();
  });

  it("não transforma dados inválidos em IDs", () => {
    expect(readLegacyProtocoloId({ protocolo_id: 42 })).toBeNull();
    expect(readLegacyProtocoloId({ protocolo_id: {} })).toBeNull();
    expect(readLegacyProtocoloId({ protocolo_id: "" })).toBeNull();
  });
});
