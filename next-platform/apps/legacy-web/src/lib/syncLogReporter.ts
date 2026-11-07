/**
 * Reports the device's current sync state to the public.sync_log table so
 * Admins/Gerentes can see — from the dashboard — exactly how many records
 * are pending on each capataz device, when the last successful sync was,
 * and how much storage the device is using.
 *
 * Best-effort: if offline or RLS denies the row, we silently swallow the
 * error so reporting never blocks actual syncing.
 */

import { supabase } from "@/integrations/supabase/client";
import { getTotalPendingCount } from "@/lib/offlineDb";
import { getStorageState } from "@/lib/storageProtection";

export interface SyncLogReport {
  pendingCount: number;
  lastAttempt?: string | null;
  lastSuccess?: string | null;
}

function getDeviceInfo() {
  if (typeof navigator === "undefined") return null;
  return {
    userAgent: navigator.userAgent,
    platform: (navigator as any).platform ?? null,
    language: navigator.language,
    online: navigator.onLine,
  };
}

export async function reportSyncLog(userId: string, report: SyncLogReport) {
  if (!userId) return;
  try {
    const storage = await getStorageState();
    const pendingCount = report.pendingCount ?? (await getTotalPendingCount());

    const payload = {
      user_id: userId,
      record_count_pending: pendingCount,
      last_attempt: report.lastAttempt ?? new Date().toISOString(),
      last_success: report.lastSuccess ?? null,
      storage_estimate_bytes: storage.usageBytes ?? null,
      storage_quota_bytes: storage.quotaBytes ?? null,
      device_info: getDeviceInfo(),
      updated_at: new Date().toISOString(),
    };

    // Upsert by user_id (column is UNIQUE)
    const { error } = await supabase
      .from("sync_log")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      console.warn("[syncLogReporter] upsert failed:", error.message);
    }
  } catch (err) {
    console.warn("[syncLogReporter] failed:", err);
  }
}
