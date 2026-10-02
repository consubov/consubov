import { describe, expect, test } from "bun:test";
import { modulosVisiveis, moduloDoAviso, MODULOS_AVISO } from "./avisos";

describe("segmentação dos avisos", () => {
  test("o módulo geral acompanha o módulo próprio do usuário", () => {
    expect(modulosVisiveis("relatto")).toEqual(["geral", "relatto"]);
  });

  test("consultor pertence ao módulo relatto", () => {
    expect(moduloDoAviso("consultor")).toBe("relatto");
  });

  test("pecuarista e pesador pertencem ao módulo mais_arrobas", () => {
    expect(moduloDoAviso("pecuarista")).toBe("mais_arrobas");
    expect(moduloDoAviso("pesador")).toBe("mais_arrobas");
  });

  test("papéis sem mapeamento e papel ausente caem em consubov", () => {
    expect(moduloDoAviso("capataz")).toBe("consubov");
    expect(moduloDoAviso(null)).toBe("consubov");
    expect(moduloDoAviso()).toBe("consubov");
  });

  test("o catálogo declara os quatro módulos", () => {
    expect(MODULOS_AVISO.map((m) => m.value)).toEqual([
      "geral",
      "consubov",
      "relatto",
      "mais_arrobas",
    ]);
  });
});
