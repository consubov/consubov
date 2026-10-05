/**
 * Cross-domain safety contract for writes whose result depends on concurrent state.
 *
 * This does not implement persistence. It records the minimum behavior that every
 * future server-side adapter must enforce before FASE 8 connects real persistence.
 * Product-specific conflict resolution remains explicit per aggregate.
 */
export type CriticalWriteAggregate =
  | "inventory_stock"
  | "livestock_transfer"
  | "feed_mill_batch"
  | "weighing";

export type CriticalWritePolicy = {
  readonly requiresIdempotencyKey: true;
  readonly requiresKnownVersion: true;
  readonly requiresAtomicAuthority: true;
  readonly conflictStrategy: "detect-and-reject";
  readonly realtimeIsAuthoritative: false;
  readonly genericLastWriteWins: false;
};

export const CRITICAL_WRITE_POLICIES: Readonly<Record<CriticalWriteAggregate, CriticalWritePolicy>> = {
  inventory_stock: {
    requiresIdempotencyKey: true,
    requiresKnownVersion: true,
    requiresAtomicAuthority: true,
    conflictStrategy: "detect-and-reject",
    realtimeIsAuthoritative: false,
    genericLastWriteWins: false,
  },
  livestock_transfer: {
    requiresIdempotencyKey: true,
    requiresKnownVersion: true,
    requiresAtomicAuthority: true,
    conflictStrategy: "detect-and-reject",
    realtimeIsAuthoritative: false,
    genericLastWriteWins: false,
  },
  feed_mill_batch: {
    requiresIdempotencyKey: true,
    requiresKnownVersion: true,
    requiresAtomicAuthority: true,
    conflictStrategy: "detect-and-reject",
    realtimeIsAuthoritative: false,
    genericLastWriteWins: false,
  },
  weighing: {
    requiresIdempotencyKey: true,
    requiresKnownVersion: true,
    requiresAtomicAuthority: true,
    conflictStrategy: "detect-and-reject",
    realtimeIsAuthoritative: false,
    genericLastWriteWins: false,
  },
};
