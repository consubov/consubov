import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTotalPendingCount } from "@/lib/offlineDb";
import { reportSyncLog } from "@/lib/syncLogReporter";
import { backupPendingToLocalStorage, type PendingBackup } from "@/lib/backupMirror";
import { toast } from "sonner";

export type SyncStatus = "idle" | "syncing" | "success" | "error" | "auth-required";

export interface SyncEngineState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncedAt: string | null;
  retryAttempt: number;
  errorMessage: string | null;
}

const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 5 * 60_000];
const MAX_RETRY_ATTEMPTS = 10;

interface UseSyncEngineOptions {
  /** The actual sync routine. Should THROW on failure. */
  runSync: () => Promise<void>;
  /** Whether sync should be active (e.g. user logged in). */
  enabled: boolean;
  /** Optional callback fired only after a successful sync. Receives the previous lastSyncedAt (ISO) so caller can compute "since last sync" range. */
  onSyncSuccess?: (previousLastSyncedAt: string | null) => void | Promise<void>;
  /** Current user id — used to write a sync_log row visible to Admin/Gerente. */
  userId?: string | null;
  /** Optional info attached to localStorage backup mirror for emergency export. */
  backupUserInfo?: PendingBackup["userInfo"];
}

/**
 * Drives offline → Supabase sync with:
 *  - Auto-trigger on online / visibilitychange / mount
 *  - Auth-token refresh before each attempt
 *  - Exponential backoff (5s → 15s → 30s → 60s)
 *  - Visible status (idle / syncing / success / error / auth-required)
 *  - Pending-count polling
 */
export function useSyncEngine({ runSync, enabled, onSyncSuccess, userId, backupUserInfo }: UseSyncEngineOptions) {
  const [state, setState] = useState<SyncEngineState>({
    status: "idle",
    pendingCount: 0,
    lastSyncedAt: null,
    retryAttempt: 0,
    errorMessage: null,
  });

  const runningRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);
  const runSyncRef = useRef(runSync);
  runSyncRef.current = runSync;
  const onSyncSuccessRef = useRef(onSyncSuccess);
  onSyncSuccessRef.current = onSyncSuccess;
  const lastSyncedAtRef = useRef<string | null>(null);

  const refreshPendingCount = useCallback(async () => {
    const count = await getTotalPendingCount();
    setState((s) => ({ ...s, pendingCount: count }));
    return count;
  }, []);

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const triggerSync = useCallback(
    async (opts: { manual?: boolean } = {}) => {
      if (!enabled) return;
      if (runningRef.current) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await refreshPendingCount();
        return;
      }

      const pending = await refreshPendingCount();
      if (pending === 0) {
        if (opts.manual) toast.info("Nenhum dado pendente para sincronizar");
        return;
      }

      runningRef.current = true;
      clearRetry();
      setState((s) => ({ ...s, status: "syncing", errorMessage: null }));

      try {
        // 1. Refresh Supabase auth before sync (token may be expired after offline)
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) {
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              // Try once more with current session; if calls fail with 401 we'll bail
              console.warn("[sync] refreshSession warning:", refreshError);
            }
          } else {
            setState((s) => ({
              ...s,
              status: "auth-required",
              errorMessage: "Faça login novamente para sincronizar",
            }));
            toast.error("Faça login novamente para sincronizar");
            runningRef.current = false;
            return;
          }
        } catch (authErr) {
          console.warn("[sync] auth check failed:", authErr);
        }

        // 2. Backup current pending records to localStorage mirror BEFORE
        //    we touch the network — guarantees a redundant copy even if the
        //    sync crashes mid-flight.
        try { await backupPendingToLocalStorage(backupUserInfo); } catch { /* ignore */ }

        // 3. Run the actual sync
        const previousLastSyncedAt = lastSyncedAtRef.current;
        await runSyncRef.current();

        // 4. Success
        const newSyncedAt = new Date().toISOString();
        lastSyncedAtRef.current = newSyncedAt;
        const remaining = await getTotalPendingCount();
        setState((s) => ({
          ...s,
          status: "success",
          retryAttempt: 0,
          errorMessage: null,
          lastSyncedAt: newSyncedAt,
          pendingCount: remaining,
        }));

        // 5. Refresh local backup mirror with the (now smaller) pending set
        try { await backupPendingToLocalStorage(backupUserInfo); } catch { /* ignore */ }

        // 6. Report sync_log so Admin/Gerente sees the device state
        if (userId) {
          void reportSyncLog(userId, {
            pendingCount: remaining,
            lastAttempt: newSyncedAt,
            lastSuccess: newSyncedAt,
          });
        }

        // 7. Post-success hook (e.g. auto-generate PDF)
        if (onSyncSuccessRef.current) {
          try {
            await onSyncSuccessRef.current(previousLastSyncedAt);
          } catch (hookErr) {
            console.warn("[sync] onSyncSuccess hook failed:", hookErr);
          }
        }
      } catch (err: any) {
        const msg = err?.message || err?.details || "Erro desconhecido";
        const isAuthErr = /401|jwt|token|unauthor/i.test(msg);

        setState((s) => {
          const nextAttempt = Math.min(s.retryAttempt + 1, MAX_RETRY_ATTEMPTS);
          return {
            ...s,
            status: isAuthErr ? "auth-required" : "error",
            errorMessage: msg,
            retryAttempt: nextAttempt,
          };
        });

        // Report failure to sync_log too — Admin needs visibility on stuck devices
        if (userId) {
          void reportSyncLog(userId, {
            pendingCount: await getTotalPendingCount(),
            lastAttempt: new Date().toISOString(),
            lastSuccess: lastSyncedAtRef.current,
          });
        }

        if (isAuthErr) {
          toast.error("Faça login novamente para sincronizar");
        } else if (state.retryAttempt < MAX_RETRY_ATTEMPTS) {
          // Schedule backoff retry — capped at MAX_RETRY_ATTEMPTS so we
          // don't spin forever; capataz can re-trigger manually after that.
          const attempt = Math.min(state.retryAttempt, RETRY_DELAYS_MS.length - 1);
          const delay = RETRY_DELAYS_MS[attempt];
          clearRetry();
          retryTimerRef.current = window.setTimeout(() => {
            void triggerSync();
          }, delay);
        }
      } finally {
        runningRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, refreshPendingCount, clearRetry, userId, backupUserInfo]
  );

  // Auto-triggers
  useEffect(() => {
    if (!enabled) return;

    const onOnline = () => {
      void triggerSync();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void triggerSync();
      }
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);

    // On mount: if online and pending records exist, sync
    void (async () => {
      await refreshPendingCount();
      if (typeof navigator !== "undefined" && navigator.onLine) {
        void triggerSync();
      }
    })();

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      clearRetry();
    };
  }, [enabled, triggerSync, refreshPendingCount, clearRetry]);

  // Poll pending count occasionally so badge stays fresh after local writes
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      void refreshPendingCount();
    }, 10_000);
    return () => window.clearInterval(id);
  }, [enabled, refreshPendingCount]);

  return {
    ...state,
    triggerSync: (manual = true) => triggerSync({ manual }),
    refreshPendingCount,
  };
}
