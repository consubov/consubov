import { describe, expect, test } from "bun:test";
import { createFarmId } from "./farm";

describe("createFarmId", () => {
  test("normaliza o identificador informado", () => {
    expect(createFarmId("  farm-1  ")).toBe("farm-1");
  });

  test("recusa identificador vazio ou com apenas espaços", () => {
    expect(() => createFarmId("   ")).toThrow();
  });

  test("recusa identificador acima do limite de 128 caracteres", () => {
    expect(() => createFarmId("f".repeat(129))).toThrow();
  });

  test("aceita exatamente 128 caracteres", () => {
    expect(createFarmId("f".repeat(128))).toHaveLength(128);
  });
});
