import { describe, expect, test } from "bun:test";
import { sortPastos } from "./ordenacao";

describe("sortPastos", () => {
  test("ordena por nome em pt-BR com critério numérico", () => {
    const resultado = sortPastos([
      { nome: "Pasto 10" },
      { nome: "Pasto 2" },
      { nome: "Pasto 1" },
    ]);
    expect(resultado.map((p) => p.nome)).toEqual([
      "Pasto 1",
      "Pasto 2",
      "Pasto 10",
    ]);
  });

  test("não altera o array recebido", () => {
    const original = [{ nome: "B" }, { nome: "A" }];
    sortPastos(original);
    expect(original.map((p) => p.nome)).toEqual(["B", "A"]);
  });

  test("trata nome nulo como string vazia, indo para o início", () => {
    const resultado = sortPastos([
      { nome: "Alto" },
      { nome: null },
      { nome: undefined },
      { nome: "Baixo" },
    ]);
    expect(resultado.map((p) => p.nome ?? "")).toEqual([
      "",
      "",
      "Alto",
      "Baixo",
    ]);
  });

  test("agrupa ignorando maiúsculas e acentos", () => {
    const resultado = sortPastos([{ nome: "cafe" }, { nome: "Café" }]);
    expect(resultado).toHaveLength(2);
  });
});
