import { describe, expect, test } from "bun:test";
import { createAssinanteId, createVisitaId } from "./identificadores";
import { VisitaDominioError } from "./erros";

describe("Identificadores", () => {
  describe("createAssinanteId", () => {
    test("cria AssinanteId com valor válido", () => {
      const id = createAssinanteId("assinante-123");
      expect(id).toBe("assinante-123");
    });

    test("remove espaços em branco no início e fim", () => {
      const id = createAssinanteId("  assinante-123  ");
      expect(id).toBe("assinante-123");
    });

    test("lança erro se o valor for vazio ou apenas espaços", () => {
      expect(() => createAssinanteId("")).toThrow(VisitaDominioError);
      expect(() => createAssinanteId("")).toThrow(/Assinante id/);

      expect(() => createAssinanteId("   ")).toThrow(VisitaDominioError);

      try {
        createAssinanteId("");
        expect(true).toBe(false); // não deve chegar aqui
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(VisitaDominioError);
        expect((error as VisitaDominioError).codigo).toBe("ASSINANTE_ID_INVALIDO");
      }
    });

    test("lança erro se o valor for muito longo (mais de 128 caracteres)", () => {
      const idLongo = "a".repeat(129);
      expect(() => createAssinanteId(idLongo)).toThrow(VisitaDominioError);
      expect(() => createAssinanteId(idLongo)).toThrow(/128 characters/);

      try {
        createAssinanteId(idLongo);
        expect(true).toBe(false);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(VisitaDominioError);
        expect((error as VisitaDominioError).codigo).toBe("ASSINANTE_ID_INVALIDO");
      }
    });

    test("permite valor com exatamente 128 caracteres", () => {
      const idValido = "a".repeat(128);
      const id = createAssinanteId(idValido);
      expect(id).toBe(idValido);
    });
  });

  describe("createVisitaId", () => {
    test("cria VisitaId com valor válido", () => {
      const id = createVisitaId("visita-123");
      expect(id).toBe("visita-123");
    });

    test("remove espaços em branco no início e fim", () => {
      const id = createVisitaId("  visita-123  ");
      expect(id).toBe("visita-123");
    });

    test("lança erro se o valor for vazio ou apenas espaços", () => {
      expect(() => createVisitaId("")).toThrow(VisitaDominioError);
      expect(() => createVisitaId("")).toThrow(/Visita id/);

      expect(() => createVisitaId("   ")).toThrow(VisitaDominioError);

      try {
        createVisitaId("");
        expect(true).toBe(false);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(VisitaDominioError);
        expect((error as VisitaDominioError).codigo).toBe("VISITA_ID_INVALIDO");
      }
    });

    test("lança erro se o valor for muito longo (mais de 128 caracteres)", () => {
      const idLongo = "a".repeat(129);
      expect(() => createVisitaId(idLongo)).toThrow(VisitaDominioError);
      expect(() => createVisitaId(idLongo)).toThrow(/128 characters/);

      try {
        createVisitaId(idLongo);
        expect(true).toBe(false);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(VisitaDominioError);
        expect((error as VisitaDominioError).codigo).toBe("VISITA_ID_INVALIDO");
      }
    });

    test("permite valor com exatamente 128 caracteres", () => {
      const idValido = "a".repeat(128);
      const id = createVisitaId(idValido);
      expect(id).toBe(idValido);
    });
  });
});
