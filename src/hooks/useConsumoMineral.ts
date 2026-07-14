import { useEffect, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FORMULAS_FALLBACK, type FormulaConfig } from "@/lib/formulasSistema";

export interface ConsumoMineralRetiro {
  retiro_id: string;
  retiro_nome: string;
  capataz: string;
  total_animais: number;
  total_sacos: number;
  total_kg_consumido: number;
  total_cab_dias: number;
  consumo_medio_g: number;
  custo_diario: number;
  custo_mensal: number;
  gmd_medio: number;
  status_baixo: number;
  status_ideal: number;
  status_alto: number;
  pastos_na_meta: number;
  total_pastos: number;
  eficiencia: number;
  total_salgas: number;
}

export interface ConsumoMineralAggregate {
  totalAnimais: number;
  sacosUtilizados: number;
  consumoMedio: number;
  pastosNaMeta: number;
  totalPastos: number;
  custoDiario: number;
  custoMensal: number;
  eficiencia: number;
  gmdMedio: number;
  totalSalgas: number;
  statusDist: {
    baixo: number; ideal: number; alto: number;
    baixoPct: number; idealPct: number; altoPct: number;
  };
}

/** Aggregate an array of per-retiro results into fazenda-level metrics */
export function aggregateConsumoMineral(
  rows: ConsumoMineralRetiro[],
  formulas?: FormulaConfig,
): ConsumoMineralAggregate {
  let totalAnimais = 0, sacosUtilizados = 0, totalKg = 0, totalCabDias = 0;
  let totalCusto = 0, pastosNaMeta = 0, totalPastos = 0, totalSalgas = 0;
  let statusBaixo = 0, statusIdeal = 0, statusAlto = 0;
  let eficienciaSum = 0, eficienciaCount = 0;
  let gmdSum = 0, gmdCount = 0;

  for (const r of rows) {
    const animais = Number(r.total_animais) || 0;
    totalAnimais += animais;
    sacosUtilizados += Number(r.total_sacos) || 0;
    totalKg += Number(r.total_kg_consumido) || 0;
    totalCabDias += Number(r.total_cab_dias) || 0;
    totalCusto += Number(r.custo_mensal) || 0;
    pastosNaMeta += Number(r.pastos_na_meta) || 0;
    totalPastos += Number(r.total_pastos) || 0;
    totalSalgas += Number(r.total_salgas) || 0;
    statusBaixo += Number(r.status_baixo) || 0;
    statusIdeal += Number(r.status_ideal) || 0;
    statusAlto += Number(r.status_alto) || 0;
    const efRaw = Number(r.eficiencia) || 0;
    if (formulas) {
      // r.eficiencia é retornado pelo RPC como (avg_indice * 100). Reconstruímos
      // o índice médio do retiro para reaplicar a fórmula da tabela formulas_sistema.
      const indiceMedioRetiro = efRaw / 100;
      if (indiceMedioRetiro > 0) {
        eficienciaSum += formulas.eficiencia.compute(indiceMedioRetiro);
        eficienciaCount++;
      }
    } else if (efRaw > 0) {
      eficienciaSum += efRaw;
      eficienciaCount++;
    }
    const gmd = Number(r.gmd_medio) || 0;
    if (gmd > 0) { gmdSum += gmd; gmdCount++; }
  }

  // Same rule used by the database RPC: total consumed kg divided by animal-days in the selected period.
  const consumoMedio = totalCabDias > 0 ? (totalKg * 1000) / totalCabDias : 0;
  const custoDiario = totalCabDias > 0 ? totalCusto / totalCabDias : 0;
  const eficiencia = eficienciaCount > 0 ? eficienciaSum / eficienciaCount : 0;
  const gmdMedio = gmdCount > 0 ? gmdSum / gmdCount : 0;

  const totalStatus = statusBaixo + statusIdeal + statusAlto;

  return {
    totalAnimais,
    sacosUtilizados,
    consumoMedio,
    pastosNaMeta,
    totalPastos,
    custoDiario,
    custoMensal: totalCusto,
    eficiencia,
    gmdMedio,
    totalSalgas,
    statusDist: {
      baixo: statusBaixo,
      ideal: statusIdeal,
      alto: statusAlto,
      baixoPct: totalStatus > 0 ? (statusBaixo / totalStatus) * 100 : 0,
      idealPct: totalStatus > 0 ? (statusIdeal / totalStatus) * 100 : 0,
      altoPct: totalStatus > 0 ? (statusAlto / totalStatus) * 100 : 0,
    },
  };
}

interface UseConsumoMineralParams {
  fazendaId: string;
  mes: number;
  ano: number;
  retiroId?: string | null;
}

export function useConsumoMineral({ fazendaId, mes, ano, retiroId }: UseConsumoMineralParams) {
  const [data, setData] = useState<ConsumoMineralRetiro[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!fazendaId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: result, error } = await supabase.rpc("get_consumo_mineral", {
        p_fazenda_id: fazendaId,
        p_mes: mes,
        p_ano: ano,
      });
      if (error) {
        console.error("[useConsumoMineral] RPC error:", error);
        setData([]);
      } else {
        let rows = (result ?? []) as ConsumoMineralRetiro[];
        if (retiroId) {
          rows = rows.filter(r => r.retiro_id === retiroId);
        }
        setData(rows);
      }
    } catch (e) {
      console.error("[useConsumoMineral] error:", e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [fazendaId, mes, ano, retiroId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime invalidation
  useEffect(() => {
    const channel = supabase
      .channel(`consumo-mineral-${fazendaId}-${retiroId ?? "all"}-${mes}-${ano}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lancamentos" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "pastos" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "retiros" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData, fazendaId, retiroId, mes, ano]);

  // Refetch on focus
  useEffect(() => {
    const handleFocus = () => void fetchData();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void fetchData();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchData]);

  return { data, loading, refresh: fetchData };
}
