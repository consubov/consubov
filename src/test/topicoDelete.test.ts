import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";

import {
  putFoto,
  putMutation,
  putSnapshot,
  listAllFotos,
  listAllMutations,
  listFotosByParent,
} from "@/lib/consultorOffline/db";
import { dropMutationsForRows } from "@/lib/consultorOffline/mutationQueue";
import { purgeOrphanQueueItems, purgeTopicoFromQueue } from "@/lib/consultorOffline/photoQueue";

const VISITA = "visita-1";

// jsdom pode não implementar Blob.arrayBuffer
if (typeof (Blob.prototype as any).arrayBuffer !== "function") {
  (Blob.prototype as any).arrayBuffer = function () {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this as Blob);
    });
  };
}

function makeBlob(): Blob {
  return new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
}

function foto(localId: string, parentId: string) {
  return {
    localId,
    visitaId: VISITA,
    parentKind: "topico" as const,
    parentId,
    ordem: 1,
    blob: makeBlob(),
    mime: "image/jpeg",
    size: 3,
    createdAt: new Date().toISOString(),
    tries: 0,
    status: "pending" as const,
  };
}

function mutation(id: string, rowId: string, table: string, operation: any = "upsert") {
  return {
    id,
    visitaId: VISITA,
    table,
    rowId,
    operation,
    patch: {},
    createdAt: new Date().toISOString(),
    tries: 0,
    status: "pending" as const,
  };
}

describe("exclusão de tópico offline", () => {
  it("cascateia fotos/mutações do tópico excluído e preserva o novo tópico", async () => {
    await putFoto(foto("f-old", "topico-old"));
    await putFoto(foto("f-new", "topico-new"));
    await putMutation(mutation("m-old", "topico-old", "visita_topicos"));
    await putMutation(mutation("m-old-foto", "foto-row-old", "visita_topico_fotos"));
    await putMutation(mutation("m-del", "topico-old", "visita_topicos", "delete"));
    await putMutation(mutation("m-new", "topico-new", "visita_topicos"));

    await purgeTopicoFromQueue("topico-old", ["foto-row-old"]);

    expect(await listFotosByParent("topico", "topico-old")).toHaveLength(0);
    const restantes = (await listAllMutations()).map((m) => m.id).sort();
    // exclusão do tópico continua na fila; criação do novo tópico intacta
    expect(restantes).toEqual(["m-del", "m-new"]);
    console.log("DEBUG", (await listAllFotos()).map((f) => f.localId));
  });

  it("purgeOrphanQueueItems limpa fila de tópicos com deleted_at no snapshot", async () => {
    await putFoto(foto("f-orfa", "topico-morto"));
    await putMutation(mutation("m-orfa", "topico-morto", "visita_topicos"));
    await putSnapshot({
      visitaId: VISITA,
      updatedAt: new Date().toISOString(),
      data: {
        visita: { id: VISITA },
        topicos: [
          { id: "topico-morto", deleted_at: new Date().toISOString(), fotos: [{ id: "foto-row-morta" }] },
          { id: "topico-vivo", fotos: [] },
        ],
      },
    });

    await purgeOrphanQueueItems();

    expect(await listFotosByParent("topico", "topico-morto")).toHaveLength(0);
    expect((await listAllMutations()).some((m) => m.id === "m-orfa")).toBe(false);
  });

  it("dropMutationsForRows nunca remove mutações de exclusão", async () => {
    await putMutation(mutation("m-keep-del", "row-x", "visita_topicos", "delete"));
    await dropMutationsForRows(["row-x"]);
    expect((await listAllMutations()).some((m) => m.id === "m-keep-del")).toBe(true);
  });
});
