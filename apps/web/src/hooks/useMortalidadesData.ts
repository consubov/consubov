import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getScreenCache, setScreenCache, screenCacheKey, useResumeRefresh, useScreenCacheInvalidation } from "@/lib/screenCache";

export function useMortalidadesData(
  fazendaId: string | undefined,
  ano: number,
  retiroId?: string,
) {
  const cacheKey = screenCacheKey("mortalidades", [fazendaId, retiroId, ano]);
  const [mortalidadesAno, setMortalidadesAno] = useState(() => getScreenCache<number>(cacheKey) ?? 0);
  const [loading, setLoading] = useState(() => getScreenCache(cacheKey) === undefined);

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
      setScreenCache(cacheKey, total);
      setMortalidadesAno(total);
    } catch (e) {
      console.error("useMortalidadesData error:", e);
    } finally {
      setLoading(false);
    }
  }, [fazendaId, ano, retiroId, cacheKey]);

  useEffect(() => {
    const cached = getScreenCache<number>(cacheKey);
    if (cached !== undefined) { setMortalidadesAno(cached); setLoading(false); }
    void load();
  }, [load, cacheKey]);

  useResumeRefresh(() => { void load(); }, !!fazendaId);
  useScreenCacheInvalidation(() => { void load(); });

  useEffect(() => {
    if (!fazendaId) return;
    const ch = supabase.channel(`mortalidades-${fazendaId}-${retiroId || "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mortalidades" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fazendaId, retiroId, load]);

  return { mortalidadesAno, loading, refresh: load };
}
