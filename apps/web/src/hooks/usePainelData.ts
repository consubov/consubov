import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { diasCalendarioSP } from "@/lib/diasCalendario";
import { supabase } from "@/integrations/supabase/client";
import { requireReadValue, requireReadRows, assertReadSuccess, dataReadErrorMessage } from "@/lib/dataReadGuard";
import { requireConsumoRows } from "@/lib/consumoViewReadGuard";
import { useConsumoMineral, aggregateConsumoMineral, type ConsumoMineralRetiro } from "@/hooks/useConsumoMineral";
import { useFormulasSistema } from "@/lib/formulasSistema";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { getScreenCache, setScreenCache, screenCacheKey, useResumeRefresh, useScreenCacheInvalidation } from "@/lib/screenCache";

interface PainelExtraCache { fazendaNome: string; retiros: Retiro[]; pastos: Pasto[]; lancamentos: Lancamento[]; consumoRealByRetiro: Record<string, number>; }

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
  consumo_g_cab_dia: number; // read directly from DB (may be dynamically recalculated for open periods)
  status_consumo: string | null;
  indice_consumo: number | null;
  /** created_at ISO of the lancamento (used for real-time open-period recalculation). */
  created_at: string | null;
  /** True when consumo/índice were recalculated dynamically for an open (awaiting next salga) period. */
  is_open_period?: boolean;
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

export function usePainelData(filters: PainelFilters, options?: { useFormulasSistema?: boolean }) {
  const { fazendaId, retiroId, mes, ano } = filters;
  const formulas = useFormulasSistema();
  const applyFormulas = options?.useFormulasSistema === true;
  const cacheKey = screenCacheKey("painelExtra", [fazendaId, retiroId, mes, ano]);
  const initialCache = getScreenCache<PainelExtraCache>(cacheKey);
  const [fazendaNome, setFazendaNome] = useState(initialCache?.fazendaNome ?? "");
  const [retiros, setRetiros] = useState<Retiro[]>(initialCache?.retiros ?? []);
  const [pastos, setPastos] = useState<Pasto[]>(initialCache?.pastos ?? []);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>(initialCache?.lancamentos ?? []);
  const [extraLoading, setExtraLoading] = useState(!initialCache);
  const [consumoRealByRetiro, setConsumoRealByRetiro] = useState<Record<string, number>>(initialCache?.consumoRealByRetiro ?? {});
  const [extraError, setExtraError] = useState<string | null>(null);
  const currentKey = useRef(cacheKey);
  currentKey.current = cacheKey;

  // ---------- Centralized RPC for consumption metrics ----------
  const { data: consumoData, loading: consumoLoading, error: consumoError, refresh: refreshConsumo } = useConsumoMineral({
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
    if (!getScreenCache(cacheKey)) setExtraLoading(true);
    const snap: PainelExtraCache = { fazendaNome: "", retiros: [], pastos: [], lancamentos: [], consumoRealByRetiro: {} };
    try {
      const [fazRes, retirosRes] = await Promise.all([
        supabase.from("fazendas").select("nome").eq("id", fazendaId).single(),
        supabase.from("retiros").select("id, nome, capataz, ultima_salga_em, produto_id")
          .eq("fazenda_id", fazendaId).eq("ativo", true),
      ]);

      snap.fazendaNome = requireReadValue(fazRes).nome;
      const allRetiros = requireReadRows(retirosRes) as Retiro[];
      const retList = retiroId ? allRetiros.filter((r) => r.id === retiroId) : allRetiros;
      snap.retiros = retList;

      let retiroIds = retList.map(r => r.id);
      // Never query a retiro outside the authorized farm scope.
      if (retiroId && !retList.length) retiroIds = [];

      if (retiroIds.length > 0) {
        const [pastosRes, lancRes] = await Promise.all([
          supabase.from("pastos")
            .select("id, nome, retiro_id, num_animais, peso_medio_kg, gmd_kg_dia, produto_id")
            .in("retiro_id", retiroIds)
            .eq("ativo", true),
          (() => {
            let q = supabase.from("view_consumo_tempo_real")
              .select("id, pasto_id, retiro_id, fazenda_id, num_sacos, num_animais, peso_medio_kg, dias_no_pasto, created_at, mes_referencia, ano_referencia, consumo_g_cab_dia, status_consumo, indice_consumo, categoria, sexo")
              .eq("fazenda_id", fazendaId)
              .eq("ano_referencia", ano)
              .eq("mes_referencia", mes);
            if (retiroId) q = q.eq("retiro_id", retiroId);
            return q;
          })(),
        ]);
        snap.pastos = requireReadRows(pastosRes) as Pasto[];
        snap.lancamentos = requireConsumoRows(requireReadRows(lancRes), fazendaId, retiroIds);

        // Consumo canônico por retiro: RPC get_painel_mae (ponderado por cab-dias)
        const entries = await Promise.all(retiroIds.map(async (rid) => {
          const { data: rows, error: rpcError } = await (supabase as any).rpc("get_painel_mae", {
            p_fazenda_id: fazendaId,
            p_retiro_id: rid,
            p_mes: mes,
            p_ano: ano,
          });
          assertReadSuccess({ error: rpcError });
          const row = Array.isArray(rows) ? rows[0] : rows;
          return [rid, Number(row?.consumo_real_g_cab_dia) || 0] as const;
        }));
        snap.consumoRealByRetiro = Object.fromEntries(entries);

      }
      if (currentKey.current !== cacheKey) return;
      setScreenCache(cacheKey, snap);
      setFazendaNome(snap.fazendaNome);
      setRetiros(snap.retiros);
      setPastos(snap.pastos);
      setLancamentos(snap.lancamentos);
      setConsumoRealByRetiro(snap.consumoRealByRetiro);
      setExtraError(null);
    } catch (e) {
      if (currentKey.current === cacheKey) setExtraError(dataReadErrorMessage(e));
    } finally {
      if (currentKey.current === cacheKey) setExtraLoading(false);
    }
  }, [fazendaId, retiroId, mes, ano, cacheKey]);

  useEffect(() => {
    const c = getScreenCache<PainelExtraCache>(cacheKey);
    setFazendaNome(c?.fazendaNome ?? ""); setRetiros(c?.retiros ?? []); setPastos(c?.pastos ?? []);
    setLancamentos(c?.lancamentos ?? []); setConsumoRealByRetiro(c?.consumoRealByRetiro ?? {});
    setExtraError(null); setExtraLoading(!c);
    void loadExtraData();
  }, [loadExtraData, cacheKey]);

  useRealtimeSync(["pastos", "lancamentos", "movimentacoes_animais", "abates", "mortalidades", "ciclos"], () => {
    loadExtraData();
    refreshConsumo();
  });

  // O consumo (useConsumoMineral) cuida do próprio retorno ao app.
  useResumeRefresh(() => { void loadExtraData(); });
  useScreenCacheInvalidation(() => { void loadExtraData(); });

  const loading = consumoLoading || extraLoading;

  // ---------- Metrics: from centralized RPC ----------
  const metrics = useMemo<PainelMetrics>(() => {
    // Real occupancy comes from pastos and must not be set to zero just
    // because a period has no consumption records.
    if (consumoData.length === 0) return { ...emptyMetrics, totalAnimais: pastos.reduce((sum, p) => sum + (p.num_animais || 0), 0) };
    const agg = aggregateConsumoMineral(consumoData, applyFormulas ? formulas : undefined);
    // Total Animais = rebanho REAL (fonte única = pastos.num_animais ativos),
    // mesma contagem do mapa do Capataz. Não deriva de lançamentos.
    const totalAnimaisReal = pastos.reduce((s, p) => s + (p.num_animais || 0), 0);
    return {
      totalAnimais: totalAnimaisReal,
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
  }, [consumoData, applyFormulas, formulas, pastos]);

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
        diasSemSalga = diasCalendarioSP(r.ultima_salga_em, now);
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
          created_at: l.created_at,
        };
        const list = pastosConsumo.get(l.pasto_id) ?? [];
        list.push(entry);
        pastosConsumo.set(l.pasto_id, list);
      }

      // Valores de consumo/índice/dias já vêm ajustados dinamicamente pela
      // view `view_consumo_tempo_real` (fonte única de verdade no banco).



      // Consumo Médio do retiro = fórmula canônica sobre pastosConsumo (já
      // com recálculo dinâmico do período aberto aplicado acima). Isso garante
      // que a Aba Retiros (lista) e o Painel de Detalhe mostrem exatamente o
      // mesmo número no mesmo instante.
      const consumoMedioDinamico = consumoRealByRetiro[r.id] ?? 0;

      return {
        id: r.id,
        nome: r.nome,
        capataz: r.capataz,
        totalAnimais: rPastos.reduce((s, p) => s + (p.num_animais || 0), 0),
        sacosUtilizados: rpcRow ? Number(rpcRow.total_sacos) : rLanc.reduce((s, l) => s + l.num_sacos, 0),
        consumoMedio: consumoMedioDinamico,
        gmd: rpcRow ? Number(rpcRow.gmd_medio) : 0,
        diasSemSalga,
        lancamentos: rLanc,
        pastos: rPastos,
        pastosConsumo,
      };
    });
  }, [retiros, pastos, lancamentos, consumoData, consumoRealByRetiro]);

  const refresh = useCallback(async () => {
    await Promise.all([loadExtraData(), refreshConsumo()]);
  }, [loadExtraData, refreshConsumo]);

  return {
    loading, error: extraError || consumoError, fazendaNome, metrics, retirosResumo, lancamentos, refresh,
  };
}
