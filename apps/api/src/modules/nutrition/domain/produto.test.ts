import { describe, expect, test } from "bun:test";
import { resolverProdutoIdDoLote } from "./produto";

describe("resolverProdutoIdDoLote", () => {
  test("deve retornar o produto do pasto quando fornecido, pois tem precedência", () => {
    expect(resolverProdutoIdDoLote("produto-pasto", "produto-retiro")).toBe("produto-pasto");
    expect(resolverProdutoIdDoLote("produto-pasto", null)).toBe("produto-pasto");
    expect(resolverProdutoIdDoLote("produto-pasto", undefined)).toBe("produto-pasto");
  });

  test("deve retornar o produto do retiro quando o produto do pasto não for fornecido", () => {
    expect(resolverProdutoIdDoLote(null, "produto-retiro")).toBe("produto-retiro");
    expect(resolverProdutoIdDoLote(undefined, "produto-retiro")).toBe("produto-retiro");
  });

  test("deve retornar null quando nenhum produto for fornecido", () => {
    expect(resolverProdutoIdDoLote(null, null)).toBeNull();
    expect(resolverProdutoIdDoLote(undefined, undefined)).toBeNull();
    expect(resolverProdutoIdDoLote(null, undefined)).toBeNull();
    expect(resolverProdutoIdDoLote(undefined, null)).toBeNull();
  });
});
