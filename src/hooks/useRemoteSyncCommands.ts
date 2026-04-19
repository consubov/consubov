import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Subscribes to Supabase Realtime sync_commands targeted at the current user.
 * When a new command arrives, calls onCommand() (typically triggerSync) and
 * acknowledges the row.
 */
export function useRemoteSyncCommands(
  userId: string | undefined,
  onCommand: () => void | Promise<void>,
) {
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`sync-commands-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sync_commands",
          filter: `target_user_id=eq.${userId}`,
        },
        async (payload) => {
          const row = payload.new as { id: string; command: string };
          try {
            toast.info("Sinal de sincronização recebido");
            await onCommandRef.current();
            await supabase
              .from("sync_commands")
              .update({ acknowledged_at: new Date().toISOString() })
              .eq("id", row.id);
          } catch (err) {
            console.error("[useRemoteSyncCommands] error handling command:", err);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
