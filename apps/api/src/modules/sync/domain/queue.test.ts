import { describe, expect, test } from "bun:test";
import {
  buildParentPayload,
  isDependencyError,
  isVisitaDeleted,
  mergeLocalFirstRows,
  mutationRank,
  nextLocalLotCode,
  nextPhotoFailureState,
  nextSyncFailureState,
  parentRefOfMutation,
  resolveParentLookup,
  retryDelayMs,
  sortSyncMutations,
  type SyncMutation,
} from "./index";

function mutation(overrides: Partial<SyncMutation> = {}): SyncMutation {
  return {
    id: "mut-1",
    visitaId: "visita-1",
    table: "visitas_tecnicas",
    rowId: "row-1",
    operation: "update",
    patch: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    tries: 0,
    status: "pending",
    ...overrides,
  };
}

describe("dependency order of the queue", () => {
  test("sends the parent record before its children", () => {
    const items = [
      mutation({ id: "foto", table: "visita_fotos", createdAt: "2026-01-01T00:00:00.000Z" }),
      mutation({ id: "filho", table: "avaliacoes_score", createdAt: "2026-01-01T00:00:01.000Z" }),
      mutation({ id: "pai", table: "visita_pastos", createdAt: "2026-01-01T00:00:02.000Z" }),
    ];

    expect(sortSyncMutations(items).map((m) => m.id)).toEqual(["pai", "filho", "foto"]);
  });

  test("sends deletions last, after create and update of the same table", () => {
    const deleteRank = mutationRank(
      mutation({ table: "visita_pastos", operation: "delete" }),
    );
    const updateRank = mutationRank(
      mutation({ table: "visita_pastos", operation: "update" }),
    );

    expect(deleteRank).toBe(updateRank + 10);
  });

  test("treats an unknown table as middle priority and a missing operation as update", () => {
    expect(mutationRank(mutation({ table: "tabela_desconhecida" }))).toBe(2);
    expect(
      mutationRank(mutation({ table: "visita_fotos", operation: undefined })),
    ).toBe(3);
  });

  test("breaks ties by creation instant", () => {
    const items = [
      mutation({ id: "tarde", createdAt: "2026-01-02T00:00:00.000Z" }),
      mutation({ id: "cedo", createdAt: "2026-01-01T00:00:00.000Z" }),
    ];

    expect(sortSyncMutations(items).map((m) => m.id)).toEqual(["cedo", "tarde"]);
  });

  test("does not mutate the given list", () => {
    const items = [
      mutation({ id: "filho", table: "visita_fotos" }),
      mutation({ id: "pai", table: "visita_pastos" }),
    ];

    sortSyncMutations(items);

    expect(items.map((m) => m.id)).toEqual(["filho", "pai"]);
  });
});

describe("parent reference of a child mutation", () => {
  test("resolves the parent kind from the field the patch carries", () => {
    expect(
      parentRefOfMutation(
        mutation({ table: "visita_fotos", patch: { visita_pasto_id: "pasto-1" } }),
      ),
    ).toEqual({ kind: "pasto", id: "pasto-1" });

    expect(
      parentRefOfMutation(
        mutation({ table: "avaliacoes_score", patch: { visita_curral_id: "curral-9" } }),
      ),
    ).toEqual({ kind: "curral", id: "curral-9" });

    expect(
      parentRefOfMutation(
        mutation({ table: "visita_topico_fotos", patch: { visita_topico_id: "topico-3" } }),
      ),
    ).toEqual({ kind: "topico", id: "topico-3" });
  });

  test("returns null when the table has no parent or the field is absent or empty", () => {
    expect(parentRefOfMutation(mutation({ table: "visita_pastos" }))).toBeNull();
    expect(
      parentRefOfMutation(mutation({ table: "visita_fotos", patch: {} })),
    ).toBeNull();
    expect(
      parentRefOfMutation(
        mutation({ table: "visita_fotos", patch: { visita_pasto_id: "" } }),
      ),
    ).toBeNull();
    expect(
      parentRefOfMutation(
        mutation({ table: "visita_fotos", patch: { visita_pasto_id: 42 } }),
      ),
    ).toBeNull();
  });
});

describe("failure classification", () => {
  test("recognizes the dependency failures of the three proven shapes", () => {
    expect(isDependencyError("violates foreign key constraint")).toBe(true);
    expect(isDependencyError('duplicate key value violates unique constraint "x_fkey"')).toBe(true);
    expect(isDependencyError("23503: integrity constraint violation")).toBe(true);
    expect(isDependencyError("FOREIGN KEY")).toBe(true);
  });

  test("does not classify unrelated failures as dependency", () => {
    expect(isDependencyError("permission denied")).toBe(false);
    expect(isDependencyError("")).toBe(false);
  });

  test("keeps the mutation pending and only spends a deferral round on dependency", () => {
    expect(
      nextSyncFailureState({
        tries: 2,
        deferredRounds: 1,
        errorMessage: "violates foreign key constraint",
      }),
    ).toEqual({
      status: "pending",
      tries: 2,
      deferredRounds: 2,
      lastError: "aguardando sincronização do registro principal (violates foreign key constraint)",
    });
  });

  test("spends an attempt and marks the mutation as error on any other failure", () => {
    expect(
      nextSyncFailureState({ tries: 1, errorMessage: "permission denied" }),
    ).toEqual({
      status: "error",
      tries: 2,
      deferredRounds: 0,
      lastError: "permission denied",
    });
  });

  test("makes the third photo failure visible while the first two stay automatic", () => {
    expect(nextPhotoFailureState(0)).toEqual({ tries: 1, status: "pending" });
    expect(nextPhotoFailureState(1)).toEqual({ tries: 2, status: "pending" });
    expect(nextPhotoFailureState(2)).toEqual({ tries: 3, status: "error" });
    expect(nextPhotoFailureState(3)).toEqual({ tries: 4, status: "error" });
  });
});

describe("parent lookup semantics", () => {
  test("treats an absent parent as a normal wait", () => {
    expect(resolveParentLookup({ data: null, error: null })).toBe(false);
    expect(resolveParentLookup({ error: null })).toBe(false);
  });

  test("confirms the parent when the remote row returns its id", () => {
    expect(resolveParentLookup({ data: { id: "p1" }, error: null })).toBe(true);
  });

  test("propagates a query error as a real failure", () => {
    expect(() =>
      resolveParentLookup({ data: null, error: { message: "permission denied" } }),
    ).toThrow("permission denied");
  });
});

describe("parent payload rebuilt from the device snapshot", () => {
  test("drops the id, device-only fields, undefined and nested values", () => {
    expect(
      buildParentPayload({
        id: "pasto-1",
        visita_id: "visita-1",
        fotos: [],
        signed: { assinatura: "x" },
        samples: {},
        avaliacoes: [],
        queued: true,
        pending: false,
        localOnly: "x",
        largura: null,
        area: 12.5,
        ausente: undefined,
        aninhado: { a: 1 },
        lista: [1, 2],
      }),
    ).toEqual({
      visita_id: "visita-1",
      largura: null,
      area: 12.5,
    });
  });

  test("returns an empty payload for a missing record", () => {
    expect(buildParentPayload(null)).toEqual({});
    expect(buildParentPayload(undefined)).toEqual({});
  });
});

describe("retry backoff", () => {
  test("grows linearly and stops at the proven ceiling", () => {
    expect(retryDelayMs(1)).toBe(700);
    expect(retryDelayMs(2)).toBe(1_400);
    expect(retryDelayMs(5)).toBe(3_500);
    expect(retryDelayMs(6)).toBe(4_000);
    expect(retryDelayMs(50)).toBe(4_000);
  });
});

describe("deleted visita on the device", () => {
  test("is recognized by its deletion instant", () => {
    expect(isVisitaDeleted({ deleted_at: "2026-01-01T00:00:00.000Z" })).toBe(true);
    expect(isVisitaDeleted({ deleted_at: null })).toBe(false);
    expect(isVisitaDeleted({})).toBe(false);
    expect(isVisitaDeleted(null)).toBe(false);
    expect(isVisitaDeleted(undefined)).toBe(false);
  });
});

describe("local-first merge", () => {
  test("keeps the confirmed rows and adds pending rows whose id is still absent", () => {
    const merged = mergeLocalFirstRows(
      [{ id: "a", origem: "servidor" }],
      [{ id: "b", origem: "pendente" }],
    );

    expect(merged).toEqual([
      { id: "a", origem: "servidor" },
      { id: "b", origem: "pendente" },
    ]);
  });

  test("never lets a pending row overwrite an already confirmed row", () => {
    const merged = mergeLocalFirstRows(
      [{ id: "a", origem: "servidor" }],
      [{ id: "a", origem: "pendente" }],
    );

    expect(merged).toEqual([{ id: "a", origem: "servidor" }]);
  });

  test("ignores a pending row without a string id", () => {
    const merged = mergeLocalFirstRows(
      [{ id: "a", origem: "servidor" }],
      [{ origem: "pendente" }, { id: 7, origem: "pendente" }],
    );

    expect(merged).toEqual([{ id: "a", origem: "servidor" }]);
  });
});

describe("local lot code", () => {
  test("returns the first free three-digit code", () => {
    expect(nextLocalLotCode([])).toBe("001");
    expect(nextLocalLotCode(["001", "002"])).toBe("003");
    expect(nextLocalLotCode(["001", "003"])).toBe("002");
    expect(nextLocalLotCode(new Set(["999"]))).toBe("001");
  });

  test("fails at the limit instead of reusing a code", () => {
    const usados = Array.from({ length: 999 }, (_, i) =>
      String(i + 1).padStart(3, "0"),
    );

    expect(() => nextLocalLotCode(usados)).toThrow("Limite de 999 lotes atingido");
  });
});
