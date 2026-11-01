import { describe, expect, test } from "bun:test";
import { createVisitaId, createAssinanteId } from "./identificadores";
import { VisitaDominioError } from "./erros";

describe("Identificadores", () => {
  describe("createVisitaId", () => {
    test("creates a valid VisitaId", () => {
      const id = "valid-visita-id";
      expect(createVisitaId(id)).toBe(id);
    });

    test("trims whitespace from the id", () => {
      expect(createVisitaId("  valid-visita-id  ")).toBe("valid-visita-id");
    });

    test("throws an error if the id is empty", () => {
      expect(() => createVisitaId("")).toThrow(VisitaDominioError);
      expect(() => createVisitaId("")).toThrow("Visita id must be non-empty and at most 128 characters.");
      try {
        createVisitaId("");
      } catch (e) {
        expect((e as VisitaDominioError).codigo).toBe("VISITA_ID_INVALIDO");
      }
    });

    test("throws an error if the id is only whitespace", () => {
      expect(() => createVisitaId("   ")).toThrow(VisitaDominioError);
      try {
        createVisitaId("   ");
      } catch (e) {
        expect((e as VisitaDominioError).codigo).toBe("VISITA_ID_INVALIDO");
      }
    });

    test("throws an error if the id exceeds 128 characters", () => {
      const longId = "a".repeat(129);
      expect(() => createVisitaId(longId)).toThrow(VisitaDominioError);
      try {
        createVisitaId(longId);
      } catch (e) {
        expect((e as VisitaDominioError).codigo).toBe("VISITA_ID_INVALIDO");
      }
    });

    test("accepts an id with exactly 128 characters", () => {
      const maxId = "a".repeat(128);
      expect(createVisitaId(maxId)).toBe(maxId);
    });
  });

  describe("createAssinanteId", () => {
    test("creates a valid AssinanteId", () => {
      const id = "valid-assinante-id";
      expect(createAssinanteId(id)).toBe(id);
    });

    test("trims whitespace from the id", () => {
      expect(createAssinanteId("  valid-assinante-id  ")).toBe("valid-assinante-id");
    });

    test("throws an error if the id is empty", () => {
      expect(() => createAssinanteId("")).toThrow(VisitaDominioError);
      expect(() => createAssinanteId("")).toThrow("Assinante id must be non-empty and at most 128 characters.");
      try {
        createAssinanteId("");
      } catch (e) {
        expect((e as VisitaDominioError).codigo).toBe("ASSINANTE_ID_INVALIDO");
      }
    });

    test("throws an error if the id is only whitespace", () => {
      expect(() => createAssinanteId("   ")).toThrow(VisitaDominioError);
      try {
        createAssinanteId("   ");
      } catch (e) {
        expect((e as VisitaDominioError).codigo).toBe("ASSINANTE_ID_INVALIDO");
      }
    });

    test("throws an error if the id exceeds 128 characters", () => {
      const longId = "a".repeat(129);
      expect(() => createAssinanteId(longId)).toThrow(VisitaDominioError);
      try {
        createAssinanteId(longId);
      } catch (e) {
        expect((e as VisitaDominioError).codigo).toBe("ASSINANTE_ID_INVALIDO");
      }
    });

    test("accepts an id with exactly 128 characters", () => {
      const maxId = "a".repeat(128);
      expect(createAssinanteId(maxId)).toBe(maxId);
    });
  });
});
