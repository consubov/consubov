import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useMortalidadesData(
  fazendaId: string | undefined,
  ano: number,
  retiroId?: string,
) {
  const [mortalidadesAno, setMortalidadesAno] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!fazendaId) { setLoading(false); return; }
    try {
      let query = supabase
        .from("mortalidades" as any)
        .select("quantidade")
        .eq("fazenda_id", fazendaId)
        .eq("ano", ano);

      if (retiroId) query = query.eq("retiro_id", retiroId);

      const { data } = await query;
      const total = ((data as any[]) ?? []).reduce((s: number, r: any) => s + (r.quantidade || 0), 0);
      setMortalidadesAno(total);
    } catch (e) {
      console.error("useMortalidadesData error:", e);
    } finally {
      setLoading(false);
    }
  }, [fazendaId, ano, retiroId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!fazendaId) return;

    const handleFocus = () => { void load(); };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void load();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fazendaId, load]);

  useEffect(() => {
    if (!fazendaId) return;
    const ch = supabase.channel(`mortalidades-${fazendaId}-${retiroId || "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mortalidades" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fazendaId, retiroId, load]);

  return { mortalidadesAno, loading, refresh: load };
}
