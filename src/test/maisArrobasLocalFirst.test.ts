import { describe, expect, it } from "vitest";
import { mergeMaRows, nextMaLoteCodigo } from "@/lib/maisArrobasQueue";

describe("Mais Arrobas local-first", () => {
  it("combina servidor e pendentes sem duplicar UUID", () => {
    const rows = mergeMaRows(
      [{ id: "a", nome: "Servidor" }],
      [{ id: "a", nome: "Reenvio" }, { id: "b", nome: "Local" }],
    );
    expect(rows).toEqual([
      { id: "a", nome: "Servidor" },
      { id: "b", nome: "Local" },
    ]);
  });

  it("escolhe o primeiro código livre entre servidor e pendentes", () => {
    expect(nextMaLoteCodigo(["001", "002", "004"])).toBe("003");
  });

  it("recusa mais de 999 códigos", () => {
    const todos = Array.from({ length: 999 }, (_, index) => String(index + 1).padStart(3, "0"));
    expect(() => nextMaLoteCodigo(todos)).toThrow("Limite de 999 lotes atingido");
  });
});