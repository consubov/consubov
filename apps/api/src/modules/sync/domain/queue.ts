/**
 * Pure rules of the offline queue: dependency order, failure classification,
 * parent recovery vocabulary, retry backoff, local-first merge and local lot
 * numbering.
 *
 * Every rule here is extracted from the running web implementation so the
 * decision can be exercised without a queue, a clock or a network. The engine
 * that applies these rules stays in the web application
 * (see ./contracts.ts for the boundary).
 */
import type {
  SyncFailureState,
  SyncMutation,
  SyncParentKind,
  SyncParentReference,
  SyncPhotoRetryState,
} from "./contracts";
import {
  LOCAL_LOT_CODE_WIDTH,
  MAX_AUTO_RETRIES,
  MAX_LOCAL_LOT_CODE,
  SYNC_RETRY_DELAY_BASE_MS,
  SYNC_RETRY_DELAY_CAP_MS,
} from "./contracts";

/**
 * Send order: the parent record must exist on the server before its children.
 * The lower the number, the earlier the mutation is sent.
 * (`apps/web/src/lib/consultorOffline/mutationQueue.ts:105-114`)
 */
export const SYNC_TABLE_PRIORITY: Readonly<Record<string, number>> = {
  visitas_tecnicas: 0,
  visita_pastos: 1,
  visita_currais: 1,
  visita_topicos: 1,
  avaliacoes_score: 2,
  avaliacoes_fabrica_quesito: 2,
  visita_fotos: 3,
  visita_topico_fotos: 3,
};

/** Tables without an explicit priority are treated as middle priority (`mutationQueue.ts:117`). */
export const SYNC_DEFAULT_TABLE_PRIORITY = 2;

/**
 * Priority of one mutation. Deletions go last: rows are created/updated first
 * and only then removed (`mutationQueue.ts:116-120`).
 */
export function mutationRank(mutation: SyncMutation): number {
  const base = SYNC_TABLE_PRIORITY[mutation.table] ?? SYNC_DEFAULT_TABLE_PRIORITY;

  return (mutation.operation ?? "update") === "delete" ? base + 10 : base;
}

/** Dependency order first, then FIFO by creation instant (`mutationQueue.ts:122-128`). */
export function sortSyncMutations(
  items: readonly SyncMutation[],
): SyncMutation[] {
  return [...items].sort((a, b) => {
    const rank = mutationRank(a) - mutationRank(b);
    if (rank !== 0) return rank;

    return String(a.createdAt).localeCompare(String(b.createdAt));
  });
}

/**
 * Dependency failure: the parent record is not on the server yet, so the
 * mutation must be deferred instead of consuming an attempt
 * (`mutationQueue.ts:130-133`, duplicated in `photoQueue.ts:196-199`).
 */
export function isDependencyError(message: string): boolean {
  const normalized = (message || "").toLowerCase();

  return (
    normalized.includes("foreign key") ||
    normalized.includes("fkey") ||
    normalized.includes("23503")
  );
}

/**
 * Parent tables: a missing one is never discarded from the queue, because its
 * children would become orphans forever (`mutationQueue.ts:136`, `:223-238`).
 */
export const SYNC_PARENT_TABLES: ReadonlySet<string> = new Set([
  "visitas_tecnicas",
  "visita_pastos",
  "visita_currais",
  "visita_topicos",
]);

/** Which parent record each child table depends on (`mutationQueue.ts:139-143`). */
export const SYNC_CHILD_PARENT_FIELDS: Readonly<
  Record<string, ReadonlyArray<readonly [string, SyncParentKind]>>
> = {
  avaliacoes_score: [
    ["visita_pasto_id", "pasto"],
    ["visita_curral_id", "curral"],
  ],
  visita_fotos: [
    ["visita_pasto_id", "pasto"],
    ["visita_curral_id", "curral"],
  ],
  visita_topico_fotos: [["visita_topico_id", "topico"]],
};

/** Parent record referenced by a child mutation, or null (`mutationQueue.ts:145-153`). */
export function parentRefOfMutation(
  mutation: SyncMutation,
): SyncParentReference | null {
  const fields = SYNC_CHILD_PARENT_FIELDS[mutation.table];
  if (!fields) return null;

  for (const [field, kind] of fields) {
    const id = mutation.patch?.[field];
    if (typeof id === "string" && id) return { kind, id };
  }

  return null;
}

/**
 * Failure state of a photo upload attempt: retries stay automatic until the
 * third one, which becomes a visible error (`photoQueue.ts:237-240`).
 */
export function nextPhotoFailureState(currentTries: number): SyncPhotoRetryState {
  const tries = currentTries + 1;

  return {
    tries,
    status: tries >= MAX_AUTO_RETRIES ? "error" : "pending",
  };
}

/**
 * Failure state of a mutation attempt (`mutationQueue.ts:265-302`).
 *
 * A dependency failure is not a failure: the mutation returns to `pending`,
 * keeps its attempts and spends one deferral round. Any other failure spends an
 * attempt and marks the mutation as `error`.
 *
 * The deferred message is kept verbatim because it is user visible in the
 * existing queue; replacing the wording would change what the field user reads.
 */
export function nextSyncFailureState(input: {
  tries?: number;
  deferredRounds?: number;
  errorMessage: string;
}): SyncFailureState {
  const tries = input.tries ?? 0;
  const deferredRounds = input.deferredRounds ?? 0;

  if (isDependencyError(input.errorMessage)) {
    return {
      status: "pending",
      tries,
      deferredRounds: deferredRounds + 1,
      lastError: `aguardando sincronização do registro principal (${input.errorMessage})`,
    };
  }

  return {
    status: "error",
    tries: tries + 1,
    deferredRounds,
    lastError: input.errorMessage,
  };
}

/**
 * Message of an unknown failure value (`network.ts:7-12`), extracted because the
 * parent lookup below needs it without touching a timer or a request.
 */
export function syncErrorMessage(error: unknown): string {
  if (!error) return "erro desconhecido";
  if (error instanceof Error && error.message) return error.message;
  if (
    typeof error === "object" &&
    "message" in error &&
    (error as { message?: unknown }).message
  ) {
    return String((error as { message?: unknown }).message);
  }

  return String(error);
}

/**
 * Semantics of the parent lookup: an absent parent is a normal wait, while a
 * query error is a real failure that must consume retries and become visible.
 * (`photoQueue.ts:229-235`)
 *
 * The error text is kept verbatim from the running implementation.
 */
export function resolveParentLookup(result: {
  data?: { id?: string } | null;
  error?: unknown;
}): boolean {
  if (result.error) {
    throw new Error(
      `Falha ao verificar registro principal no servidor: ${syncErrorMessage(result.error)}`,
    );
  }

  return Boolean(result.data?.id);
}

/** Fields that only exist on the device and are never sent to the server (`parentRecovery.ts:41`). */
export const LOCAL_ONLY_PARENT_FIELDS: ReadonlySet<string> = new Set([
  "fotos",
  "signed",
  "samples",
  "avaliacoes",
  "queued",
  "pending",
  "localOnly",
]);

/**
 * Payload used to rebuild a parent record from the device snapshot: no `id`
 * (the row identity is added by the send), no device-only fields, no
 * `undefined`, and nothing nested (`parentRecovery.ts:56-65`).
 */
export function buildParentPayload(
  record: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record ?? {})) {
    if (key === "id" || LOCAL_ONLY_PARENT_FIELDS.has(key)) continue;
    if (value === undefined) continue;
    if (value !== null && typeof value === "object") continue;

    payload[key] = value;
  }

  return payload;
}

/**
 * Backoff between retries: linear growth capped at 4s (`network.ts:55-57`).
 */
export function retryDelayMs(attempt: number): number {
  return Math.min(SYNC_RETRY_DELAY_CAP_MS, SYNC_RETRY_DELAY_BASE_MS * attempt);
}

/**
 * A visita deleted on the server stays visible on the device as deleted; the
 * local queue must not treat it as pending work
 * (`apps/web/src/lib/consultorOffline/snapshotStore.ts:68-70`).
 */
export function isVisitaDeleted(
  visita?: Record<string, unknown> | null,
): boolean {
  return Boolean(visita?.deleted_at);
}

/**
 * Local-first merge: confirmed rows win, and a pending local row only enters
 * when its `id` is still absent (`apps/web/src/lib/maisArrobasQueue.ts:389-396`).
 */
export function mergeLocalFirstRows<T extends { id: string }>(
  serverRows: readonly T[],
  pendingRows: readonly Record<string, unknown>[],
): T[] {
  const byId = new Map(serverRows.map((row) => [row.id, row]));

  for (const row of pendingRows) {
    if (typeof row.id === "string" && !byId.has(row.id)) byId.set(row.id, row as T);
  }

  return [...byId.values()];
}

/**
 * Next local lot code: the first free 3-digit code in `001..999`, considering
 * server codes and codes still on the device
 * (`apps/web/src/lib/maisArrobasQueue.ts:398-406`). Throws at the limit
 * instead of silently reusing a code.
 */
export function nextLocalLotCode(codigos: Iterable<string>): string {
  const usados = new Set(codigos);

  for (let i = 1; i <= MAX_LOCAL_LOT_CODE; i++) {
    const codigo = String(i).padStart(LOCAL_LOT_CODE_WIDTH, "0");
    if (!usados.has(codigo)) return codigo;
  }

  throw new Error(`Limite de ${MAX_LOCAL_LOT_CODE} lotes atingido`);
}
