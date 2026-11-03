import { useCallback, useEffect, useRef, useState } from "react";
import { dataReadErrorMessage } from "@/lib/dataReadGuard";
import { RequestCancelledError } from "@/lib/requestDeadline";
import { screenCacheKey, useResumeRefresh, useScreenCacheInvalidation } from "@/lib/screenCache";
import { fetchGerenteCustos, type GerenteCustoRetiro } from "@/features/painel/repositories/gerenteCustosRepository";

type CostState = { key: string; data: GerenteCustoRetiro[]; loading: boolean; error: string | null };

/** Manager-only costs: no get_consumo_mineral / expensive view fallback. */
export function useGerenteCustos(fazendaId: string | null, mes: number, ano: number, sessionId?: string | null) {
  const key = screenCacheKey("gerenteCustosRapidos", [sessionId, fazendaId, mes, ano]);
  // Do not cache financial data across authentication sessions.
  const [state, setState] = useState<CostState>(() => ({
    key, data: [], loading: Boolean(fazendaId), error: null,
  }));
  const currentKey = useRef(key);
  currentKey.current = key;
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    const requestId = ++sequence.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const isCurrent = () => sequence.current === requestId && currentKey.current === key && !abort.signal.aborted;
    if (!fazendaId) {
      setState({ key, data: [], loading: false, error: null });
      return;
    }
    if (isCurrent()) setState({ key, data: [], loading: true, error: null });
    try {
      const data = await fetchGerenteCustos({ fazendaId, mes, ano, signal: abort.signal });
      if (!isCurrent()) return;
      setState({ key, data, loading: false, error: null });
    } catch (error) {
      if (!isCurrent() || error instanceof RequestCancelledError) return;
      setState({
        key, data: [], loading: false,
        error: dataReadErrorMessage(error),
      });
    }
  }, [fazendaId, mes, ano, key]);

  useEffect(() => {
    void load();
    return () => {
      sequence.current++;
      controller.current?.abort();
    };
  }, [load]);
  useScreenCacheInvalidation(() => { void load(); });
  useResumeRefresh(() => { void load(); });

  const current: CostState = state.key === key
    ? state
    : { key, data: [], loading: Boolean(fazendaId), error: null };
  return { ...current, refresh: load };
}
