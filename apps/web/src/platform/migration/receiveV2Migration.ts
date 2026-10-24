import {
  NEW_APP_ORIGIN,
  TRANSFERABLE_DATABASES,
  type TransferableDatabase,
} from "./oneTouchMigrationFlow";

/**
 * A URL fragment is never sent to the target server as an HTTP request.
 * Clear it immediately; the backend must redeem the code only after login.
 */
export function consumeMigrationFragment(
  currentHref: string,
  clearFragment: () => void,
): string | null {
  const hash = new URL(currentHref).hash;
  if (!hash.startsWith("#migration=")) return null;
  clearFragment();
  const match = /^#migration=([A-Za-z0-9_-]{20,160})$/.exec(hash);
  return match ? match[1] : null;
}

export interface DestinationIdentity {
  tenantId: string;
  userId: string;
}

export interface RedeemedMigration {
  migrationId: string;
  sourceSnapshotId: string;
  tenantId: string;
  userId: string;
  expectedDatabases: TransferableDatabase[];
  expiresAt: string;
}

export interface HydrationProof {
  migrationId: string;
  sourceSnapshotId: string;
  tenantId: string;
  userId: string;
  restoredDatabases: TransferableDatabase[];
  unconfirmedItems: number;
  durableLocalCache: boolean;
}

export interface DestinationMigrationPort {
  /** Real backend-authenticated identity, never a value from the fragment. */
  currentIdentity(): Promise<DestinationIdentity | null>;
  /** Backend verifies scope, one-time nonce, TTL and user permission. */
  redeemOneTimeReference(code: string): Promise<RedeemedMigration>;
  /** Fetch permitted records/files through authenticated API, hydrate IDB. */
  hydrateAuthorizedData(receipt: RedeemedMigration): Promise<HydrationProof>;
  /** Mark complete only after durable local cache and server reconciliation. */
  confirmDestinationReady(proof: HydrationProof): Promise<void>;
}

export type DestinationResult =
  | { ok: true; migrationId: string }
  | { ok: false; code: string };

function covered(value: readonly string[], expected: readonly string[]): boolean {
  return value.length === expected.length &&
    new Set(value).size === value.length &&
    expected.every((entry) => value.includes(entry));
}

function sameScope(a: { tenantId: string; userId: string }, b: DestinationIdentity): boolean {
  return a.tenantId === b.tenantId && a.userId === b.userId;
}

export async function receiveV2Migration(
  input: {
    origin: string;
    code: string | null;
    now?: () => Date;
  },
  port: DestinationMigrationPort,
): Promise<DestinationResult> {
  if (input.origin !== NEW_APP_ORIGIN) return { ok: false, code: "WRONG_DESTINATION" };
  if (!input.code || !/^[A-Za-z0-9_-]{20,160}$/.test(input.code)) {
    return { ok: false, code: "NO_HANDOFF" };
  }
  try {
    const identity = await port.currentIdentity();
    if (!identity?.tenantId?.trim() || !identity.userId?.trim()) {
      // The UI can wait for a standard login before calling again.
      return { ok: false, code: "LOGIN_REQUIRED" };
    }
    const receipt = await port.redeemOneTimeReference(input.code);
    const expiry = Date.parse(receipt.expiresAt);
    if (
      !receipt.migrationId || !receipt.sourceSnapshotId ||
      !sameScope(receipt, identity) ||
      !covered(receipt.expectedDatabases, TRANSFERABLE_DATABASES) ||
      !Number.isFinite(expiry) ||
      expiry <= (input.now?.() ?? new Date()).getTime()
    ) return { ok: false, code: "HANDOFF_UNVERIFIED" };

    const proof = await port.hydrateAuthorizedData(receipt);
    if (
      proof.migrationId !== receipt.migrationId ||
      proof.sourceSnapshotId !== receipt.sourceSnapshotId ||
      !sameScope(proof, identity) ||
      !covered(proof.restoredDatabases, TRANSFERABLE_DATABASES) ||
      !proof.durableLocalCache ||
      proof.unconfirmedItems !== 0
    ) return { ok: false, code: "HYDRATION_INCOMPLETE" };

    await port.confirmDestinationReady(proof);
    // No deletion of old origin. The source stays usable for rollback.
    return { ok: true, migrationId: receipt.migrationId };
  } catch {
    return { ok: false, code: "DESTINATION_INTERRUPTED" };
  }
}
