import { consumeMigrationFragment } from "./receiveV2Migration";
import { NEW_APP_ORIGIN } from "./oneTouchMigrationFlow";

const KEY = "consubov:v2-pending-handoff";
const MAX_AGE_MS = 10 * 60 * 1000;
const CODE_RE = /^[A-Za-z0-9_-]{20,160}$/;

interface StoredHandoff {
  code: string;
  createdAt: number;
}

export function isV2MigrationReceiverEnabled(
  origin: string,
  flag: string | undefined,
  isRelatto = false,
): boolean {
  return origin === NEW_APP_ORIGIN && flag === "true" && !isRelatto;
}

/**
 * Capture URL fragment before /baixar navigates to /login. The fragment is
 * removed immediately. Session storage is limited to this origin/tab and TTL.
 * The iOS installed PWA can recover through migration/pending after login,
 * even if this tab's session storage was not carried over.
 */
export function captureMigrationArrival(
  href: string,
  clearUrlFragment: () => void,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  now = Date.now(),
): string | null {
  const code = consumeMigrationFragment(href, clearUrlFragment);
  if (!code) return readPendingMigrationCode(storage, now);
  try {
    storage.setItem(KEY, JSON.stringify({ code, createdAt: now } satisfies StoredHandoff));
  } catch {
    // Safari private mode can block storage; code still works in memory.
  }
  return code;
}

export function readPendingMigrationCode(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  now = Date.now(),
): string | null {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as Partial<StoredHandoff>;
    if (
      typeof payload.code !== "string" ||
      !CODE_RE.test(payload.code) ||
      typeof payload.createdAt !== "number" ||
      !Number.isFinite(payload.createdAt) ||
      payload.createdAt > now ||
      now - payload.createdAt > MAX_AGE_MS
    ) {
      storage.removeItem(KEY);
      return null;
    }
    return payload.code;
  } catch {
    try { storage.removeItem(KEY); } catch { /* ignore */ }
    return null;
  }
}

export function clearPendingMigrationCode(storage: Pick<Storage, "removeItem">): void {
  try { storage.removeItem(KEY); } catch { /* ignore */ }
}
