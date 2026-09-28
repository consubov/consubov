import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getScreenCache, setScreenCache, screenCacheKey, useResumeRefresh, useScreenCacheInvalidation } from "@/lib/screenCache";

export interface AbatesResumo {
  abatidosMes: number;
  abatidosAno: number;
}

export function useAbatesData(fazendaId: string | undefined, mes: number, ano: number, retiroId?: string) {
  const cacheKey = screenCacheKey("abates", [fazendaId, retiroId, mes, ano]);
  const [data, setData] = useState<AbatesResumo>(() => getScreenCache<AbatesResumo>(cacheKey) ?? { abatidosMes: 0, abatidosAno: 0 });
  const [loading, setLoading] = useState(() => !getScreenCache(cacheKey));

  const load = useCallback(async () => {
    if (!fazendaId) { setLoading(false); return; }
    try {
      let mesQuery = supabase.from("abates" as any).select("quantidade").eq("fazenda_id", fazendaId).eq("mes", mes).eq("ano", ano);
      let anoQuery = supabase.from("abates" as any).select("quantidade").eq("fazenda_id", fazendaId).eq("ano", ano);
      if (retiroId) {
        mesQuery = mesQuery.eq("retiro_id", retiroId);
        anoQuery = anoQuery.eq("retiro_id", retiroId);
      }
      const [mesRes, anoRes] = await Promise.all([mesQuery, anoQuery]);
      const abatidosMes = ((mesRes.data as any[]) ?? []).reduce((s: number, r: any) => s + (r.quantidade || 0), 0);
      const abatidosAno = ((anoRes.data as any[]) ?? []).reduce((s: number, r: any) => s + (r.quantidade || 0), 0);
      const next = { abatidosMes, abatidosAno };
      setScreenCache(cacheKey, next);
      setData(next);
    } catch (e) {
      console.error("useAbatesData error:", e);
    } finally {
      setLoading(false);
    }
  }, [fazendaId, mes, ano, retiroId, cacheKey]);

  useEffect(() => {
    const cached = getScreenCache<AbatesResumo>(cacheKey);
    if (cached) { setData(cached); setLoading(false); }
    void load();
  }, [load, cacheKey]);

  useResumeRefresh(() => { void load(); }, !!fazendaId);
  useScreenCacheInvalidation(() => { void load(); });

  // Realtime
  useEffect(() => {
    if (!fazendaId) return;
    const ch = supabase.channel(`abates-${fazendaId}-${retiroId || "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "abates" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fazendaId, retiroId, load]);

  return { ...data, loading, refresh: load };
}
