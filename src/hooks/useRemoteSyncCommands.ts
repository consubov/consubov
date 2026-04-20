import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const POLL_INTERVAL_MS = 60_000;
const POLL_LOOKBACK_MS = 10 * 60_000; // 10 minutes

/**
 * Subscribes to Supabase Realtime sync_commands targeted at the current user.
 * Also polls every 60s as a fallback when WebSocket is unavailable.
 * On any new unacknowledged command: runs onCommand() then acknowledges the row.
 */
export function useRemoteSyncCommands(
  userId: string | undefined,
  onCommand: () => void | Promise<void>,
  enabled = true,
) {
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;
  const handlingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !userId) return;

    const handleCommand = async (rowId: string) => {
      if (handlingRef.current) return;
      handlingRef.current = true;
      try {
        toast.info("Sinal de sincronização recebido");
        await onCommandRef.current();
        const { error: ackErr } = await supabase
          .from("sync_commands")
          .update({ acknowledged_at: new Date().toISOString() })
          .eq("id", rowId);
        if (ackErr) console.warn("[useRemoteSyncCommands] ack failed:", ackErr);
        else console.log("[useRemoteSyncCommands] acknowledged:", rowId);
      } catch (err) {
        console.error("[useRemoteSyncCommands] error handling command:", err);
      } finally {
        handlingRef.current = false;
      }
    };

    // 1) Realtime subscription
    const channel = supabase
      .channel(`sync-cmd-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sync_commands",
          filter: `target_user_id=eq.${userId}`,
        },
        async (payload) => {
          const row = payload.new as { id: string };
          console.log("[useRemoteSyncCommands] realtime sync command received:", row.id);
          await handleCommand(row.id);
        },
      )
      .subscribe((status) => {
        console.log("[useRemoteSyncCommands] realtime channel status:", status);
      });

    // 2) Polling fallback — every 60s, when online, query unacknowledged commands
    const pollUnacknowledged = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      try {
        const sinceIso = new Date(Date.now() - POLL_LOOKBACK_MS).toISOString();
        const { data, error } = await supabase
          .from("sync_commands")
          .select("id, created_at")
          .eq("target_user_id", userId)
          .is("acknowledged_at", null)
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: true });
        if (error) {
          console.warn("[useRemoteSyncCommands] poll error:", error);
          return;
        }
        if (data && data.length > 0) {
          console.log(`[useRemoteSyncCommands] poll found ${data.length} pending command(s)`);
          // Run sync once and acknowledge all pending rows
          await handleCommand(data[0].id);
          if (data.length > 1) {
            const remainingIds = data.slice(1).map((r) => r.id);
            await supabase
              .from("sync_commands")
              .update({ acknowledged_at: new Date().toISOString() })
              .in("id", remainingIds);
          }
        }
      } catch (err) {
        console.error("[useRemoteSyncCommands] poll exception:", err);
      }
    };

    // Run once immediately to catch any pending commands missed while offline
    void pollUnacknowledged();
    const pollId = window.setInterval(() => void pollUnacknowledged(), POLL_INTERVAL_MS);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(pollId);
    };
  }, [enabled, userId]);
}
