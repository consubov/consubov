import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { diasCalendarioSP } from "@/lib/diasCalendario";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { computeConsumoMedioPonderado } from "@/lib/painelMetrics";
import { aggregateConsumoMineral, useConsumoMineral } from "@/hooks/useConsumoMineral";
import { usePainelMae } from "@/hooks/usePainelMae";
import { useFormulasSistema } from "@/lib/formulasSistema";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { fetchProdutoIdsDaFazenda } from "@/lib/produtosFazenda";
// Push de salga atrasada agora é disparado pelo cron server-side
// (verificar_salgas_atrasadas), escopado à fazenda do gerente.

// ---------- Types ----------
interface Retiro { id: string; nome: string; capataz: string; ultima_salga_em: string | null; alerta_atraso_enviado: boolean; produto_id: string | null; }
interface Pasto {
  id: string; nome: string; retiro_id: string; num_animais: number;
  peso_medio_kg: number | null; gmd_kg_dia: number | null;
  peso_abate_meta_kg: number | null; produto_id: string | null;
}
interface Lancamento {
  id: string; pasto_id: string; num_sacos: number;
  num_animais: number; peso_medio_kg: number | null;
  categoria: string | null; sexo: string | null;
  dias_no_pasto: number; origem: string;
  created_at: string | null;
  mes_referencia: number; ano_referencia: number;
  fazenda_id: string; retiro_id: string;
  consumo_g_cab_dia: number | null;
  status_consumo: string | null; indice_consumo: number | null;
}
interface Produto { id: string; peso_saco_kg: number; preco_por_kg: number | null; }
interface Ciclo { id: string; fazenda_id: string; mes: number; ano: number; num_dias: number; fechado: boolean | null; duracao_dias: number | null; }
interface FazendaRow { nome: string; intervalo_padrao_dias: number; }

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
  intervaloDefinido: number;
  intervaloRealMedio: number | null;
  diasSemSalga: number | null;
  alertaAtraso: boolean;
  ultimaSalga: string | null;
}

export interface AlertaAtraso {
  retiroNome: string;
  capataz: string;
  ultimaSalga: string | null;
  intervaloDefinido: number;
  diasSemSalga: number;
  gravidade: 'leve' | 'moderado' | 'critico';
}

export interface StatusDistribution {
  baixo: number; ideal: number; alto: number;
  baixoPct: number; idealPct: number; altoPct: number;
}

export interface PainelData {
  totalAnimais: number; consumoMedio: number; pastosNaMeta: number;
  totalPastos: number; sacosUtilizados: number; custoDiario: number;
  custoMensal: number; eficiencia: number; gmdMedio: number;
  statusDistribution: StatusDistribution;
}

export interface CapatazScore { retiro: string; capataz: string; score: number; }
export interface GmdRankItem { retiro: string; capataz: string; gmd: number; }

const CONSUMO_META = 50; // g/cab/dia target

export interface GerenteFilters {
  ano: number;
  mes: number | null; // null = todos os meses
  cicloStatus: 'aberto' | 'fechado' | 'todos';
  fazendaId?: string | null;
  painelRetiroId?: string | null;
}

export function useGerenteData(filters?: GerenteFilters) {
  const { roleData } = useAuth();
  const fazendaId = filters?.fazendaId ?? roleData.fazendaId;
  const consumoMes = filters?.mes ?? new Date().getMonth() + 1;
  const consumoAno = filters?.ano ?? new Date().getFullYear();
  const { data: consumoData, loading: consumoLoading, refresh: refreshConsumo } = useConsumoMineral({
    fazendaId: fazendaId ?? "",
    mes: consumoMes,
    ano: consumoAno,
  });
  const formulas = useFormulasSistema();

  const [loading, setLoading] = useState(true);
  const [gerenteNome, setGerenteNome] = useState("");
  const [fazendaData, setFazendaData] = useState<FazendaRow>({ nome: '', intervalo_padrao_dias: 3 });
  const [ciclo, setCiclo] = useState<Ciclo | null>(null);
  const [ciclosDisponiveis, setCiclosDisponiveis] = useState<Ciclo[]>([]);
  const [retiros, setRetiros] = useState<Retiro[]>([]);
  const [pastos, setPastos] = useState<Pasto[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [observacoes, setObservacoes] = useState<Observacao[]>([]);

  const fazendaNome = fazendaData.nome;

  const loadData = useCallback(async () => {
    if (!fazendaId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [gerenteRes, fazendaRes, allCiclosRes, retirosRes] = await Promise.all([
        supabase.from("gerentes").select("nome").eq("id", roleData.roleId!).single(),
        supabase.from("fazendas").select("nome, intervalo_padrao_dias").eq("id", fazendaId).single(),
        supabase.from("ciclos").select("*").eq("fazenda_id", fazendaId)
          .order("ano", { ascending: false }).order("mes", { ascending: false }),
        supabase.from("retiros").select("id, nome, capataz, ultima_salga_em, alerta_atraso_enviado, produto_id").eq("fazenda_id", fazendaId).eq("ativo", true),
      ]);

      setGerenteNome(gerenteRes.data?.nome ?? "");
      const fData = fazendaRes.data as any;
      setFazendaData({ nome: fData?.nome ?? '', intervalo_padrao_dias: fData?.intervalo_padrao_dias ?? 3 });

      const allCiclos = (allCiclosRes.data ?? []) as Ciclo[];
      setCiclosDisponiveis(allCiclos);

      let activeCiclo: Ciclo | null = null;
      if (filters) {
        let filtered = allCiclos;
        filtered = filtered.filter(c => c.ano === filters.ano);
        if (filters.mes != null) {
          filtered = filtered.filter(c => c.mes === filters.mes);
        }
        if (filters.cicloStatus === 'aberto') {
          filtered = filtered.filter(c => !c.fechado);
        } else if (filters.cicloStatus === 'fechado') {
          filtered = filtered.filter(c => c.fechado);
        }
        activeCiclo = filtered[0] ?? null;
      } else {
        activeCiclo = allCiclos.find(c => !c.fechado) ?? null;
      }
      setCiclo(activeCiclo);

      const retirosList = (retirosRes.data ?? []).map((r: any) => ({
        id: r.id, nome: r.nome, capataz: r.capataz,
        ultima_salga_em: r.ultima_salga_em ?? null,
        alerta_atraso_enviado: r.alerta_atraso_enviado ?? false,
        produto_id: r.produto_id ?? null,
      })) as Retiro[];
      setRetiros(retirosList);

      const retiroIds = retirosList.map(r => r.id);
      if (retiroIds.length > 0) {
        const pastosRes = await supabase.from("pastos")
          .select("id, nome, retiro_id, num_animais, peso_medio_kg, gmd_kg_dia, peso_abate_meta_kg, produto_id")
          .in("retiro_id", retiroIds)
          .eq("ativo", true);
        const pastosList = (pastosRes.data ?? []) as Pasto[];
        setPastos(pastosList);

        let lancQuery = supabase.from("view_consumo_tempo_real" as any)
          .select("id, pasto_id, num_sacos, num_animais, peso_medio_kg, categoria, sexo, dias_no_pasto, created_at, mes_referencia, ano_referencia, fazenda_id, retiro_id, consumo_g_cab_dia, status_consumo, indice_consumo")
          .eq("fazenda_id", fazendaId);

        if (filters) {
          lancQuery = lancQuery.eq("ano_referencia", filters.ano);
          if (filters.mes != null) {
            lancQuery = lancQuery.eq("mes_referencia", filters.mes);
          }
        } else if (activeCiclo) {
          lancQuery = lancQuery.eq("mes_referencia", activeCiclo.mes).eq("ano_referencia", activeCiclo.ano);
        }

        const lancRes = await lancQuery;
        const lancList = ((lancRes.data as unknown) ?? []) as Lancamento[];
        setLancamentos(lancList);

        console.log(`[useGerenteData] mes=${filters?.mes ?? activeCiclo?.mes} ano=${filters?.ano ?? activeCiclo?.ano} fazenda=${fazendaId} → pastos=${pastosList.length} lancamentos=${lancList.length}`);
      } else {
        setPastos([]);
        setLancamentos([]);
      }

      const produtoIdsFazenda = await fetchProdutoIdsDaFazenda(fazendaId);
      let produtosQuery = supabase.from("produtos").select("id, peso_saco_kg, preco_por_kg");
      if (produtoIdsFazenda) produtosQuery = produtosQuery.in("id", produtoIdsFazenda);
      const produtosRes = await produtosQuery;
      setProdutos((produtosRes.data ?? []) as Produto[]);

      try {
        const obsRes = await (supabase as any).from("observacoes").select("*").eq("fazenda_id", fazendaId);
        setObservacoes((obsRes.data ?? []) as Observacao[]);
      } catch {
        setObservacoes([]);
      }
    } catch (e) {
      console.error("Error loading gerente data:", e);
    } finally {
      setLoading(false);
    }
  }, [fazendaId, roleData.roleId, filters?.ano, filters?.mes, filters?.cicloStatus]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime: auto-refresh when key tables change
  useRealtimeSync(["pastos", "lancamentos", "movimentacoes_animais", "abates", "mortalidades", "ciclos"], () => {
    loadData();
    refreshConsumo();
  });

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

  useEffect(() => {
    const channel = supabase.channel("gerente-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "lancamentos" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "observacoes" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "pastos" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "retiros" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "ciclos" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const painelData = useMemo<PainelData>(() => {
    // Fonte única: view_consumo_tempo_real (via `lancamentos` state).
    // Consumo Médio e Eficiência são computados aqui com a mesma fórmula
    // canônica usada no Painel de Detalhe do Retiro, PDF e Painel de
    // Inteligência Nutricional — garantindo que os 6 pontos convirjam.
    const painelConsumoData = filters?.painelRetiroId
      ? consumoData.filter(r => r.retiro_id === filters.painelRetiroId)
      : consumoData;
    const consumoAgg = aggregateConsumoMineral(painelConsumoData, formulas);
    const painelLancamentos = filters?.painelRetiroId
      ? lancamentos.filter(l => l.retiro_id === filters.painelRetiroId)
      : lancamentos;
    const painelPastos = filters?.painelRetiroId
      ? pastos.filter(p => p.retiro_id === filters.painelRetiroId)
      : pastos;
    const consumoMedio = computeConsumoMedioPonderado(
      painelLancamentos.map(l => ({ consumo_g_cab_dia: l.consumo_g_cab_dia, num_animais: l.num_animais }))
    );
    const indices = painelLancamentos
      .map(l => Number(l.indice_consumo ?? 0))
      .filter(v => v > 0);
    const indiceMedio = indices.length > 0 ? indices.reduce((a, b) => a + b, 0) / indices.length : 0;
    const eficiencia = indiceMedio > 0
      ? (formulas ? formulas.eficiencia.compute(indiceMedio) : indiceMedio * 100)
      : 0;
    const pastosComLancamento = new Set(painelLancamentos.map(l => l.pasto_id));
    const gmdValoresRetiro = painelPastos
      .filter(p => pastosComLancamento.has(p.id) && p.gmd_kg_dia != null && Number(p.gmd_kg_dia) > 0)
      .map(p => Number(p.gmd_kg_dia));
    const gmdMedio = filters?.painelRetiroId
      ? (gmdValoresRetiro.length > 0 ? gmdValoresRetiro.reduce((a, b) => a + b, 0) / gmdValoresRetiro.length : 0)
      : consumoAgg.gmdMedio;

    return {
      totalAnimais: painelPastos.reduce((s, p) => s + (p.num_animais || 0), 0),
      consumoMedio,
      pastosNaMeta: consumoAgg.pastosNaMeta,
      totalPastos: consumoAgg.totalPastos,
      sacosUtilizados: consumoAgg.sacosUtilizados,
      custoDiario: consumoAgg.custoDiario,
      custoMensal: consumoAgg.custoMensal,
      eficiencia,
      gmdMedio,
      statusDistribution: consumoAgg.statusDist,
    };
  }, [consumoData, formulas, lancamentos, pastos, filters?.painelRetiroId]);

  const retirosComDados = useMemo<RetiroComDados[]>(() => {
    const intervaloDefinido = fazendaData.intervalo_padrao_dias;
    const now = new Date();

    // Consumo/índice/dias já vêm ajustados dinamicamente pela view
    // `view_consumo_tempo_real` (fonte única de verdade no banco).
    // Consumo Médio do retiro = fórmula ponderada canônica sobre os
    // lançamentos da view — idêntica ao Painel de Detalhe.
    return retiros.map(r => {
      const rPastos = pastos.filter(p => p.retiro_id === r.id);
      const rLanc = lancamentos.filter(l => l.retiro_id === r.id);
      const rpcRow = consumoData.find(c => c.retiro_id === r.id);

      const consumoMedio = computeConsumoMedioPonderado(
        rLanc.map(l => ({ consumo_g_cab_dia: l.consumo_g_cab_dia, num_animais: l.num_animais }))
      );
      const sacosUtilizados = rpcRow ? Number(rpcRow.total_sacos) : rLanc.reduce((s, l) => s + (l.num_sacos || 0), 0);
      const gmd = rpcRow ? Number(rpcRow.gmd_medio) : 0;

      const sortedRLanc = [...rLanc].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
      const validIntervals = sortedRLanc
        .filter(item => item.dias_no_pasto > 0)
        .slice(0, 5)
        .map(item => item.dias_no_pasto);
      const intervaloRealMedio = validIntervals.length > 0
        ? Number((validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length).toFixed(1))
        : null;

      const ultimaSalga = r.ultima_salga_em;
      let diasSemSalga: number | null = null;
      if (ultimaSalga) {
        diasSemSalga = diasCalendarioSP(ultimaSalga, now);
      }

      const horaAtual = now.getHours();
      const alertaAtraso = diasSemSalga != null && diasSemSalga >= intervaloDefinido + 1 && horaAtual >= 6;

      const intervaloRealExibido = Math.max(intervaloRealMedio ?? 0, diasSemSalga ?? 0) || null;

      return {
        ...r,
        // Total de Animais = rebanho REAL (pastos.num_animais ativos).
        totalAnimais: rPastos.reduce((s, p) => s + (p.num_animais || 0), 0),
        sacosUtilizados,
        consumoMedio,
        gmd,
        pastos: rPastos,
        lancamentos: rLanc,
        intervaloDefinido,
        intervaloRealMedio: intervaloRealExibido,
        diasSemSalga,
        alertaAtraso,
        ultimaSalga,
      };
    });
  }, [retiros, pastos, lancamentos, consumoData, fazendaData]);

  // Computed: capataz scores
  const capatazScores = useMemo<CapatazScore[]>(() => {
    const numDias = ciclo?.duracao_dias ?? ciclo?.num_dias ?? 30;
    return retirosComDados.map(r => {
      const rLanc = r.lancamentos;
      // Simplified score - no consumo_g_cab_dia available
      const consumoScore = 0;
      const expected = r.pastos.length * (numDias / 3);
      const regScore = expected > 0 ? Math.min(1, rLanc.length / expected) * 2.5 : 0;
      const dates = rLanc.filter(l => l.created_at).map(l => new Date(l.created_at!).getTime()).sort((a, b) => a - b);
      let intScore = 0;
      if (dates.length >= 2) {
        const intervals: number[] = [];
        for (let i = 1; i < dates.length; i++) intervals.push(diasCalendarioSP(dates[i - 1], dates[i]) ?? 0);
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        intScore = avg <= 4 ? 2.5 : Math.max(0, 2.5 - (avg - 4) * 0.25);
      }
      return { retiro: r.nome, capataz: r.capataz, score: Number(Math.min(10, consumoScore + regScore + intScore).toFixed(1)) };
    }).sort((a, b) => b.score - a.score);
  }, [retirosComDados, ciclo]);

  const gmdRanking = useMemo<GmdRankItem[]>(() => {
    return retirosComDados
      .map(r => ({ retiro: r.nome, capataz: r.capataz, gmd: Number(r.gmd.toFixed(3)) }))
      .sort((a, b) => b.gmd - a.gmd);
  }, [retirosComDados]);

  // Alertas de atraso
  const alertasAtraso = useMemo<AlertaAtraso[]>(() => {
    return retirosComDados
      .filter(r => r.alertaAtraso && r.diasSemSalga != null)
      .map(r => {
        const excesso = r.diasSemSalga! - r.intervaloDefinido;
        const gravidade: AlertaAtraso['gravidade'] = excesso >= 3 ? 'critico' : excesso >= 2 ? 'moderado' : 'leve';
        return {
          retiroNome: r.nome,
          capataz: r.capataz,
          ultimaSalga: r.ultimaSalga,
          intervaloDefinido: r.intervaloDefinido,
          diasSemSalga: r.diasSemSalga!,
          gravidade,
        };
      });
  }, [retirosComDados]);

  // Push de salga atrasada é disparado pelo cron server-side
  // (public.verificar_salgas_atrasadas), escopado à fazenda do gerente.
  // Removido o envio client-side para evitar duplicação e evitar
  // enviar alerta a gerentes de outras fazendas.

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

  const refresh = useCallback(async () => {
    await Promise.all([loadData(), refreshConsumo()]);
  }, [loadData, refreshConsumo]);

  return {
    loading: loading || consumoLoading, gerenteNome, fazendaNome, ciclo, ciclosDisponiveis, painelData,
    retirosComDados, lancamentos, capatazScores, gmdRanking,
    obsPendentes, obsResolvidas, resolverObservacao, refresh,
    alertasAtraso, intervaloDefinido: fazendaData.intervalo_padrao_dias,
  };
}
