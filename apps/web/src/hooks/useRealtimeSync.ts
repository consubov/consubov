import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type TableName = "pastos" | "lancamentos" | "movimentacoes_animais" | "abates" | "mortalidades" | "ciclos" | "retiros";

/**
 * Subscribes to Supabase Realtime changes on the given tables.
 * Calls `onChange` whenever any INSERT/UPDATE/DELETE happens.
 * 
 * Usage:
 *   useRealtimeSync(["pastos", "lancamentos"], refresh);
 */
export function useRealtimeSync(tables: TableName[], onChange: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (tables.length === 0) return;

    const channel = supabase
      .channel(`realtime-sync-${tables.join("-")}`)

    for (const table of tables) {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        () => {
          onChangeRef.current();
        }
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tables.join(",")]); // stable string dep
}
