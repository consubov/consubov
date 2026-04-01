import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ---------- Types ----------
interface Retiro { id: string; nome: string; capataz: string; }
interface Pasto {
  id: string; nome: string; retiro_id: string; num_animais: number;
  peso_medio_kg: number | null; gmd_kg_dia: number | null;
  peso_abate_meta_kg: number | null; produto_id: string | null;
}
interface Lancamento {
  id: string; ciclo_id: string; pasto_id: string; num_sacos: number;
  num_animais: number; consumo_g_cab_dia: number | null;
  custo_total: number | null; gmd_kg_dia: number | null;
  capataz_nome: string | null; lancado_em: string | null;
  status_consumo: string | null; indice_consumo: number | null;
}
interface Ciclo { id: string; fazenda_id: string; mes: number; ano: number; num_dias: number; fechado: boolean | null; }

export interface Observacao {
  id: string; fazenda_id: string; retiro_id: string | null; pasto_id: string | null;
  capataz_nome: string | null; tipo: string | null; descricao: string | null;
  foto_url: string | null; resolvido: boolean; resolvido_por: string | null;
  resolvido_em: string | null; criado_em: string | null;
}

export interface RetiroComDados {
  id: string; nome: string; capataz: string;
  totalAnimais: number; sacosUtilizados: number;
  consumoMedio: number; gmd: number; pastos: Pasto[];
  lancamentos: Lancamento[];
}

export interface PainelData {
  totalAnimais: number; consumoMedio: number; pastosNaMeta: number;
  totalPastos: number; sacosUtilizados: number; custoDiario: number;
  custoMensal: number; eficiencia: number; gmdMedio: number;
}

export interface CapatazScore { retiro: string; capataz: string; score: number; }
export interface GmdRankItem { retiro: string; capataz: string; gmd: number; }

const CONSUMO_META = 50; // g/cab/dia target

export function useGerenteData() {
  const { roleData } = useAuth();
  const fazendaId = roleData.fazendaId;

  const [loading, setLoading] = useState(true);
  const [gerenteNome, setGerenteNome] = useState("");
  const [fazendaNome, setFazendaNome] = useState("");
  const [ciclo, setCiclo] = useState<Ciclo | null>(null);
  const [retiros, setRetiros] = useState<Retiro[]>([]);
  const [pastos, setPastos] = useState<Pasto[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [observacoes, setObservacoes] = useState<Observacao[]>([]);

  const loadData = useCallback(async () => {
    if (!fazendaId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [gerenteRes, fazendaRes, cicloRes, retirosRes] = await Promise.all([
        supabase.from("gerentes").select("nome").eq("id", roleData.roleId!).single(),
        supabase.from("fazendas").select("nome").eq("id", fazendaId).single(),
        supabase.from("ciclos").select("*").eq("fazenda_id", fazendaId)
          .eq("fechado", false).order("ano", { ascending: false })
          .order("mes", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("retiros").select("id, nome, capataz").eq("fazenda_id", fazendaId).eq("ativo", true),
      ]);

      setGerenteNome(gerenteRes.data?.nome ?? "");
      setFazendaNome(fazendaRes.data?.nome ?? "");
      const currentCiclo = cicloRes.data as Ciclo | null;
      setCiclo(currentCiclo);
      const retirosList = (retirosRes.data ?? []) as Retiro[];
      setRetiros(retirosList);

      const retiroIds = retirosList.map(r => r.id);
      if (retiroIds.length > 0) {
        const pastosRes = await supabase.from("pastos").select("id, nome, retiro_id, num_animais, peso_medio_kg, gmd_kg_dia, peso_abate_meta_kg, produto_id")
          .in("retiro_id", retiroIds).eq("ativo", true);
        const pastosList = (pastosRes.data ?? []) as Pasto[];
        setPastos(pastosList);

        const pastoIds = pastosList.map(p => p.id);
        let lancList: Lancamento[] = [];
        if (currentCiclo && pastoIds.length > 0) {
          const lancRes = await supabase.from("lancamentos").select("id, ciclo_id, pasto_id, num_sacos, num_animais, consumo_g_cab_dia, custo_total, gmd_kg_dia, capataz_nome, lancado_em, status_consumo, indice_consumo")
            .eq("ciclo_id", currentCiclo.id).in("pasto_id", pastoIds);
          lancList = (lancRes.data ?? []) as Lancamento[];
        }
        setLancamentos(lancList);
      } else {
        setPastos([]);
        setLancamentos([]);
      }

      // Observacoes - table may not exist yet
      try {
        const obsRes = await (supabase as any).from("observacoes").select("*").eq("fazenda_id", fazendaId);
        setObservacoes((obsRes.data ?? []) as Observacao[]);
      } catch { setObservacoes([]); }
    } catch (e) {
      console.error("Error loading gerente data:", e);
    } finally {
      setLoading(false);
    }
  }, [fazendaId, roleData.roleId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime
  useEffect(() => {
    if (!ciclo) return;
    const channel = supabase.channel("gerente-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "lancamentos", filter: `ciclo_id=eq.${ciclo.id}` }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "observacoes" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ciclo?.id, loadData]);

  // Computed: painel
  const painelData = useMemo<PainelData>(() => {
    const totalAnimais = pastos.reduce((s, p) => s + (p.num_animais || 0), 0);
    const consumoVals = lancamentos.filter(l => l.consumo_g_cab_dia != null).map(l => Number(l.consumo_g_cab_dia));
    const consumoMedio = consumoVals.length > 0 ? consumoVals.reduce((a, b) => a + b, 0) / consumoVals.length : 0;

    // Pastos "na meta": consumo within 70-130% of target
    const lancByPasto = new Map<string, number[]>();
    lancamentos.forEach(l => {
      if (l.consumo_g_cab_dia != null) {
        const arr = lancByPasto.get(l.pasto_id) || [];
        arr.push(Number(l.consumo_g_cab_dia));
        lancByPasto.set(l.pasto_id, arr);
      }
    });
    let pastosNaMeta = 0;
    lancByPasto.forEach(vals => {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (avg >= CONSUMO_META * 0.7 && avg <= CONSUMO_META * 1.3) pastosNaMeta++;
    });

    const sacosUtilizados = lancamentos.reduce((s, l) => s + (l.num_sacos || 0), 0);
    const custoMensal = lancamentos.reduce((s, l) => s + (Number(l.custo_total) || 0), 0);
    const numDias = ciclo?.num_dias ?? 30;
    const custoDiario = totalAnimais > 0 && numDias > 0 ? custoMensal / numDias / totalAnimais : 0;
    const eficiencia = pastos.length > 0 ? (pastosNaMeta / pastos.length) * 100 : 0;
    const gmdVals = pastos.filter(p => p.gmd_kg_dia != null && Number(p.gmd_kg_dia) > 0).map(p => Number(p.gmd_kg_dia!));
    const gmdMedio = gmdVals.length > 0 ? gmdVals.reduce((a, b) => a + b, 0) / gmdVals.length : 0;

    return { totalAnimais, consumoMedio, pastosNaMeta, totalPastos: pastos.length, sacosUtilizados, custoDiario, custoMensal, eficiencia, gmdMedio };
  }, [pastos, lancamentos, ciclo]);

  // Computed: retiros com dados
  const retirosComDados = useMemo<RetiroComDados[]>(() => {
    return retiros.map(r => {
      const rPastos = pastos.filter(p => p.retiro_id === r.id);
      const rPastoIds = new Set(rPastos.map(p => p.id));
      const rLanc = lancamentos.filter(l => rPastoIds.has(l.pasto_id));
      const totalAnimais = rPastos.reduce((s, p) => s + (p.num_animais || 0), 0);
      const sacosUtilizados = rLanc.reduce((s, l) => s + (l.num_sacos || 0), 0);
      const cVals = rLanc.filter(l => l.consumo_g_cab_dia != null).map(l => Number(l.consumo_g_cab_dia));
      const consumoMedio = cVals.length > 0 ? cVals.reduce((a, b) => a + b, 0) / cVals.length : 0;
      const gVals = rPastos.filter(p => p.gmd_kg_dia != null && Number(p.gmd_kg_dia) > 0).map(p => Number(p.gmd_kg_dia!));
      const gmd = gVals.length > 0 ? gVals.reduce((a, b) => a + b, 0) / gVals.length : 0;
      return { ...r, totalAnimais, sacosUtilizados, consumoMedio, gmd, pastos: rPastos, lancamentos: rLanc };
    });
  }, [retiros, pastos, lancamentos]);

  // Computed: capataz scores
  const capatazScores = useMemo<CapatazScore[]>(() => {
    const numDias = ciclo?.num_dias ?? 30;
    return retirosComDados.map(r => {
      const rLanc = r.lancamentos;
      // 50% consumption proximity
      const cVals = rLanc.filter(l => l.consumo_g_cab_dia != null).map(l => Number(l.consumo_g_cab_dia));
      const avgC = cVals.length > 0 ? cVals.reduce((a, b) => a + b, 0) / cVals.length : 0;
      const consumoScore = avgC > 0 ? Math.max(0, 1 - Math.abs(avgC - CONSUMO_META) / CONSUMO_META) * 5 : 0;

      // 25% regularity
      const expected = r.pastos.length * (numDias / 3);
      const regScore = expected > 0 ? Math.min(1, rLanc.length / expected) * 2.5 : 0;

      // 25% interval consistency
      const dates = rLanc.filter(l => l.lancado_em).map(l => new Date(l.lancado_em!).getTime()).sort((a, b) => a - b);
      let intScore = 0;
      if (dates.length >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < dates.length; i++) intervals.push((dates[i] - dates[i - 1]) / 86400000);
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        intScore = avg <= 4 ? 2.5 : Math.max(0, 2.5 - (avg - 4) * 0.25);
      }

      return { retiro: r.nome, capataz: r.capataz, score: Number(Math.min(10, consumoScore + regScore + intScore).toFixed(1)) };
    }).sort((a, b) => b.score - a.score);
  }, [retirosComDados, ciclo]);

  // Computed: GMD ranking
  const gmdRanking = useMemo<GmdRankItem[]>(() => {
    return retirosComDados
      .map(r => ({ retiro: r.nome, capataz: r.capataz, gmd: Number(r.gmd.toFixed(3)) }))
      .sort((a, b) => b.gmd - a.gmd);
  }, [retirosComDados]);

  // Resolve observacao
  const resolverObservacao = useCallback(async (id: string, resolvidoPor: string) => {
    try {
      await (supabase as any).from("observacoes").update({
        resolvido: true, resolvido_por: resolvidoPor, resolvido_em: new Date().toISOString(),
      }).eq("id", id);
      setObservacoes(prev => prev.map(o =>
        o.id === id ? { ...o, resolvido: true, resolvido_por: resolvidoPor, resolvido_em: new Date().toISOString() } : o
      ));
    } catch (e) { console.error("Error resolving observacao:", e); }
  }, []);

  const obsPendentes = useMemo(() => observacoes.filter(o => !o.resolvido).sort((a, b) => new Date(b.criado_em ?? 0).getTime() - new Date(a.criado_em ?? 0).getTime()), [observacoes]);
  const obsResolvidas = useMemo(() => observacoes.filter(o => o.resolvido).sort((a, b) => new Date(b.resolvido_em ?? 0).getTime() - new Date(a.resolvido_em ?? 0).getTime()), [observacoes]);

  return {
    loading, gerenteNome, fazendaNome, ciclo, painelData,
    retirosComDados, lancamentos, capatazScores, gmdRanking,
    obsPendentes, obsResolvidas, resolverObservacao, refresh: loadData,
  };
}
