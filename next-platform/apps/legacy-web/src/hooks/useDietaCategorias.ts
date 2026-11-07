import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const DIETA_CATEGORIAS_FIXAS = ["Adaptação", "Terminação"] as const;

export interface DietaCategoria {
  id: string;
  nome: string;
}

const cacheKey = (consultorId: string) => `relatto:dieta_categorias:${consultorId}`;

function readCache(consultorId: string): DietaCategoria[] {
  try {
    const raw = window.localStorage.getItem(cacheKey(consultorId));
    return raw ? (JSON.parse(raw) as DietaCategoria[]) : [];
  } catch {
    return [];
  }
}

function writeCache(consultorId: string, rows: DietaCategoria[]) {
  try {
    window.localStorage.setItem(cacheKey(consultorId), JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

/** Categorias custom de dieta do consultor (com cache local para uso off-line). */
export function useDietaCategorias(consultorId?: string | null) {
  const [categorias, setCategorias] = useState<DietaCategoria[]>(() =>
    consultorId ? readCache(consultorId) : [],
  );
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!consultorId) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setCategorias(readCache(consultorId));
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("dieta_categorias")
      .select("id, nome")
      .eq("consultor_id", consultorId)
      .order("nome");
    setLoading(false);
    if (error) {
      setCategorias(readCache(consultorId));
      return;
    }
    const rows = (data || []) as DietaCategoria[];
    setCategorias(rows);
    writeCache(consultorId, rows);
  }, [consultorId]);

  useEffect(() => {
    if (!consultorId) return;
    setCategorias(readCache(consultorId));
    void refresh();
  }, [consultorId, refresh]);

  const criar = useCallback(
    async (nome: string): Promise<DietaCategoria | null> => {
      const limpo = nome.trim();
      if (!consultorId || !limpo) return null;
      const existente = categorias.find(c => c.nome.toLowerCase() === limpo.toLowerCase());
      if (existente) return existente;
      const { data, error } = await supabase
        .from("dieta_categorias")
        .insert({ consultor_id: consultorId, nome: limpo })
        .select("id, nome")
        .single();
      if (error || !data) return null;
      const next = [...categorias, data as DietaCategoria].sort((a, b) => a.nome.localeCompare(b.nome));
      setCategorias(next);
      writeCache(consultorId, next);
      return data as DietaCategoria;
    },
    [categorias, consultorId],
  );

  const renomear = useCallback(
    async (id: string, nome: string) => {
      const limpo = nome.trim();
      if (!consultorId || !limpo) return false;
      const { error } = await supabase.from("dieta_categorias").update({ nome: limpo }).eq("id", id);
      if (error) return false;
      const next = categorias
        .map(c => (c.id === id ? { ...c, nome: limpo } : c))
        .sort((a, b) => a.nome.localeCompare(b.nome));
      setCategorias(next);
      writeCache(consultorId, next);
      return true;
    },
    [categorias, consultorId],
  );

  const excluir = useCallback(
    async (id: string) => {
      if (!consultorId) return false;
      const { error } = await supabase.from("dieta_categorias").delete().eq("id", id);
      if (error) return false;
      const next = categorias.filter(c => c.id !== id);
      setCategorias(next);
      writeCache(consultorId, next);
      return true;
    },
    [categorias, consultorId],
  );

  return { categorias, loading, refresh, criar, renomear, excluir };
}
