import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PastoRetiroItem {
  id: string;
  nome: string;
  num_animais: number;
  peso_medio_kg: number | null;
  gmd_kg_dia: number | null;
  /** Fonte única (mesma do Mapa): view_painel_mae_pasto_atual */
  consumo_global_g_cab_dia: number | null;
  indice_global: number | null;
  status_global: string | null;
  num_sacos: number;
}

/**
 * Lista de Pastos — fonte única compartilhada pelos perfis admin, gerente e capataz.
 *
 * Depende apenas do `retiroId` (nunca do `fazendaId`), para que o carregamento
 * funcione igual em todas as rotas. Consumo e status vêm de
 * `view_painel_mae_pasto_atual` (consumo_global_g_cab_dia / status_global),
 * exatamente como o Mapa do Retiro.
 */
export function usePastosRetiro(retiroId: string | null | undefined, mes: number, ano: number) {
  const [pastos, setPastos] = useState<PastoRetiroItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!retiroId) {
      setPastos([]);
      return;
    }
    setLoading(true);
    try {
      const [pastosRes, atualRes, mesRes] = await Promise.all([
        supabase
          .from("pastos")
          .select("id, nome, num_animais, peso_medio_kg, gmd_kg_dia")
          .eq("retiro_id", retiroId)
          .eq("ativo", true)
          .order("nome"),
        (supabase as any)
          .from("view_painel_mae_pasto_atual")
          .select("pasto_id, consumo_global_g_cab_dia, indice_global, status_global, num_animais, peso_medio_kg")
          .eq("retiro_id", retiroId),
        (supabase as any)
          .from("view_painel_mae_pasto")
          .select("pasto_id, num_sacos")
          .eq("retiro_id", retiroId)
          .eq("mes_referencia", mes)
          .eq("ano_referencia", ano),
      ]);

      const atualMap = new Map<string, any>();
      for (const row of (atualRes.data ?? [])) {
        if (!atualMap.has(row.pasto_id)) atualMap.set(row.pasto_id, row);
      }
      const sacosMap = new Map<string, number>();
      for (const row of (mesRes.data ?? [])) {
        sacosMap.set(row.pasto_id, (sacosMap.get(row.pasto_id) ?? 0) + (Number(row.num_sacos) || 0));
      }

      setPastos(
        (pastosRes.data ?? []).map((p: any) => {
          const vp = atualMap.get(p.id);
          return {
            id: p.id,
            nome: p.nome,
            num_animais: Number(p.num_animais) || 0,
            peso_medio_kg: p.peso_medio_kg != null ? Number(p.peso_medio_kg) : null,
            gmd_kg_dia: p.gmd_kg_dia != null ? Number(p.gmd_kg_dia) : null,
            consumo_global_g_cab_dia: vp?.consumo_global_g_cab_dia != null ? Number(vp.consumo_global_g_cab_dia) : null,
            indice_global: vp?.indice_global != null ? Number(vp.indice_global) : null,
            status_global: vp?.status_global ?? null,
            num_sacos: sacosMap.get(p.id) ?? 0,
          } satisfies PastoRetiroItem;
        }),
      );
    } catch (e) {
      console.error("usePastosRetiro error:", e);
      setPastos([]);
    } finally {
      setLoading(false);
    }
  }, [retiroId, mes, ano]);

  useEffect(() => { void load(); }, [load]);

  return { pastos, loading, refresh: load };
}
