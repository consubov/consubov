/**
 * Storage protection utilities — request persistent storage, monitor usage,
 * and warn the capataz when quota is tight. iOS Safari and Chrome can evict
 * IndexedDB under storage pressure unless persistence has been granted.
 */

export interface StorageState {
  persisted: boolean | null;            // null = unknown (unsupported)
  usageBytes: number | null;
  quotaBytes: number | null;
  usagePercent: number | null;
  /** True when usage > 70% of quota — show warning banner */
  warning: boolean;
}

export const STORAGE_WARNING_THRESHOLD = 0.7;

/**
 * Request persistent storage from the browser. Should be called once after
 * login (best-effort — silently no-ops on unsupported browsers).
 */
export async function requestPersistentStorage(): Promise<boolean | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return null;
  }
  try {
    const already = await navigator.storage.persisted?.();
    if (already) return true;
    return await navigator.storage.persist();
  } catch (err) {
    console.warn("[storageProtection] persist() failed:", err);
    return null;
  }
}

/** Read current storage usage and quota. */
export async function getStorageState(): Promise<StorageState> {
  const empty: StorageState = {
    persisted: null,
    usageBytes: null,
    quotaBytes: null,
    usagePercent: null,
    warning: false,
  };
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return empty;
  }
  try {
    const estimate = await navigator.storage.estimate();
    const persisted = await navigator.storage.persisted?.().catch(() => null);
    const usageBytes = estimate.usage ?? 0;
    const quotaBytes = estimate.quota ?? 0;
    const usagePercent = quotaBytes > 0 ? usageBytes / quotaBytes : null;
    return {
      persisted: persisted ?? null,
      usageBytes,
      quotaBytes,
      usagePercent,
      warning: usagePercent !== null && usagePercent > STORAGE_WARNING_THRESHOLD,
    };
  } catch (err) {
    console.warn("[storageProtection] estimate() failed:", err);
    return empty;
  }
}

export function formatBytes(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
