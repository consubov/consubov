import { dataReferenciaGmd, fetchGmdPastos, gmdPonderado } from "@/lib/gmdConfigurado";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { diasCalendarioSP } from "@/lib/diasCalendario";
import { fetchScoresCapataz } from "@/lib/scoreCapatazData";
import { supabase } from "@/integrations/supabase/client";
import { requireReadValue, requireReadRows, DataReadFailure, dataReadErrorMessage } from "@/lib/dataReadGuard";
import { useAuth } from "@/hooks/useAuth";
import { computeConsumoMedioPonderado } from "@/lib/painelMetrics";
import { aggregateConsumoMineral, useConsumoMineral } from "@/hooks/useConsumoMineral";
import { usePainelMae } from "@/hooks/usePainelMae";
import { useFormulasSistema } from "@/lib/formulasSistema";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { fetchProdutoIdsDaFazenda } from "@/lib/produtosFazenda";
import { getScreenCache, setScreenCache, screenCacheKey, useResumeRefresh, useScreenCacheInvalidation } from "@/lib/screenCache";
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
  const { data: consumoData, loading: consumoLoading, error: consumoError, refresh: refreshConsumo } = useConsumoMineral({
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
  const [loading, setLoading] = useState(!ic);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Tag the loaded snapshot so old farm data never drives a new farm\u0027s GMD requests.
  const [loadedCacheKey, setLoadedCacheKey] = useState(ic ? cacheKey : "");
  const currentKey = useRef(cacheKey);
  currentKey.current = cacheKey;
  const [gerenteNome, setGerenteNome] = useState(ic?.gerenteNome ?? "");
  const [fazendaData, setFazendaData] = useState<FazendaRow>(ic?.fazendaData ?? { nome: '', intervalo_padrao_dias: 3 });
  const [ciclo, setCiclo] = useState<Ciclo | null>(ic?.ciclo ?? null);
  const [ciclosDisponiveis, setCiclosDisponiveis] = useState<Ciclo[]>(ic?.ciclosDisponiveis ?? []);
  const [retiros, setRetiros] = useState<Retiro[]>(ic?.retiros ?? []);
  const [pastos, setPastos] = useState<Pasto[]>(ic?.pastos ?? []);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>(ic?.lancamentos ?? []);
  const [produtos, setProdutos] = useState<Produto[]>(ic?.produtos ?? []);
  const [observacoes, setObservacoes] = useState<Observacao[]>(ic?.observacoes ?? []);

  const applyCache = useCallback((c: GerenteCache) => {
    setGerenteNome(c.gerenteNome); setFazendaData(c.fazendaData); setCiclo(c.ciclo);
    setCiclosDisponiveis(c.ciclosDisponiveis); setRetiros(c.retiros); setPastos(c.pastos);
    setLancamentos(c.lancamentos); setProdutos(c.produtos); setObservacoes(c.observacoes);
  }, []);

  const fazendaNome = fazendaData.nome;

  const loadData = useCallback(async () => {
    if (!fazendaId) { setLoading(false); return; }
    if (!getScreenCache(cacheKey)) setLoading(true);
    const snap: GerenteCache = { gerenteNome: "", fazendaData: { nome: "", intervalo_padrao_dias: 3 }, ciclo: null, ciclosDisponiveis: [], retiros: [], pastos: [], lancamentos: [], produtos: [], observacoes: [] };
    try {
      const [gerenteRes, fazendaRes, allCiclosRes, retirosRes] = await Promise.all([
        supabase.from("gerentes").select("nome").eq("id", roleData.roleId!).single(),
        supabase.from("fazendas").select("nome, intervalo_padrao_dias").eq("id", fazendaId).single(),
        supabase.from("ciclos").select("*").eq("fazenda_id", fazendaId)
          .order("ano", { ascending: false }).order("mes", { ascending: false }),
        supabase.from("retiros").select("id, nome, capataz, ultima_salga_em, alerta_atraso_enviado, produto_id, intervalo_padrao_dias" as any).eq("fazenda_id", fazendaId).eq("ativo", true),
      ]);

      snap.gerenteNome = requireReadValue(gerenteRes).nome;
      const fData = requireReadValue(fazendaRes);
      snap.fazendaData = ({ nome: fData.nome, intervalo_padrao_dias: fData.intervalo_padrao_dias ?? 3 });

      const allCiclos = requireReadRows(allCiclosRes) as Ciclo[];
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

      const retirosList = requireReadRows(retirosRes).map((r: any) => ({
        id: r.id, nome: r.nome, capataz: r.capataz,
        ultima_salga_em: r.ultima_salga_em ?? null,
        alerta_atraso_enviado: r.alerta_atraso_enviado ?? false,
        produto_id: r.produto_id ?? null,
      })) as Retiro[];
      snap.retiros = (retirosList);

      const retiroIds = retirosList.map(r => r.id);
      if (retiroIds.length > 0) {
        const pastosRes = await supabase.from("pastos")
          .select("id, nome, retiro_id, num_animais, peso_medio_kg, gmd_kg_dia, peso_abate_meta_kg, produto_id")
          .in("retiro_id", retiroIds)
          .eq("ativo", true);
        const pastosList = requireReadRows(pastosRes) as Pasto[];
        snap.pastos = (pastosList);

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
        const lancList = requireReadRows(lancRes) as Lancamento[];
        snap.lancamentos = (lancList);


      } else {
        snap.pastos = ([]);
        snap.lancamentos = ([]);
      }

      const produtoIdsFazenda = await fetchProdutoIdsDaFazenda(fazendaId);
      // A failed link read must NEVER turn into an unscoped products query.
      if (produtoIdsFazenda === null) throw new DataReadFailure("unavailable");
      if (produtoIdsFazenda.length) {
        const produtosRes = await supabase.from("produtos")
          .select("id, peso_saco_kg, preco_por_kg").in("id", produtoIdsFazenda);
        snap.produtos = requireReadRows(produtosRes) as Produto[];
      } else snap.produtos = [];

      const obsRes = await (supabase as any).from("observacoes").select("*").eq("fazenda_id", fazendaId);
      snap.observacoes = requireReadRows(obsRes) as Observacao[];
      if (currentKey.current !== cacheKey) return;
      setScreenCache(cacheKey, snap);
      applyCache(snap);
      setLoadedCacheKey(cacheKey);
      setLoadError(null);
    } catch (e) {
      if (currentKey.current === cacheKey) setLoadError(dataReadErrorMessage(e));
    } finally {
      if (currentKey.current === cacheKey) setLoading(false);
    }
  }, [fazendaId, roleData.roleId, filters?.ano, filters?.mes, filters?.cicloStatus, cacheKey, applyCache]);

  useEffect(() => {
    const c = getScreenCache<GerenteCache>(cacheKey);
    if (c) { applyCache(c); setLoadedCacheKey(cacheKey); setLoading(false); }
    else {
      setLoadedCacheKey("");
      applyCache({ gerenteNome: "", fazendaData: { nome: "", intervalo_padrao_dias: 3 }, ciclo: null, ciclosDisponiveis: [], retiros: [], pastos: [], lancamentos: [], produtos: [], observacoes: [] });
      setLoading(true);
    }
    setLoadError(null);
    void loadData();
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

  // GMD is independent from other farm metrics: isolate scope, cancel obsolete
  // requests and surface failures instead of silently treating them as no GMD.
  const [gmdState, setGmdState] = useState<{
    scope: string; values: Record<string, number | null>; error: string | null;
  }>({ scope: "", values: {}, error: null });
  const [gmdRetryTick, setGmdRetryTick] = useState(0);
  const retryGmd = useCallback(() => setGmdRetryTick(t => t + 1), []);
  const gmdPastoIds = loadedCacheKey === cacheKey ? pastos.map(p => p.id).join(",") : "";
  const gmdDia = dataReferenciaGmd(filters ? filters.mes : consumoMes, consumoAno);
  const gmdScope = JSON.stringify([roleData.roleId, fazendaId, gmdPastoIds, gmdDia]);
  const gmdPastos = gmdState.scope === gmdScope ? gmdState.values : {};
  const gmdError = gmdState.scope === gmdScope ? gmdState.error : null;

  useEffect(() => {
    const controller = new AbortController();
    setGmdState({ scope: gmdScope, values: {}, error: null });
    if (!fazendaId || !gmdPastoIds) return () => controller.abort();

    fetchGmdPastos(gmdPastoIds.split(","), gmdDia, controller.signal)
      .then(values => {
        if (!controller.signal.aborted) {
          setGmdState({ scope: gmdScope, values, error: null });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setGmdState({
            scope: gmdScope, values: {},
            error: "Não foi possível confirmar o GMD. Tente novamente.",
          });
        }
      });
    return () => controller.abort();
  }, [gmdScope, gmdPastoIds, gmdDia, fazendaId, gmdRetryTick]);

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
      const intervaloDefinido = Number((r as any).intervalo_padrao_dias ?? intervaloFazenda);

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
    setScoresTick((t) => t + 1);
    await Promise.all([loadData(), refreshConsumo()]);
  }, [loadData, refreshConsumo]);

  return {
    loading: loading || consumoLoading, error: loadError || consumoError, gmdError, retryGmd, gerenteNome, fazendaNome, ciclo, ciclosDisponiveis, painelData,
    retirosComDados, lancamentos, capatazScores, gmdRanking,
    obsPendentes, obsResolvidas, resolverObservacao, refresh,
    alertasAtraso, intervaloDefinido: fazendaData.intervalo_padrao_dias,
  };
}
