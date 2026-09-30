import { describe, expect, it } from "vitest";
import { isRenderablePastoFoto } from "@/pages/RevisaoVisitaPage";

describe("fotos no card de revisão da visita de Rotina", () => {
  const real = (id: string) => ({ id, url: `consultor/visita/${id}.jpg`, ordem: 1 });

  it("remove slots e registros sem URL real", () => {
    const fotos = [
      { id: "slot-1", url: "", ordem: 1 },
      { id: "slot-2", url: "   ", ordem: 2 },
      null,
    ].filter(isRenderablePastoFoto);

    expect(fotos).toHaveLength(0);
  });

  it("mantém exatamente duas fotos reais, sem completar cinco slots", () => {
    const fotos = [
      real("foto-1"),
      { id: "slot-3", url: "", ordem: 3 },
      real("foto-2"),
    ].filter(isRenderablePastoFoto).slice(0, 5);

    expect(fotos.map(foto => foto.id)).toEqual(["foto-1", "foto-2"]);
  });

  it("limita a exibição às cinco fotos reais", () => {
    const fotos = Array.from({ length: 6 }, (_, index) => real(`foto-${index + 1}`))
      .filter(isRenderablePastoFoto)
      .slice(0, 5);

    expect(fotos).toHaveLength(5);
  });
});