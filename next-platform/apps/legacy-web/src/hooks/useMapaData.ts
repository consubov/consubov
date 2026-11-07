import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { RequestTimeoutError, runWithDeadline } from "@/lib/requestDeadline";

export interface PastoMapaData {
  id: string;
  pasto_id: string;
  coordenadas: number[][];
  cor: string;
  pasto_nome: string;
  num_animais: number;
  peso_medio_kg: number | null;
  categoria: string | null;
  sexo: string | null;
  consumo_medio: number | null; // consumo global g/cab/dia
  status_consumo: string | null; // status global
  ultima_movimentacao: string | null;
  ultima_salga: string | null;
  ultima_salga_sacos?: number | null;
  ultimo_cocho_cheio?: string | null;
  ultima_visita_tipo?: "salga" | "cocho_cheio" | null;
  data_fim_carencia: string | null;
  label_offset_x: number;
  label_offset_y: number;
  label_rotation: number;
}


export interface LinhaMapaData {
  id: string;
  coordenadas: number[][];
  cor: string;
  tipo: string;
  rotulo: string | null;
}

export interface ElementoMapaData {
  id: string;
  tipo: string;
  emoji: string;
  posicao_x: number;
  posicao_y: number;
  rotulo: string | null;
}

export interface MapaData {
  id: string;
  fazenda_id: string;
  imagem_url: string;
  pastos: PastoMapaData[];
  linhas: LinhaMapaData[];
  elementos: ElementoMapaData[];
}

const MAP_LOAD_ERROR = "Não foi possível carregar o mapa. Verifique a conexão e seu acesso ao retiro.";
const MAP_PARTIAL_WARNING = "Alguns indicadores do mapa não puderam ser atualizados. A imagem e os dados confirmados permanecem disponíveis.";
const MAP_DRAWINGS_WARNING = "Não foi possível atualizar os desenhos do mapa. A imagem continua disponível; tente atualizar novamente.";
const MAP_PARTIAL_DRAWINGS_WARNING = "Algumas linhas ou marcações do mapa não puderam ser atualizadas. Os pastos confirmados continuam visíveis.";
const OPTIONAL_QUERY_TIMEOUT_MS = 4500;
// The production map endpoint has returned after the former 6500 ms cutoff.
// Keep the primary map read separate from slow, optional indicators.
const MAP_READ_TIMEOUT_MS = 11000;
const MAP_RETRY_TIMEOUT_MS = 8000;
const MAP_RETRY_PAUSE_MS = 300;
const MAP_REVALIDATION_WARNING = "A imagem já carregada continua disponível, mas não foi possível confirmar os dados atuais. Tente novamente.";

function isTransientMapReadError(error: unknown, httpStatus?: number): boolean {
  if (httpStatus === 401 || httpStatus === 403) return false;
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: unknown; status?: unknown; message?: unknown };
  if (value.code === "42501" || value.status === 401 || value.status === 403) return false;
  if (error instanceof RequestTimeoutError) return true;
  if (typeof httpStatus === "number" && (httpStatus === 0 || httpStatus >= 500)) return true;
  if (value.code === "57014" || value.code === "PGRST000"
    || value.code === "PGRST001" || value.code === "PGRST002") return true;
  if (typeof value.status === "number" && (value.status === 0 || value.status >= 500)) return true;
  return typeof value.message === "string"
    && /failed to fetch|load failed|networkerror|network request failed|network connection was lost/i.test(value.message);
}

export function normalizeMapaCoordinates(value: unknown): number[][] {
  if (!Array.isArray(value)) return [];
  return value.filter((point): point is number[] =>
    Array.isArray(point) && point.length >= 2
    && typeof point[0] === "number" && Number.isFinite(point[0])
    && typeof point[1] === "number" && Number.isFinite(point[1]),
  ).map(([x, y]) => [x, y]);
}

export function useMapaData(fazendaId: string | undefined, mes: number, ano: number, retiroId?: string, userId?: string) {
  const [loading, setLoading] = useState(true);
  const [mapa, setMapa] = useState<MapaData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const loadIdRef = useRef(0);
  const scope = retiroId ? (userId ?? "unknown-user") + "/" + (fazendaId ?? "capataz") + "/" + retiroId : "";
  const [loadedScope, setLoadedScope] = useState("");
  const displayedScopeRef = useRef("");
  const currentMapIdRef = useRef<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [indicatorsLoading, setIndicatorsLoading] = useState(false);
  // The photo/geometry belong to the retiro; only the overlay is period-scoped.
  const [baseMap, setBaseMap] = useState<{ scope: string; revision: number; mapa: MapaData; partialDecorations: boolean } | null>(null);
  const [appliedIndicatorPeriod, setAppliedIndicatorPeriod] = useState("");
  const activeAbortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    activeAbortRef.current?.abort();
    const controller = new AbortController();
    activeAbortRef.current = controller;
    const isCurrent = () => loadId === loadIdRef.current && !controller.signal.aborted;
    let authorizedImage = false;
    if (!retiroId) {
      setLoadedScope(scope);
      currentMapIdRef.current = null;
      setBaseMap(null);
      setMapa(null);
      setError(null);
      setWarning(null);
      setDetailsLoading(false);
      setIndicatorsLoading(false);
      setLoading(false);
      return;
    }
    const sameScope = displayedScopeRef.current === scope;
    displayedScopeRef.current = scope;
    if (!sameScope) setBaseMap(null);
    setLoadedScope(scope);
    // A retry after a failed/absent map must show loading, not a false empty state.
    if (!sameScope || currentMapIdRef.current === null) {
      setMapa(null);
      setLoading(true);
      setWarning(null);
    }
    setError(null);
    setDetailsLoading(false);
    setIndicatorsLoading(false);
    let temporaryMapReadFailure = false;

    try {
    // Query only the requested retiro with RLS; never retry permission denial.
    // Build a fresh PostgREST query per attempt (an aborted builder is not reused).
    let mapaRow: { id: string; fazenda_id: string; imagem_url: string } | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      let responseWasTransient = false;
      try {
        let mapaQuery = supabase.from("mapas")
          .select("id, fazenda_id, imagem_url")
          .eq("retiro_id", retiroId);
        if (fazendaId) mapaQuery = mapaQuery.eq("fazenda_id", fazendaId);
        const response = await runWithDeadline(
          signal => mapaQuery.order("criado_em", { ascending: false })
            .limit(1).abortSignal(signal).maybeSingle(),
          { signal: controller.signal,
            timeoutMs: attempt === 0 ? MAP_READ_TIMEOUT_MS : MAP_RETRY_TIMEOUT_MS },
        );
        if (!isCurrent()) return;
        if (!response.error) {
          mapaRow = response.data;
          break;
        }
        responseWasTransient = isTransientMapReadError(response.error, response.status);
        if (!responseWasTransient || attempt > 0) throw response.error;
      } catch (readError) {
        if (!isCurrent()) return;
        // Classify only this attempt: a later 401/403/42501 overrides any
        // transient failure from the previous attempt (no stale-photo fallback).
        temporaryMapReadFailure = responseWasTransient || isTransientMapReadError(readError);
        if (!temporaryMapReadFailure || attempt > 0) throw readError;
      }
      // One bounded retry for a transient failure; no unbounded polling.
      await new Promise(resolve => setTimeout(resolve, MAP_RETRY_PAUSE_MS));
      if (!isCurrent()) return;
    }

    if (!isCurrent()) return;
    if (!mapaRow) {
      currentMapIdRef.current = null;
      setBaseMap(null);
      setMapa(null);
      setLoading(false);
      return;
    }

    // Show the authorized image immediately; slow views/history must not gate the map.
    authorizedImage = true;
    const baseMapa: MapaData = {
      id: mapaRow.id, fazenda_id: mapaRow.fazenda_id,
      imagem_url: mapaRow.imagem_url, pastos: [], linhas: [], elementos: [],
    };
    if (!sameScope || currentMapIdRef.current !== mapaRow.id) setMapa(baseMapa);
    currentMapIdRef.current = mapaRow.id;
    setLoading(false);
    setDetailsLoading(true);

    // Read only the essential polygon ids first. Three parallel queries were
    // contributing to the database burst during SQLSTATE 57014 incidents.
    const pastosMapaRes = await runWithDeadline(
      signal => supabase.from("pastos_mapa")
        .select("id, pasto_id, coordenadas, cor").eq("mapa_id", mapaRow.id).abortSignal(signal),
      { signal: controller.signal, timeoutMs: 5500 },
    );
    if (!isCurrent()) return;
    if (pastosMapaRes.error) throw pastosMapaRes.error;
    const pastosMapa = pastosMapaRes.data ?? [];
    const pastoIds = [...new Set(pastosMapa.map(pm => pm.pasto_id))];

    // The retiro scope and the requested polygon IDs must be verified together;
    // no separate list-all-retiro query, no cross-retiro fallback and no fake zero.
    let basePastos: PastoMapaData[] = [];
    if (pastoIds.length > 0) {
    const pastosRes = await runWithDeadline(
      signal => supabase.from("pastos")
        .select("id, nome, num_animais, peso_medio_kg, categoria, sexo, data_fim_carencia, label_offset_x, label_offset_y, label_rotation")
        .eq("retiro_id", retiroId).in("id", pastoIds).abortSignal(signal),
      { signal: controller.signal, timeoutMs: 6500 },
    );
    if (!isCurrent()) return;
    if (pastosRes.error || (pastosRes.data ?? []).length !== pastoIds.length
        || (pastosRes.data ?? []).some(p => typeof p.num_animais !== "number" || !Number.isFinite(p.num_animais))) {
      throw pastosRes.error ?? new Error("Dados dos pastos não confirmados");
    }
    const pastosMap = new Map((pastosRes.data ?? []).map(p => [p.id, p]));
    basePastos = pastosMapa.map(pm => {
      const p = pastosMap.get(pm.pasto_id)!;
      return {
        id: pm.id, pasto_id: pm.pasto_id,
        coordenadas: normalizeMapaCoordinates(pm.coordenadas),
        cor: pm.cor || "#16a34a", pasto_nome: p.nome,
        num_animais: p.num_animais, peso_medio_kg: p.peso_medio_kg,
        categoria: p.categoria, sexo: p.sexo, consumo_medio: null,
        status_consumo: null, ultima_movimentacao: null,
        ultima_salga: null, ultima_salga_sacos: null,
        ultimo_cocho_cheio: null, ultima_visita_tipo: null,
        data_fim_carencia: p.data_fim_carencia,
        label_offset_x: Number(p.label_offset_x) || 0,
        label_offset_y: Number(p.label_offset_y) || 0,
        label_rotation: Number(p.label_rotation) || 0,
      };
    });
    }
    // Confirmed polygons can be shown before decorative lines/icons complete.
    // Never reuse a previous scope's or an unverified pasture's clickable data.
    const verifiedPastos: MapaData = { ...baseMapa, pastos: basePastos };
    if (!isCurrent()) return;
    setMapa(verifiedPastos);

    // Lines and icons are optional; a transient server error must not erase
    // verified polygons. Auth/permission errors remain fail-closed.
    const [linhasRes, elementosRes] = await Promise.all([
      runWithDeadline(signal => supabase.from("linhas_mapa")
        .select("id, coordenadas, cor, tipo, rotulo").eq("mapa_id", mapaRow.id).abortSignal(signal),
        { signal: controller.signal, timeoutMs: 5500 })
        .catch((error: unknown) => ({ data: null, error, status: undefined })),
      runWithDeadline(signal => supabase.from("elementos_mapa")
        .select("id, tipo, emoji, posicao_x, posicao_y, rotulo").eq("mapa_id", mapaRow.id).abortSignal(signal),
        { signal: controller.signal, timeoutMs: 5500 })
        .catch((error: unknown) => ({ data: null, error, status: undefined })),
    ]);
    if (!isCurrent()) return;
    if (linhasRes.error && !isTransientMapReadError(linhasRes.error, linhasRes.status)) throw linhasRes.error;
    if (elementosRes.error && !isTransientMapReadError(elementosRes.error, elementosRes.status)) throw elementosRes.error;
    const partialDecorations = Boolean(linhasRes.error || elementosRes.error);
    const linhas: LinhaMapaData[] = (linhasRes.data ?? []).map(l => ({
      id: l.id,
      coordenadas: normalizeMapaCoordinates(l.coordenadas),
      cor: l.cor, tipo: l.tipo, rotulo: l.rotulo,
    }));
    const elementos: ElementoMapaData[] = (elementosRes.data ?? []).map(e => ({
      id: e.id, tipo: e.tipo, emoji: e.emoji,
      posicao_x: Number(e.posicao_x), posicao_y: Number(e.posicao_y),
      rotulo: e.rotulo,
    }));
    if (!isCurrent()) return;
    const verified = { ...baseMapa, pastos: basePastos, linhas, elementos };
    setMapa(verified);
    setBaseMap({ scope, revision: loadId, mapa: verified, partialDecorations });
    setWarning(null);
    setDetailsLoading(false);

    } catch {
      if (!isCurrent()) return;
      if (authorizedImage) {
        setBaseMap(null);
        // Fail closed on unconfirmed geometry: keep the authorized photo but
        // remove any previously cached interactive polygons from this scope.
        setMapa(prev => prev ? { ...prev, pastos: [], linhas: [], elementos: [] } : prev);
        setWarning(MAP_DRAWINGS_WARNING);
      } else if (sameScope && userId && currentMapIdRef.current !== null
        && temporaryMapReadFailure) {
        // A previously authorized image can stay in this exact user/retiro
        // scope during a transient outage. Never offer stale interactive pastos.
        setMapa(prev => prev ? { ...prev, pastos: [], linhas: [], elementos: [] } : prev);
        setError(null);
        setWarning(MAP_REVALIDATION_WARNING);
      } else {
        // On denied/invalid queries fail closed (no image from the former scope).
        currentMapIdRef.current = null;
        setBaseMap(null);
        setMapa(null);
        setError(MAP_LOAD_ERROR);
        setWarning(null);
      }
      setDetailsLoading(false);
      setIndicatorsLoading(false);
      setLoading(false);
    }
  // Keep the photo and geometry independent of month/year changes.
  }, [fazendaId, retiroId, userId, scope]);

  useEffect(() => {
    void load();
    return () => {
      loadIdRef.current += 1;
      activeAbortRef.current?.abort();
    };
  }, [load]);

  // Changing the selected month must invalidate the overlay, not the photo.
  // Base geometry and current livestock counts are verified per user/retiro.
  const selectedPeriodKey = `${scope}/${ano}-${mes}/${baseMap?.revision ?? 0}`;
  useEffect(() => {
    if (!baseMap || baseMap.scope !== scope || !retiroId || baseMap.mapa.pastos.length === 0) {
      setIndicatorsLoading(false);
      return;
    }

    const controller = new AbortController();
    const mapRevision = baseMap.revision;
    let live = true;
    const isCurrent = () => live && !controller.signal.aborted && mapRevision === loadIdRef.current;
    const pastoIds = [...new Set(baseMap.mapa.pastos.map(p => p.pasto_id))];
    const periodStart = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const periodEnd = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
    setMapa(baseMap.mapa);
    setWarning(null);
    setIndicatorsLoading(true);

    void (async () => {
      let partial = false;
      // Monthly source is the same view the Pastos list uses. Missing rows
      // mean no confirmed monthly indicators, never a fabricated zero.
      const [monthlyRes, movementRes] = await Promise.all([
        runWithDeadline(signal => supabase.rpc("get_painel_pasto_mensal_rapido" as never,
            { p_retiro_id: retiroId, p_mes: mes, p_ano: ano } as never)
          .abortSignal(signal),
          { signal: controller.signal, timeoutMs: OPTIONAL_QUERY_TIMEOUT_MS })
          .catch(error => ({ data: null, error })),
        runWithDeadline(signal => supabase.from("movimentacoes_animais")
          .select("pasto_origem_id, pasto_destino_id, data")
          .or(pastoIds.map(id => "pasto_origem_id.eq." + id + ",pasto_destino_id.eq." + id).join(","))
          .gte("data", periodStart).lt("data", periodEnd)
          .order("data", { ascending: false }).limit(100).abortSignal(signal),
          { signal: controller.signal, timeoutMs: OPTIONAL_QUERY_TIMEOUT_MS })
          .catch(error => ({ data: null, error })),
      ]);
      if (!isCurrent()) return;
      if (monthlyRes.error || movementRes.error) partial = true;

      type VisitRow = {
        pasto_id: string;
        cocho_cheio: boolean;
        num_sacos: number;
        data_salga_informada: string | null;
        created_at: string;
      };
      const visits: VisitRow[] = [];
      const deadline = Date.now() + 6500;
      for (let offset = 0; ; offset += 1000) {
        try {
          const remaining = deadline - Date.now();
          if (remaining <= 0) throw new Error("Leitura mensal excedeu o prazo");
          const { data, error } = await runWithDeadline(signal => supabase.from("lancamentos")
            .select("pasto_id, cocho_cheio, num_sacos, data_salga_informada, created_at")
            .in("pasto_id", pastoIds)
            .eq("mes_referencia", mes).eq("ano_referencia", ano)
            .order("created_at", { ascending: false })
            .range(offset, offset + 999).abortSignal(signal),
            { signal: controller.signal, timeoutMs: Math.min(3500, remaining) },
          );
          if (!isCurrent()) return;
          if (error) throw error;
          const page = (data ?? []) as VisitRow[];
          visits.push(...page);
          if (page.length < 1000) break;
        } catch {
          if (!isCurrent()) return;
          visits.length = 0;
          partial = true;
          break;
        }
      }

      const visitDate = (v: VisitRow) => v.data_salga_informada || v.created_at;
      const salting = new Map<string, VisitRow>();
      const fullTrough = new Map<string, VisitRow>();
      for (const v of visits) {
        if (!v.cocho_cheio && v.num_sacos <= 0) continue;
        const byPasto = v.cocho_cheio ? fullTrough : salting;
        const last = byPasto.get(v.pasto_id);
        if (!last || Date.parse(visitDate(v)) > Date.parse(visitDate(last)))
          byPasto.set(v.pasto_id, v);
      }

      const consumption = new Map<string, { consumo: number | null; status: string | null }>();
      for (const row of monthlyRes.data ?? []) {
        if (!consumption.has(row.pasto_id)) consumption.set(row.pasto_id, {
          consumo: row.consumo_global_g_cab_dia == null ? null
            : Number.isFinite(Number(row.consumo_global_g_cab_dia))
              ? Number(row.consumo_global_g_cab_dia) : null,
          status: row.status_global,
        });
      }
      const movements = new Map<string, string>();
      for (const m of movementRes.data ?? []) {
        for (const id of [m.pasto_origem_id, m.pasto_destino_id])
          if (pastoIds.includes(id) && !movements.has(id)) movements.set(id, m.data);
      }

      const pastos = baseMap.mapa.pastos.map(p => {
        const lastSalt = salting.get(p.pasto_id);
        const lastFull = fullTrough.get(p.pasto_id);
        const saltDate = lastSalt ? visitDate(lastSalt) : null;
        const fullDate = lastFull ? visitDate(lastFull) : null;
        const lastVisitType = fullDate && (!saltDate || Date.parse(fullDate) > Date.parse(saltDate))
          ? "cocho_cheio" as const : saltDate ? "salga" as const : null;
        return {
          ...p,
          consumo_medio: consumption.get(p.pasto_id)?.consumo ?? null,
          status_consumo: consumption.get(p.pasto_id)?.status ?? null,
          ultima_movimentacao: movements.get(p.pasto_id) ?? null,
          ultima_salga: saltDate,
          ultima_salga_sacos: lastSalt?.num_sacos ?? null,
          ultimo_cocho_cheio: fullDate,
          ultima_visita_tipo: lastVisitType,
        };
      });
      if (!isCurrent()) return;
      setMapa({ ...baseMap.mapa, pastos });
      setAppliedIndicatorPeriod(selectedPeriodKey);
      setWarning(partial ? MAP_PARTIAL_WARNING : null);
      setIndicatorsLoading(false);
    })().catch(() => {
      if (!isCurrent()) return;
      setMapa(baseMap.mapa);
      setWarning(MAP_PARTIAL_WARNING);
      setAppliedIndicatorPeriod(selectedPeriodKey);
      setIndicatorsLoading(false);
    });
    return () => {
      live = false;
      controller.abort();
    };
  }, [baseMap, scope, mes, ano, retiroId, selectedPeriodKey]);

  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRealtimeRef = useRef(0);
  const onRealtime = useCallback(() => {
    if (realtimeTimerRef.current) return;
    const ms = Math.max(1500, 30000 - (Date.now() - lastRealtimeRef.current));
    realtimeTimerRef.current = setTimeout(() => {
      realtimeTimerRef.current = null;
      lastRealtimeRef.current = Date.now();
      void load();
    }, ms);
  }, [load]);
  useRealtimeSync(["pastos", "lancamentos", "movimentacoes_animais", "abates", "mortalidades"], onRealtime);
  // A refresh scheduled for one user/retiro must never replace another map.
  useEffect(() => {
    if (realtimeTimerRef.current) {
      clearTimeout(realtimeTimerRef.current);
      realtimeTimerRef.current = null;
    }
    lastRealtimeRef.current = 0;
  }, [scope]);
  useEffect(() => () => {
    if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
  }, []);

  return {
    loading: loadedScope === scope ? loading : Boolean(retiroId),
    // Immediately hide the previous month's indicator values while its new
    // read is pending; no wrong-period status/color may be displayed.
    mapa: loadedScope === scope && baseMap?.scope === scope
      && baseMap.mapa.pastos.length > 0 && appliedIndicatorPeriod !== selectedPeriodKey
      ? baseMap.mapa : loadedScope === scope ? mapa : null,
    error: loadedScope === scope ? error : null,
    warning: loadedScope !== scope ? null : [
      baseMap?.partialDecorations ? MAP_PARTIAL_DRAWINGS_WARNING : null,
      (!baseMap || baseMap.mapa.pastos.length === 0
        || appliedIndicatorPeriod === selectedPeriodKey) ? warning : null,
    ].filter(Boolean).join(" ") || null,
    detailsLoading: loadedScope === scope && detailsLoading,
    indicatorsLoading: loadedScope === scope && (indicatorsLoading ||
      (baseMap?.scope === scope && baseMap.mapa.pastos.length > 0
        && appliedIndicatorPeriod !== selectedPeriodKey)),
    refresh: load,
  };
}
