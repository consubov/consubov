import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

let queue: typeof import("@/lib/consultorOffline/mutationQueue");
let db: typeof import("@/lib/consultorOffline/db");

beforeAll(async () => {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: false,
  });

  queue = await import("@/lib/consultorOffline/mutationQueue");
  db = await import("@/lib/consultorOffline/db");
});

afterEach(async () => {
  const items = await db.listAllMutations();
  await Promise.all(items.map((item) => db.deleteMutation(item.id)));
});

describe("fila de mutações offline", () => {
  it("mescla reenvios do mesmo registro em uma única pendência", async () => {
    const visitaId = crypto.randomUUID();
    const rowId = crypto.randomUUID();

    await queue.enqueueMutation({
      visitaId,
      table: "visita_topicos",
      rowId,
      operation: "update",
      patch: { titulo: "Primeiro título" },
    });
    await queue.enqueueMutation({
      visitaId,
      table: "visita_topicos",
      rowId,
      operation: "update",
      patch: { texto: "Complemento local" },
    });

    const items = await db.listMutationsByVisita(visitaId);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      visitaId,
      table: "visita_topicos",
      rowId,
      status: "pending",
      tries: 0,
      patch: {
        titulo: "Primeiro título",
        texto: "Complemento local",
      },
    });
    expect(await queue.getPendingMutationCount()).toBe(1);
  });

  it("delete local cancela insert ainda não confirmado", async () => {
    const visitaId = crypto.randomUUID();
    const rowId = crypto.randomUUID();

    await queue.enqueueMutation({
      visitaId,
      table: "visita_topicos",
      rowId,
      operation: "insert",
      patch: { visita_id: visitaId, titulo: "Rascunho" },
    });

    expect(await db.listMutationsByVisita(visitaId)).toHaveLength(1);

    await queue.enqueueMutation({
      visitaId,
      table: "visita_topicos",
      rowId,
      operation: "delete",
      patch: {},
    });

    expect(await db.listMutationsByVisita(visitaId)).toHaveLength(0);
  });

  it("retry manual revive falha sem perder a mutação local", async () => {
    const visitaId = crypto.randomUUID();
    const mutationId = crypto.randomUUID();

    await db.putMutation({
      id: mutationId,
      visitaId,
      table: "visita_pastos",
      rowId: crypto.randomUUID(),
      operation: "update",
      patch: { observacao: "mantida no aparelho" },
      createdAt: new Date().toISOString(),
      tries: 3,
      deferredRounds: 2,
      status: "error",
      lastError: "falha temporária",
    });

    await queue.retryFailedMutations();

    const [revived] = await db.listMutationsByVisita(visitaId);

    expect(revived).toMatchObject({
      id: mutationId,
      status: "pending",
      tries: 0,
      deferredRounds: 0,
      patch: { observacao: "mantida no aparelho" },
    });
    expect(revived.lastError).toBeUndefined();
  });
});
