/**
 * Ports of the sync module. They exist so the eventual engine can be written
 * against a boundary; no implementation ships with this module (the running
 * implementation is still the web queue described in ./contracts.ts).
 *
 * The engine receives the current instant as an explicit argument instead of
 * reading any ambient clock, which is why no clock appears in these ports.
 */
import type {
  SyncMutation,
  SyncParentKind,
} from "./contracts";
import type { TenantExecutionContext } from "../../identity-tenancy";

/** Read side of the durable local queue. */
export interface SyncQueueReader {
  listMutations(context: TenantExecutionContext): Promise<readonly SyncMutation[]>;
  countPendingMutations(context: TenantExecutionContext): Promise<number>;
}

/** Write side of the durable local queue. */
export interface SyncQueueWriter {
  putMutation(mutation: SyncMutation, context: TenantExecutionContext): Promise<void>;
  deleteMutation(mutationId: string, context: TenantExecutionContext): Promise<void>;
}

/** Raw outcome of a parent lookup, before it is classified by `resolveParentLookup`. */
export type SyncParentLookupResult = {
  data?: { id?: string } | null;
  error?: unknown;
};

/**
 * A rejection is classified by the domain: `dependency` defers the mutation,
 * anything else spends an attempt
 * (`apps/web/src/lib/consultorOffline/mutationQueue.ts:263-302`).
 */
export type SyncTransportFailure = {
  kind: "dependency" | "rejected";
  message: string;
};

/**
 * Send result. `confirmed` mirrors the exact-count contract: an update/insert
 * whose count is zero is not confirmation, while a delete whose count is zero
 * is confirmation because the row is already gone
 * (`mutationQueue.ts:185`, `:200-202`, `:211`).
 */
export type SyncSendResult =
  | { ok: true; confirmed: boolean }
  | { ok: false; error: SyncTransportFailure };

/** Boundary to the remote side of a synchronization. */
export interface SyncTransport {
  sendMutation(
    mutation: SyncMutation,
    onConflict: string,
    context: TenantExecutionContext,
  ): Promise<SyncSendResult>;
  lookupParent(
    kind: SyncParentKind,
    parentId: string,
    context: TenantExecutionContext,
  ): Promise<SyncParentLookupResult>;
}
