import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PainelMaeData {
  consumo_real_g_cab_dia: number;
  consumo_global_g_cab_dia: number;
  eficiencia: number;
  pastos_na_meta_num: number;
  pastos_na_meta_den: number;
  peso_medio_kg: number;
}

const empty: PainelMaeData = {
  consumo_real_g_cab_dia: 0,
  consumo_global_g_cab_dia: 0,
  eficiencia: 0,
  pastos_na_meta_num: 0,
  pastos_na_meta_den: 0,
  peso_medio_kg: 0,
};

/**
 * Fonte única de verdade dos cards de consumo/eficiência/meta/peso.
 * p_retiro_id = null agrega a fazenda inteira.
 */
export function usePainelMae(
  fazendaId: string | null | undefined,
  retiroId: string | null | undefined,
  mes: number,
  ano: number,
) {
  const [data, setData] = useState<PainelMaeData>(empty);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!fazendaId) {
      setData(empty);
      return;
    }
    setLoading(true);
    try {
      const { data: rows, error } = await (supabase as any).rpc("get_painel_mae", {
        p_fazenda_id: fazendaId,
        p_retiro_id: retiroId ?? null,
        p_mes: mes,
        p_ano: ano,
      });
      if (error) throw error;
      const row = Array.isArray(rows) ? rows[0] : rows;
      setData(
        row
          ? {
              consumo_real_g_cab_dia: Number(row.consumo_real_g_cab_dia) || 0,
              consumo_global_g_cab_dia: Number(row.consumo_global_g_cab_dia) || 0,
              eficiencia: Number(row.eficiencia) || 0,
              pastos_na_meta_num: Number(row.pastos_na_meta_num) || 0,
              pastos_na_meta_den: Number(row.pastos_na_meta_den) || 0,
              peso_medio_kg: Number(row.peso_medio_kg) || 0,
            }
          : empty,
      );
    } catch (e) {
      console.error("usePainelMae error:", e);
      setData(empty);
    } finally {
      setLoading(false);
    }
  }, [fazendaId, retiroId, mes, ano]);

  useEffect(() => {
    void load();
  }, [load]);

  return { painelMae: data, loading, refresh: load };
}
