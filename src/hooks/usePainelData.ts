import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calculatePainelMetrics, calculateRetiroMetrics } from "@/lib/painelMetrics";
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
interface Produto { id: string; peso_saco_kg: number; preco_por_kg: number | null; }

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
  consumoMedio: number; // g/cab/dia – read from pre-calculated DB field
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
  const [loading, setLoading] = useState(true);
  const [fazendaNome, setFazendaNome] = useState("");
  const [retiros, setRetiros] = useState<Retiro[]>([]);
  const [pastos, setPastos] = useState<Pasto[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  const loadData = useCallback(async () => {
    if (!fazendaId) {
      setFazendaNome("");
      setRetiros([]);
      setPastos([]);
      setLancamentos([]);
      setProdutos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [fazRes, retirosRes, prodRes] = await Promise.all([
        supabase.from("fazendas").select("nome").eq("id", fazendaId).single(),
        supabase.from("retiros").select("id, nome, capataz, ultima_salga_em, produto_id")
          .eq("fazenda_id", fazendaId).eq("ativo", true),
        supabase.from("produtos").select("id, peso_saco_kg, preco_por_kg"),
      ]);

      setFazendaNome(fazRes.data?.nome ?? "");
      const allRetiros = (retirosRes.data ?? []) as Retiro[];
      const retList = retiroId ? allRetiros.filter((r) => r.id === retiroId) : allRetiros;
      setRetiros(retList);
      setProdutos((prodRes.data ?? []) as Produto[]);

      let retiroIds = retList.map(r => r.id);
      if (retiroId) retiroIds = [retiroId];

      if (retiroIds.length > 0) {
        // Fetch only ACTIVE pastos — consistent with PainelInteligencia and PDF reports
        const pastosRes = await supabase.from("pastos")
          .select("id, nome, retiro_id, num_animais, peso_medio_kg, gmd_kg_dia, produto_id")
          .in("retiro_id", retiroIds)
          .eq("ativo", true);
        const pastosList = (pastosRes.data ?? []) as Pasto[];
        setPastos(pastosList);

        // Query lancamentos by fazenda_id + period directly
        let lancQuery = supabase.from("lancamentos")
          .select("id, pasto_id, retiro_id, num_sacos, num_animais, peso_medio_kg, dias_no_pasto, created_at, mes_referencia, ano_referencia, consumo_g_cab_dia, status_consumo, indice_consumo, categoria, sexo")
          .eq("fazenda_id", fazendaId)
          .eq("ano_referencia", ano)
          .eq("mes_referencia", mes);

        if (retiroId) {
          lancQuery = lancQuery.eq("retiro_id", retiroId);
        }

        const lancRes = await lancQuery;
        const lancList = (lancRes.data ?? []) as Lancamento[];
        setLancamentos(lancList);

        console.log(`[usePainelData] mes=${mes} ano=${ano} fazenda=${fazendaId} retiro=${retiroId ?? "all"} → pastos=${pastosList.length} lancamentos=${lancList.length}`);
      } else {
        setPastos([]);
        setLancamentos([]);
      }
    } catch (e) {
      console.error("usePainelData error:", e);
    } finally {
      setLoading(false);
    }
  }, [fazendaId, retiroId, mes, ano]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime: auto-refresh when pastos, lancamentos, movimentacoes, abates or ciclos change
  useRealtimeSync(["pastos", "lancamentos", "movimentacoes_animais", "abates", "mortalidades", "ciclos"], loadData);

  // Refetch when the tab/window regains focus (ensures fresh data on screen access)
  useEffect(() => {
    const handleFocus = () => { void loadData(); };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void loadData();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadData]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel(`painel-${fazendaId}-${retiroId ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lancamentos" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "pastos" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "retiros" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadData, fazendaId, retiroId]);

  // ---------- Metrics: read PRE-CALCULATED data from DB ----------
  const metrics = useMemo<PainelMetrics>(() => {
    const calculated = calculatePainelMetrics({ pastos, lancamentos, produtos, retiros });

    return {
      totalAnimais: calculated.totalAnimais,
      sacosUtilizados: calculated.sacosUtilizados,
      consumoMedio: calculated.consumoMedio,
      pastosNaMeta: calculated.pastosNaMeta,
      totalPastos: calculated.totalPastos,
      custoDiario: calculated.custoDiario,
      custoMensal: calculated.custoMensal,
      eficiencia: calculated.eficiencia,
      gmdMedio: calculated.gmdMedio,
      totalSalgas: calculated.totalSalgas,
      statusDist: calculated.statusDist,
    };
  }, [pastos, lancamentos, produtos, retiros]);

  // ---------- Retiros resumo ----------
  const retirosResumo = useMemo<RetiroResumo[]>(() => {
    const now = new Date();
    return retiros.map(r => {
      const rPastos = pastos.filter(p => p.retiro_id === r.id);
      // Filter lancamentos by retiro_id (not pasto_id) to correctly attribute data
      // even when pastos are transferred between retiros
      const rLanc = lancamentos.filter(l => l.retiro_id === r.id);
      const resumo = calculateRetiroMetrics({
        retiroId: r.id,
        pastos,
        lancamentos,
        produtos,
        retiros,
      });

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
        totalAnimais: resumo.totalAnimais,
        sacosUtilizados: resumo.sacosUtilizados,
        consumoMedio: resumo.consumoMedio,
        gmd: resumo.gmd,
        diasSemSalga,
        lancamentos: rLanc,
        pastos: rPastos,
        pastosConsumo,
      };
    });
  }, [retiros, pastos, lancamentos, produtos]);

  return {
    loading, fazendaNome, metrics, retirosResumo, lancamentos, refresh: loadData,
  };
}
