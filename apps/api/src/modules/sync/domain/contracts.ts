/**
 * Sync contracts — offline field work (field consultant capture).
 *
 * This module DELIMITES the sync responsibility; it does NOT implement the sync
 * engine. Where the contract ends and the engine begins:
 *
 *  - Here: the shape of queued mutations, the dependency order between tables,
 *    the retry/defer semantics, the parent-record vocabulary, and the ports the
 *    engine will need. Everything is a pure value or a pure function.
 *  - In the web application (the only current runner): draining the queue,
 *    uploading photos, writing snapshots, and the network triggers —
 *    `apps/web/src/lib/consultorOffline/**` plus
 *    `apps/web/src/hooks/useSyncEngine.ts`. Those files keep performing the
 *    work; nothing in this module changes their behavior.
 *
 * Contract preservation over redesign: the extracted values mirror what already
 * runs, so the queue in the web application can be described (and later
 * replaced) without re-deciding business rules.
 *
 * [PENDENTE] sync engine in the API: the only implementation lives in the web
 * application; moving or duplicating it requires a product decision about
 * device concurrency and local durability, which does not exist in the repo.
 * [PENDENTE] sync cursor: the repository has no cursor of any kind (the only
 * "cursor" occurrences are local database cursors), and the server exposes no
 * progress marker, so no cursor contract was invented here.
 * [PENDENTE] field/version conflict resolution: today the patch overwrites and
 * the local merge is `{ ...existing.patch, ...params.patch }`
 * (`apps/web/src/lib/consultorOffline/mutationQueue.ts:71`). Resolving by field
 * or version would change behavior and needs its own PRD.
 */

/** Operations a queued mutation can perform (`db.ts:43`, `mutationQueue.ts:52`). */
export type SyncMutationOperation = "update" | "upsert" | "insert" | "delete";

/** `flushing` means the send was interrupted and must be revived (`db.ts:50`). */
export type SyncMutationStatus = "pending" | "flushing" | "error";

/** Mirror of `TextMutation` (`apps/web/src/lib/consultorOffline/db.ts:38-52`). */
export type SyncMutation = {
  id: string;
  visitaId: string;
  table: string;
  rowId: string;
  operation?: SyncMutationOperation;
  onConflict?: string;
  patch: Record<string, unknown>;
  createdAt: string;
  tries: number;
  /** How many rounds the mutation was deferred waiting for the parent record. */
  deferredRounds?: number;
  status: SyncMutationStatus;
  lastError?: string;
};

/**
 * Parent record kinds a child mutation (photo, assessment) depends on
 * (`parentRecovery.ts:26`).
 */
export type SyncParentKind = "pasto" | "curral" | "topico";

/**
 * Server table that holds each parent kind (`parentRecovery.ts:28-32`).
 * Named with the module prefix so the constant cannot be confused with the
 * web-side alias that also maps the same three kinds.
 */
export const PARENT_TABLE_BY_SYNC_PARENT_KIND: Readonly<
  Record<SyncParentKind, string>
> = {
  pasto: "visita_pastos",
  curral: "visita_currais",
  topico: "visita_topicos",
};

/**
 * Outcome of checking whether a missing parent can be used as-is.
 * - `exists`  the parent is already on the server, the child can go up now;
 * - `pending` a creation for the parent is still queued;
 * - `queued`  the parent was rebuilt from the device snapshot;
 * - `missing` nothing can rebuild it, so the child must become a visible error.
 * (`parentRecovery.ts:43`, `:74-81`)
 */
export type SyncParentRecoveryOutcome =
  | "exists"
  | "pending"
  | "queued"
  | "missing";

/** Reference to the parent record a child mutation waits for. */
export type SyncParentReference = {
  kind: SyncParentKind;
  id: string;
};

/**
 * Mirror of `SyncVisitaResult`
 * (`apps/web/src/lib/consultorOffline/snapshotStore.ts:6-12`).
 * Field names are kept exactly as the existing queue persists them.
 */
export type SyncResult = {
  ok: boolean;
  attempts: number;
  reason?: string;
  pendingFotos: number;
  pendingMutations: number;
};

/**
 * Mirror of `FotoQueueItem` reduced to the fields the pure failure rules need
 * (`apps/web/src/lib/consultorOffline/db.ts:7-24`).
 */
export type SyncPhotoStatus = "pending" | "uploading" | "error";

/** Result of a failed photo upload attempt (`photoQueue.ts:237-240`). */
export type SyncPhotoRetryState = {
  tries: number;
  status: "pending" | "error";
};

/**
 * Result of a failed mutation attempt. A dependency error keeps the mutation
 * pending and only spends a deferral round; any other error spends an attempt
 * and makes the mutation a visible error
 * (`apps/web/src/lib/consultorOffline/mutationQueue.ts:265-302`).
 */
export type SyncFailureState = {
  status: SyncMutationStatus;
  tries: number;
  deferredRounds: number;
  lastError?: string;
};

/**
 * Remote sync command row (`sync_commands`), the only server-side sync contract
 * that exists: one command addressed to a user, acknowledged with a timestamp
 * (`migrations/20260419185330_7bfbe4c8-563f-460c-9dce-5367b0985b7b.sql:1-8`).
 */
export type SyncCommand = {
  id: string;
  targetUserId: string;
  senderUserId: string | null;
  command: string;
  createdAt: string;
  acknowledgedAt: string | null;
};

/** Default `sync_commands.command` (`migration:5`). */
export const DEFAULT_SYNC_COMMAND = "sync";

/**
 * Automatic attempts before an item becomes a visible error
 * (`mutationQueue.ts:17`, `photoQueue.ts:49`). The third failure is the last
 * automatic one; recovery afterwards is an explicit user action
 * (`mutationQueue.ts:310-313`).
 */
export const MAX_AUTO_RETRIES = 3;

/**
 * Deferral rounds allowed before the parent is investigated instead of waiting
 * forever (`mutationQueue.ts:156`, `photoQueue.ts:243`).
 */
export const MAX_DEFERRED_ROUNDS = 2;

/**
 * Upper bound of drain rounds in a single pass (`mutationQueue.ts:334`). It is a
 * loop guard, not a business limit.
 */
export const SYNC_DRAIN_MAX_ROUNDS = 200;

/** Backoff base between failed rounds inside one drain (`mutationQueue.ts:350`). */
export const SYNC_DRAIN_BACKOFF_BASE_MS = 650;

/** Base of the retry delay curve (`network.ts:55-57`). */
export const SYNC_RETRY_DELAY_BASE_MS = 700;

/** Ceiling of the retry delay curve (`network.ts:55-57`). */
export const SYNC_RETRY_DELAY_CAP_MS = 4_000;

/** Regular request timeout (`network.ts:1`). */
export const SYNC_NETWORK_TIMEOUT_MS = 30_000;

/** Photo upload timeout: field connectivity needs more room (`network.ts:3`). */
export const SYNC_PHOTO_UPLOAD_TIMEOUT_MS = 90_000;

/** Photo confirmation timeout (`network.ts:4`). */
export const SYNC_PHOTO_CONFIRM_TIMEOUT_MS = 60_000;

/** Attempts in a single visita synchronization (`network.ts:5`). */
export const SYNC_ATTEMPTS = 3;

/**
 * Conflict target used when the mutation does not carry one
 * (`mutationQueue.ts:181`, `:218`). Keeping the default explicit in the contract
 * is what makes a replayed upsert idempotent.
 */
export const SYNC_UPSERT_DEFAULT_CONFLICT_TARGET = "id";

/** Highest local lot code, mirroring the 3-digit sequence (`maisArrobasQueue.ts:399-406`). */
export const MAX_LOCAL_LOT_CODE = 999;

/** Width of a local lot code (`maisArrobasQueue.ts:402`). */
export const LOCAL_LOT_CODE_WIDTH = 3;

/**
 * Minimum tombstone-retention rule before a canonical server-side checkpoint
 * exists. A tombstone cannot be purged unless a trustworthy checkpoint exists
 * and every known offline client has advanced beyond it. Without that evidence,
 * retention is unbounded by time: automatic purge is forbidden.
 */
export type TombstoneRetentionEvidence = {
  hasCanonicalCheckpoint: boolean;
  allKnownClientsAdvanced: boolean;
};

export type TombstonePurgeDecision =
  | { allowed: true }
  | { allowed: false; reason: "checkpoint-unavailable" | "clients-not-advanced" };

export function evaluateTombstonePurge(
  evidence: TombstoneRetentionEvidence,
): TombstonePurgeDecision {
  if (!evidence.hasCanonicalCheckpoint) {
    return { allowed: false, reason: "checkpoint-unavailable" };
  }
  if (!evidence.allKnownClientsAdvanced) {
    return { allowed: false, reason: "clients-not-advanced" };
  }
  return { allowed: true };
}
