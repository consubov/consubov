import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useConsumoMineral, aggregateConsumoMineral, type ConsumoMineralRetiro } from "@/hooks/useConsumoMineral";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

// ---------- Types ----------
interface Retiro {
  id: string; nome: string; capataz: string;
  ultima_salga_em: string | null; produto_id: string | null;
}
interface Pasto {
  id: string; nome: string; retiro_id: string; num_animais: number;
  peso_medio_kg: number | null; gmd_kg_dia: number | null;
  produto_id: string | null;
}
interface Lancamento {
  id: string; pasto_id: string; retiro_id: string;
  num_sacos: number; num_animais: number;
  peso_medio_kg: number | null; dias_no_pasto: number;
  created_at: string | null;
  mes_referencia: number; ano_referencia: number;
  consumo_g_cab_dia: number | null;
  status_consumo: string | null; indice_consumo: number | null;
  categoria: string | null; sexo: string | null;
}

/** Pre-calculated consumption for a single lancamento (read-only from DB). */
export interface LancamentoConsumo {
  pasto_id: string;
  num_animais: number;
  num_sacos: number;
  dias_no_pasto: number;
  consumo_g_cab_dia: number; // read directly from DB
  status_consumo: string | null;
  indice_consumo: number | null;
}

export interface RetiroResumo {
  id: string; nome: string; capataz: string;
  totalAnimais: number; sacosUtilizados: number;
  consumoMedio: number; gmd: number;
  diasSemSalga: number | null;
  lancamentos: Lancamento[];
  pastos: Pasto[];
  pastosConsumo: Map<string, LancamentoConsumo[]>;
}

export interface StatusDist {
  baixo: number; ideal: number; alto: number;
  baixoPct: number; idealPct: number; altoPct: number;
}

export interface PainelMetrics {
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
  statusDist: StatusDist;
}

export interface PainelFilters {
  fazendaId: string;
  retiroId?: string | null;
  mes: number;
  ano: number;
}

const emptyMetrics: PainelMetrics = {
  totalAnimais: 0, sacosUtilizados: 0, consumoMedio: 0,
  pastosNaMeta: 0, totalPastos: 0, custoDiario: 0,
  custoMensal: 0, eficiencia: 0, gmdMedio: 0, totalSalgas: 0,
  statusDist: { baixo: 0, ideal: 0, alto: 0, baixoPct: 0, idealPct: 0, altoPct: 0 },
};

export function usePainelData(filters: PainelFilters) {
  const { fazendaId, retiroId, mes, ano } = filters;
  const [fazendaNome, setFazendaNome] = useState("");
  const [retiros, setRetiros] = useState<Retiro[]>([]);
  const [pastos, setPastos] = useState<Pasto[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [extraLoading, setExtraLoading] = useState(true);

  // ---------- Centralized RPC for consumption metrics ----------
  const { data: consumoData, loading: consumoLoading, refresh: refreshConsumo } = useConsumoMineral({
    fazendaId,
    mes,
    ano,
    retiroId,
  });

  // ---------- Additional data needed for retiro detail (pastos, lancamentos) ----------
  const loadExtraData = useCallback(async () => {
    if (!fazendaId) {
      setFazendaNome("");
      setRetiros([]);
      setPastos([]);
      setLancamentos([]);
      setExtraLoading(false);
      return;
    }
    setExtraLoading(true);
    try {
      const [fazRes, retirosRes] = await Promise.all([
        supabase.from("fazendas").select("nome").eq("id", fazendaId).single(),
        supabase.from("retiros").select("id, nome, capataz, ultima_salga_em, produto_id")
          .eq("fazenda_id", fazendaId).eq("ativo", true),
      ]);

      setFazendaNome(fazRes.data?.nome ?? "");
      const allRetiros = (retirosRes.data ?? []) as Retiro[];
      const retList = retiroId ? allRetiros.filter((r) => r.id === retiroId) : allRetiros;
      setRetiros(retList);

      let retiroIds = retList.map(r => r.id);
      if (retiroId) retiroIds = [retiroId];

      if (retiroIds.length > 0) {
        const [pastosRes, lancRes] = await Promise.all([
          supabase.from("pastos")
            .select("id, nome, retiro_id, num_animais, peso_medio_kg, gmd_kg_dia, produto_id")
            .in("retiro_id", retiroIds)
            .eq("ativo", true),
          (() => {
            let q = supabase.from("lancamentos")
              .select("id, pasto_id, retiro_id, num_sacos, num_animais, peso_medio_kg, dias_no_pasto, created_at, mes_referencia, ano_referencia, consumo_g_cab_dia, status_consumo, indice_consumo, categoria, sexo")
              .eq("fazenda_id", fazendaId)
              .eq("ano_referencia", ano)
              .eq("mes_referencia", mes);
            if (retiroId) q = q.eq("retiro_id", retiroId);
            return q;
          })(),
        ]);
        setPastos((pastosRes.data ?? []) as Pasto[]);
        setLancamentos((lancRes.data ?? []) as Lancamento[]);
      } else {
        setPastos([]);
        setLancamentos([]);
      }
    } catch (e) {
      console.error("usePainelData error:", e);
    } finally {
      setExtraLoading(false);
    }
  }, [fazendaId, retiroId, mes, ano]);

  useEffect(() => { loadExtraData(); }, [loadExtraData]);

  useRealtimeSync(["pastos", "lancamentos", "movimentacoes_animais", "abates", "mortalidades", "ciclos"], () => {
    loadExtraData();
    refreshConsumo();
  });

  useEffect(() => {
    const handleFocus = () => { void loadExtraData(); void refreshConsumo(); };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") { void loadExtraData(); void refreshConsumo(); }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadExtraData, refreshConsumo]);

  const loading = consumoLoading || extraLoading;

  // ---------- Metrics: from centralized RPC ----------
  const metrics = useMemo<PainelMetrics>(() => {
    if (consumoData.length === 0) return emptyMetrics;
    const agg = aggregateConsumoMineral(consumoData);
    return {
      totalAnimais: agg.totalAnimais,
      sacosUtilizados: agg.sacosUtilizados,
      consumoMedio: agg.consumoMedio,
      pastosNaMeta: agg.pastosNaMeta,
      totalPastos: agg.totalPastos,
      custoDiario: agg.custoDiario,
      custoMensal: agg.custoMensal,
      eficiencia: agg.eficiencia,
      gmdMedio: agg.gmdMedio,
      totalSalgas: agg.totalSalgas,
      statusDist: agg.statusDist,
    };
  }, [consumoData]);

  // ---------- Retiros resumo (using RPC data + pastos/lancamentos for detail) ----------
  const retirosResumo = useMemo<RetiroResumo[]>(() => {
    const now = new Date();
    return retiros.map(r => {
      const rPastos = pastos.filter(p => p.retiro_id === r.id);
      const rLanc = lancamentos.filter(l => l.retiro_id === r.id);

      // Find this retiro's metrics from RPC data
      const rpcRow = consumoData.find(c => c.retiro_id === r.id);

      let diasSemSalga: number | null = null;
      if (r.ultima_salga_em) {
        diasSemSalga = Math.floor((now.getTime() - new Date(r.ultima_salga_em).getTime()) / 86400000);
      }

      // Build per-pasto consumption map from lancamentos (all values from DB)
      const pastosConsumo = new Map<string, LancamentoConsumo[]>();
      for (const l of rLanc) {
        const entry: LancamentoConsumo = {
          pasto_id: l.pasto_id,
          num_animais: l.num_animais,
          num_sacos: l.num_sacos,
          dias_no_pasto: l.dias_no_pasto,
          consumo_g_cab_dia: Number(l.consumo_g_cab_dia) || 0,
          status_consumo: l.status_consumo,
          indice_consumo: l.indice_consumo,
        };
        const list = pastosConsumo.get(l.pasto_id) ?? [];
        list.push(entry);
        pastosConsumo.set(l.pasto_id, list);
      }

      return {
        id: r.id,
        nome: r.nome,
        capataz: r.capataz,
        totalAnimais: rpcRow ? Number(rpcRow.total_animais) : rPastos.reduce((s, p) => s + p.num_animais, 0),
        sacosUtilizados: rpcRow ? Number(rpcRow.total_sacos) : rLanc.reduce((s, l) => s + l.num_sacos, 0),
        consumoMedio: rpcRow ? Number(rpcRow.consumo_medio_g) : 0,
        gmd: rpcRow ? Number(rpcRow.gmd_medio) : 0,
        diasSemSalga,
        lancamentos: rLanc,
        pastos: rPastos,
        pastosConsumo,
      };
    });
  }, [retiros, pastos, lancamentos, consumoData]);

  const refresh = useCallback(async () => {
    await Promise.all([loadExtraData(), refreshConsumo()]);
  }, [loadExtraData, refreshConsumo]);

  return {
    loading, fazendaNome, metrics, retirosResumo, lancamentos, refresh,
  };
}
