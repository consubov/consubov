import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

interface TotalAnimaisResult {
  total: number;
  cicloAberto: boolean;
  loading: boolean;
}

/**
 * Returns the total animals for a retiro in a given month:
 * - Open cycle (or no cycle): SUM(pastos.num_animais) — current live data
 * - Closed cycle: SUM of MAX(lancamentos.num_animais) per pasto — historical snapshot
 */
export function useTotalAnimaisRetiro(
  retiroId: string | undefined,
  mes: number,
  ano: number,
): TotalAnimaisResult {
  const [total, setTotal] = useState(0);
  const [cicloAberto, setCicloAberto] = useState(true);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!retiroId) {
      setTotal(0);
      setLoading(false);
      return;
    }

    // Get fazenda_id from retiro
    const { data: retiro } = await supabase
      .from("retiros")
      .select("fazenda_id")
      .eq("id", retiroId)
      .maybeSingle();

    if (!retiro) {
      setTotal(0);
      setLoading(false);
      return;
    }

    // Check if cycle for selected month is open
    const { data: ciclo } = await supabase
      .from("ciclos")
      .select("id, fechado")
      .eq("fazenda_id", retiro.fazenda_id)
      .eq("mes", mes)
      .eq("ano", ano)
      .maybeSingle();

    const isOpen = !ciclo || ciclo.fechado !== true;
    setCicloAberto(isOpen);

    if (isOpen) {
      // Open cycle: sum current pastos.num_animais
      const { data: pastos } = await supabase
        .from("pastos")
        .select("num_animais")
        .eq("retiro_id", retiroId)
        .eq("ativo", true);

      const sum = (pastos ?? []).reduce((acc, p) => acc + (p.num_animais || 0), 0);
      setTotal(sum);
    } else {
      // Closed cycle: sum from lancamentos (max num_animais per pasto)
      const { data: lancamentos } = await supabase
        .from("lancamentos")
        .select("pasto_id, num_animais")
        .eq("retiro_id", retiroId)
        .eq("mes_referencia", mes)
        .eq("ano_referencia", ano);

      // Get max num_animais per pasto
      const perPasto = new Map<string, number>();
      for (const l of lancamentos ?? []) {
        const current = perPasto.get(l.pasto_id) ?? 0;
        if (l.num_animais > current) {
          perPasto.set(l.pasto_id, l.num_animais);
        }
      }

      let sum = 0;
      perPasto.forEach((v) => { sum += v; });
      setTotal(sum);
    }

    setLoading(false);
  }, [retiroId, mes, ano]);

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh on pastos/lancamentos changes
  useRealtimeSync(["pastos", "lancamentos"], load);

  return { total, cicloAberto, loading };
}
