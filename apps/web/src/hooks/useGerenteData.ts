import { dataReferenciaGmd, fetchGmdPastos, gmdPonderado } from "@/lib/gmdConfigurado";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { diasCalendarioSP } from "@/lib/diasCalendario";
import { fetchScoresCapataz } from "@/lib/scoreCapatazData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { computeConsumoMedioPonderado } from "@/lib/painelMetrics";
import { aggregateConsumoMineral, useConsumoMineral } from "@/hooks/useConsumoMineral";
import { usePainelMae } from "@/hooks/usePainelMae";
import { useFormulasSistema } from "@/lib/formulasSistema";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { confirmObservationRead, confirmObservationResolved, isObservationContextCurrent } from "@/lib/observacoesGuard";
import { toast } from "sonner";
import { fetchProdutoIdsDaFazenda } from "@/lib/produtosFazenda";
import { getScreenCache, setScreenCache, screenCacheKey, useResumeRefresh, useScreenCacheInvalidation } from "@/lib/screenCache";
// Push de salga atrasada agora é disparado pelo cron server-side
// (verificar_salgas_atrasadas), escopado à fazenda do gerente.

// ---------- Types ----------
interface Retiro { id: string; nome: string; capataz: string; ultima_salga_em: string | null; alerta_atraso_enviado: boolean; produto_id: string | null; intervalo_padrao_dias?: number | null; }
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
  consumoMedio: number; gmd: number | null; pastos: Pasto[];
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
  custoMensal: number; eficiencia: number; gmdMedio: number | null;
  statusDistribution: StatusDistribution;
}

export interface CapatazScore {
  retiroId: string; retiro: string; capataz: string; score: number;
  scoreMeta: number; scoreSalga: number; scoreCocho: number | null;
  pesoMeta: number; pesoSalga: number; pesoCocho: number;
  detalheMeta: string; detalheSalga: string; detalheCocho: string;
}
export interface GmdRankItem { retiro: string; capataz: string; gmd: number | null; animais: number; }

interface GerenteCache {
  gerenteNome: string; fazendaData: FazendaRow; ciclo: Ciclo | null; ciclosDisponiveis: Ciclo[];
  retiros: Retiro[]; pastos: Pasto[]; lancamentos: Lancamento[]; produtos: Produto[]; observacoes: Observacao[];
}

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
  // Eficiência: fonte única get_painel_mae (mesma do Painel do Retiro/Fazenda).
  const { painelMae } = usePainelMae(
    fazendaId ?? null,
    filters?.painelRetiroId ?? null,
    consumoMes,
    consumoAno,
  );

  const cacheKey = screenCacheKey("gerente", [fazendaId, roleData.roleId, filters?.ano, filters?.mes, filters?.cicloStatus]);
  const ic = getScreenCache<GerenteCache>(cacheKey);
  const activeCacheKey = useRef("");
  const loadSequence = useRef(0);
  const resolvingIds = useRef(new Set<string>());
  const [appliedCacheKey, setAppliedCacheKey] = useState(ic ? cacheKey : "");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!ic);
  const [gerenteNome, setGerenteNome] = useState(ic?.gerenteNome ?? "");
  const [fazendaData, setFazendaData] = useState<FazendaRow>(ic?.fazendaData ?? { nome: '', intervalo_padrao_dias: 3 });
  const [ciclo, setCiclo] = useState<Ciclo | null>(ic?.ciclo ?? null);
  const [ciclosDisponiveis, setCiclosDisponiveis] = useState<Ciclo[]>(ic?.ciclosDisponiveis ?? []);
  const [retiros, setRetiros] = useState<Retiro[]>(ic?.retiros ?? []);
  const [pastos, setPastos] = useState<Pasto[]>(ic?.pastos ?? []);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>(ic?.lancamentos ?? []);
  const [produtos, setProdutos] = useState<Produto[]>(ic?.produtos ?? []);
  const [observacoes, setObservacoes] = useState<Observacao[]>(ic?.observacoes ?? []);

  const applyCache = useCallback((c: GerenteCache, forKey: string) => {
    if (activeCacheKey.current !== forKey) return;
    setGerenteNome(c.gerenteNome); setFazendaData(c.fazendaData); setCiclo(c.ciclo);
    setCiclosDisponiveis(c.ciclosDisponiveis); setRetiros(c.retiros); setPastos(c.pastos);
    setLancamentos(c.lancamentos); setProdutos(c.produtos); setObservacoes(c.observacoes);
    setAppliedCacheKey(forKey);
  }, []);

  const fazendaNome = fazendaData.nome;

  const loadData = useCallback(async () => {
    const requestId = ++loadSequence.current;
    const isCurrent = () => isObservationContextCurrent(
      cacheKey, activeCacheKey.current, requestId, loadSequence.current,
    );
    if (!fazendaId) {
      if (isCurrent()) { setLoading(false); setLoadError(null); }
      return;
    }
    if (!getScreenCache(cacheKey) && isCurrent()) setLoading(true);
    const snap: GerenteCache = { gerenteNome: "", fazendaData: { nome: "", intervalo_padrao_dias: 3 }, ciclo: null, ciclosDisponiveis: [], retiros: [], pastos: [], lancamentos: [], produtos: [], observacoes: [] };
    try {
      const [gerenteRes, fazendaRes, allCiclosRes, retirosRes] = await Promise.all([
        supabase.from("gerentes").select("nome").eq("id", roleData.roleId!).single(),
        supabase.from("fazendas").select("nome, intervalo_padrao_dias").eq("id", fazendaId).single(),
        supabase.from("ciclos").select("*").eq("fazenda_id", fazendaId)
          .order("ano", { ascending: false }).order("mes", { ascending: false }),
        supabase.from("retiros").select("id, nome, capataz, ultima_salga_em, alerta_atraso_enviado, produto_id, intervalo_padrao_dias").eq("fazenda_id", fazendaId).eq("ativo", true),
      ]);

      snap.gerenteNome = (gerenteRes.data?.nome ?? "");
      const fData = fazendaRes.data;
      snap.fazendaData = ({ nome: fData?.nome ?? '', intervalo_padrao_dias: fData?.intervalo_padrao_dias ?? 3 });

      const allCiclos = (allCiclosRes.data ?? []) as Ciclo[];
      snap.ciclosDisponiveis = (allCiclos);

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
      snap.ciclo = (activeCiclo);

      const retirosList = (retirosRes.data ?? []).map((r) => ({
        id: r.id, nome: r.nome, capataz: r.capataz,
        ultima_salga_em: r.ultima_salga_em ?? null,
        alerta_atraso_enviado: r.alerta_atraso_enviado ?? false,
        produto_id: r.produto_id ?? null,
        intervalo_padrao_dias: r.intervalo_padrao_dias ?? null,
      })) as Retiro[];
      snap.retiros = (retirosList);

      const retiroIds = retirosList.map(r => r.id);
      if (retiroIds.length > 0) {
        const pastosRes = await supabase.from("pastos")
          .select("id, nome, retiro_id, num_animais, peso_medio_kg, gmd_kg_dia, peso_abate_meta_kg, produto_id")
          .in("retiro_id", retiroIds)
          .eq("ativo", true);
        const pastosList = (pastosRes.data ?? []) as Pasto[];
        snap.pastos = (pastosList);

        let lancQuery = supabase.from("view_consumo_tempo_real")
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
        snap.lancamentos = (lancList);

      } else {
        snap.pastos = ([]);
        snap.lancamentos = ([]);
      }

      const produtoIdsFazenda = await fetchProdutoIdsDaFazenda(fazendaId);
      let produtosQuery = supabase.from("produtos").select("id, peso_saco_kg, preco_por_kg");
      if (produtoIdsFazenda) produtosQuery = produtosQuery.in("id", produtoIdsFazenda);
      const produtosRes = await produtosQuery;
      snap.produtos = ((produtosRes.data ?? []) as Produto[]);

      const obsRes = await supabase.from("observacoes").select("*").eq("fazenda_id", fazendaId);
      snap.observacoes = confirmObservationRead(obsRes, fazendaId);
      // Never publish an old tenant response or cache a failed SELECT as empty data.
      if (!isCurrent()) return;
      setScreenCache(cacheKey, snap);
      applyCache(snap, cacheKey);
      setLoadError(null);
    } catch (e) {
      if (isCurrent()) {
        setLoadError("Não foi possível confirmar os dados da fazenda. Tente novamente.");
        console.error("Error loading gerente data:", e);
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [fazendaId, roleData.roleId, filters?.ano, filters?.mes, filters?.cicloStatus, cacheKey, applyCache]);

  useEffect(() => {
    activeCacheKey.current = cacheKey;
    const c = getScreenCache<GerenteCache>(cacheKey);
    if (c) { applyCache(c, cacheKey); setLoading(false); }
    else { setAppliedCacheKey(""); setLoading(true); }
    setLoadError(null);
    void loadData();
    return () => {
      loadSequence.current++;
      activeCacheKey.current = "";
    };
  }, [loadData, cacheKey, applyCache]);

  // Realtime: auto-refresh when key tables change
  useRealtimeSync(["pastos", "lancamentos", "movimentacoes_animais", "abates", "mortalidades", "ciclos"], () => {
    loadData();
    refreshConsumo();
  });

  // Volta do segundo plano: uma única atualização silenciosa após 5 min.
  useResumeRefresh(() => { void loadData(); });
  useScreenCacheInvalidation(() => { void loadData(); });

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

  // GMD de cada pasto via gmd_do_pasto (hoje no mês em andamento; último dia em meses passados).
  const [gmdPastos, setGmdPastos] = useState<Record<string, number | null>>({});
  const gmdPastoIds = pastos.map(p => p.id).join(",");
  useEffect(() => {
    if (!gmdPastoIds) { setGmdPastos({}); return; }
    let cancel = false;
    const dia = dataReferenciaGmd(filters ? filters.mes : consumoMes, consumoAno);
    fetchGmdPastos(gmdPastoIds.split(","), dia)
      .then((m) => { if (!cancel) setGmdPastos(m); })
      .catch((e) => console.error("GMD pastos error:", e));
    return () => { cancel = true; };
  }, [gmdPastoIds, filters?.mes, consumoMes, consumoAno]);

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
    // Eficiência vem de get_painel_mae: por pasto 100 - |1 - índice global| x 100,
    // ponderada por cabeças-dia — idêntica ao Painel do Retiro/Fazenda.
    const eficiencia = painelMae.eficiencia;
    // GMD configurado (projeção): gmd_do_pasto, ponderado por animais.
    const gmdMedio = gmdPonderado(painelPastos, gmdPastos);

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
  }, [consumoData, formulas, lancamentos, pastos, filters?.painelRetiroId, painelMae.eficiencia, gmdPastos]);

  const retirosComDados = useMemo<RetiroComDados[]>(() => {
    const intervaloFazenda = fazendaData.intervalo_padrao_dias;
    const now = new Date();

    // Consumo/índice/dias já vêm ajustados dinamicamente pela view
    // `view_consumo_tempo_real` (fonte única de verdade no banco).
    // Consumo Médio do retiro = fórmula ponderada canônica sobre os
    // lançamentos da view — idêntica ao Painel de Detalhe.
    return retiros.map(r => {
      const rPastos = pastos.filter(p => p.retiro_id === r.id);
      const rLanc = lancamentos.filter(l => l.retiro_id === r.id);
      const rpcRow = consumoData.find(c => c.retiro_id === r.id);
      // Intervalo do retiro (retiros.intervalo_padrao_dias), com a fazenda como reserva.
      const intervaloDefinido = Number(r.intervalo_padrao_dias ?? intervaloFazenda);

      const consumoMedio = computeConsumoMedioPonderado(
        rLanc.map(l => ({ consumo_g_cab_dia: l.consumo_g_cab_dia, num_animais: l.num_animais }))
      );
      const sacosUtilizados = rpcRow ? Number(rpcRow.total_sacos) : rLanc.reduce((s, l) => s + (l.num_sacos || 0), 0);
      const gmd = gmdPonderado(rPastos, gmdPastos);

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
  }, [retiros, pastos, lancamentos, consumoData, fazendaData, gmdPastos]);

  // Nota do Capataz: fonte única compartilhada com a Seção 2 do PDF.
  const [capatazScores, setCapatazScores] = useState<CapatazScore[]>([]);
  const [scoresTick, setScoresTick] = useState(0);
  useEffect(() => {
    if (!fazendaId) { setCapatazScores([]); return; }
    let cancelled = false;
    const anual = filters != null && filters.mes == null;
    const start = anual ? new Date(consumoAno, 0, 1) : new Date(consumoAno, consumoMes - 1, 1);
    const end = anual ? new Date(consumoAno, 11, 31, 23, 59, 59) : new Date(consumoAno, consumoMes, 0, 23, 59, 59);
    fetchScoresCapataz({
      fazendaId, start, end,
      periodo: anual ? "anual" : "mensal",
      mes: consumoMes, ano: consumoAno,
    }).then(({ list }) => {
      if (cancelled) return;
      setCapatazScores(list.map((s) => ({
        retiroId: s.retiroId, retiro: s.retiro, capataz: s.capataz, score: s.score,
        scoreMeta: Number(s.result.scoreMeta.toFixed(1)),
        scoreSalga: Number(s.result.scoreSalga.toFixed(1)),
        scoreCocho: s.result.scoreCocho != null ? Number(s.result.scoreCocho.toFixed(1)) : null,
        pesoMeta: s.result.pesoMeta, pesoSalga: s.result.pesoSalga, pesoCocho: s.result.pesoCocho,
        detalheMeta: s.result.detalheMeta, detalheSalga: s.result.detalheSalga, detalheCocho: s.result.detalheCocho,
      })));
    }).catch((e) => console.error("Score capataz error:", e));
    return () => { cancelled = true; };
  }, [fazendaId, consumoMes, consumoAno, filters?.mes, scoresTick]);

  const gmdRanking = useMemo<GmdRankItem[]>(() => {
    return retirosComDados
      .map(r => ({ retiro: r.nome, capataz: r.capataz, gmd: r.gmd == null ? null : Number(r.gmd.toFixed(3)), animais: r.totalAnimais }))
      .sort((a, b) => (b.gmd ?? -Infinity) - (a.gmd ?? -Infinity) || b.animais - a.animais);
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

  // Frontend ACK is a UX safeguard, not authorization: the database must enforce RLS.
  const resolverObservacao = useCallback(async (id: string, resolvidoPor: string) => {
    if (!id || !fazendaId || appliedCacheKey !== cacheKey ||
        !observacoes.some(o => o.id === id && o.fazenda_id === fazendaId && !o.resolvido)) {
      toast.error("Observação indisponível para esta fazenda.");
      return;
    }
    if (resolvingIds.current.has(id)) return;
    resolvingIds.current.add(id);
    const contextAtStart = cacheKey;
    const loadAtStart = loadSequence.current;
    try {
      const response = await supabase.from("observacoes")
        .update({ resolvido: true, resolvido_por: resolvidoPor, resolvido_em: new Date().toISOString() })
        .eq("id", id).eq("fazenda_id", fazendaId)
        .select("id, fazenda_id, resolvido, resolvido_em, resolvido_por");
      const confirmed = confirmObservationResolved(response, id, fazendaId);
      if (!isObservationContextCurrent(contextAtStart, activeCacheKey.current,
          loadAtStart, loadSequence.current)) return;
      const updateRows = (list: Observacao[]) => list.map(o =>
        o.id === id && o.fazenda_id === fazendaId ? { ...o, ...confirmed } : o
      );
      setObservacoes(updateRows);
      const cached = getScreenCache<GerenteCache>(contextAtStart);
      if (cached) setScreenCache(contextAtStart, { ...cached, observacoes: updateRows(cached.observacoes) });
      toast.success("Observação resolvida");
    } catch {
      if (activeCacheKey.current === contextAtStart) {
        toast.error("Resolução não confirmada pelo banco. Atualize e tente novamente.");
      }
    } finally {
      resolvingIds.current.delete(id);
    }
  }, [fazendaId, cacheKey, appliedCacheKey, observacoes]);

  const scopedObservacoes = appliedCacheKey === cacheKey ? observacoes : [];
  const obsPendentes = useMemo(() => scopedObservacoes.filter(o => !o.resolvido).sort((a, b) => new Date(b.criado_em ?? 0).getTime() - new Date(a.criado_em ?? 0).getTime()), [scopedObservacoes]);
  const obsResolvidas = useMemo(() => scopedObservacoes.filter(o => o.resolvido).sort((a, b) => new Date(b.resolvido_em ?? 0).getTime() - new Date(a.resolvido_em ?? 0).getTime()), [scopedObservacoes]);

  const refresh = useCallback(async () => {
    setScoresTick((t) => t + 1);
    await Promise.all([loadData(), refreshConsumo()]);
  }, [loadData, refreshConsumo]);

  return {
    loading: loading || consumoLoading || (!!fazendaId && appliedCacheKey !== cacheKey),
    loadError, hasCurrentCache: appliedCacheKey === cacheKey,
    gerenteNome, fazendaNome, ciclo, ciclosDisponiveis, painelData,
    retirosComDados, lancamentos, capatazScores, gmdRanking,
    obsPendentes, obsResolvidas, resolverObservacao, refresh,
    alertasAtraso, intervaloDefinido: fazendaData.intervalo_padrao_dias,
  };
}
