import { describe, expect, it } from "vitest";
import { loadSnapshot, patchSnapshot, saveSnapshot } from "@/lib/consultorOffline/snapshotStore";
import { nextPhotoFailureState, resolveParentLookup } from "@/lib/consultorOffline/photoQueue";

describe("verificação do registro pai da foto", () => {
  it("trata ausência confirmada como espera normal", () => {
    expect(resolveParentLookup({ data: null, error: null })).toBe(false);
  });

  it("propaga erro real de consulta para consumir retry e ficar visível", () => {
    expect(() => resolveParentLookup({ data: null, error: { message: "permission denied" } }))
      .toThrow("permission denied");
  });

  it("confirma o pai quando o servidor retorna seu id", () => {
    expect(resolveParentLookup({ data: { id: "p1" }, error: null })).toBe(true);
  });

  it("mantém retries automáticos e torna a terceira falha visível", () => {
    expect(nextPhotoFailureState(0)).toEqual({ tries: 1, status: "pending" });
    expect(nextPhotoFailureState(1)).toEqual({ tries: 2, status: "pending" });
    expect(nextPhotoFailureState(2)).toEqual({ tries: 3, status: "error" });
  });
});

describe("snapshot serializado do Relatto", () => {
  it("não perde uma alteração concorrente feita após uma carga de servidor", async () => {
    const visitaId = crypto.randomUUID();
    await saveSnapshot(visitaId, {
      visita: { id: visitaId },
      pastos: [{ id: "p1", letra: "A", samples: { fezes: [], corporal: [], bebedouro: [] } }],
    });

    const serverRefresh = patchSnapshot(visitaId, async (current) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { ...current, fazenda: { nome_fazenda: "Servidor" } };
    });
    const localSample = patchSnapshot(visitaId, (current) => ({
      ...current,
      pastos: (current.pastos || []).map((p) => p.id === "p1"
        ? { ...p, samples: { ...p.samples, fezes: [{ id: "s1", nota: 4 }] } }
        : p),
    }));

    await Promise.all([serverRefresh, localSample]);
    const result = await loadSnapshot(visitaId);
    expect(result?.fazenda?.nome_fazenda).toBe("Servidor");
    expect(result?.pastos?.[0]?.samples?.fezes).toEqual([{ id: "s1", nota: 4 }]);
  });
});