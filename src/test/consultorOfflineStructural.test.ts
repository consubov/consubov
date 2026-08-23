import { describe, expect, it } from "vitest";
import { loadSnapshot, patchSnapshot, saveSnapshot } from "@/lib/consultorOffline/snapshotStore";

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