import { describe, expect, test } from "bun:test";
import { resolverValorOverride } from "./cabecalho";

describe("resolverValorOverride", () => {
  test("retorna null quando o valor digitado for vazio", () => {
    expect(resolverValorOverride("", "original")).toBeNull();
  });

  test("retorna null quando o valor digitado contiver apenas espaços em branco", () => {
    expect(resolverValorOverride("   ", "original")).toBeNull();
  });

  test("retorna null quando o valor digitado for idêntico ao original", () => {
    expect(resolverValorOverride("original", "original")).toBeNull();
  });

  test("retorna null quando o valor digitado for idêntico ao original ignorando espaços em branco", () => {
    expect(resolverValorOverride(" original ", "  original ")).toBeNull();
  });

  test("retorna o valor digitado sem espaços extras quando ele diferir do original", () => {
    expect(resolverValorOverride(" novo valor ", " original ")).toBe("novo valor");
  });
});
