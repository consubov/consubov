import { useCallback, useEffect, useRef, useState } from "react";
import { dataReadErrorMessage, DataReadFailure } from "@/lib/dataReadGuard";
import {
  fetchPainelMae,
  fetchPainelMaeRapido,
  fetchPainelMaeFallback,
  type PainelMaeRpcRow,
} from "@/features/painel/repositories/painelMaeRepository";

export interface PainelMaeData {
  consumo_real_g_cab_dia: number;
  consumo_global_g_cab_dia: number;
  eficiencia: number;
  pastos_na_meta_num: number;
  pastos_na_meta_den: number;
  peso_medio_kg: number;
}

const empty: PainelMaeData = {
  consumo_real_g_cab_dia: 0,
  consumo_global_g_cab_dia: 0,
  eficiencia: 0,
  pastos_na_meta_num: 0,
  pastos_na_meta_den: 0,
  peso_medio_kg: 0,
};

/**
 * Fonte única de verdade dos cards de consumo/eficiência/meta/peso.
 * p_retiro_id = null agrega a fazenda inteira.
 */
export function usePainelMae(
  fazendaId: string | null | undefined,
  retiroId: string | null | undefined,
  mes: number,
  ano: number,
  allowLegacyFallback = true,
) {
  const [data, setData] = useState<PainelMaeData>(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestSequence.current;
    const current = () => requestSequence.current === request;
    if (!fazendaId) {
      setData(empty);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = { fazendaId, retiroId: retiroId ?? null, mes, ano };
      let rows: PainelMaeRpcRow[] | PainelMaeRpcRow | null;
      const fast = await fetchPainelMaeRapido(params);
      if (!current()) return;
      if (!fast.error) {
        // This SQL RPC always returns one aggregate row, even for an empty month.
        // A missing/partial payload is a failed read, not evidence of zero consumption.
        const row = Array.isArray(fast.data) ? fast.data[0] : fast.data;
        const fields = [
          "consumo_real_g_cab_dia", "consumo_global_g_cab_dia", "eficiencia",
          "pastos_na_meta_num", "pastos_na_meta_den", "peso_medio_kg",
        ] as const;
        const valid = row && typeof row === "object" && fields.every((field) => {
          const value = row[field];
          return value === null || (typeof value === "number" && Number.isFinite(value)) ||
            (typeof value === "string" && value.trim().length > 0 &&
              Number.isFinite(Number(value)));
        });
        if (!valid || (Array.isArray(fast.data) && fast.data.length !== 1) ||
          row.pastos_na_meta_num === null || row.pastos_na_meta_den === null) {
          throw new DataReadFailure("invalid_response");
        }
        rows = row;
      } else {
        const code = typeof fast.error === "object" && fast.error !== null &&
          "code" in fast.error ? String(fast.error.code) : "";
        const status = typeof fast.error === "object" && fast.error !== null &&
          "status" in fast.error ? Number(fast.error.status) : 0;
        // Authorization failures must never try a less restrictive source.
        if (code === "42501" || status === 401 || status === 403)
          throw new DataReadFailure("permission");
        // Compatibility with old deployments only: endpoint absent.
        // For transport or SQL failure do not fan out heavy view requests.
        if (code !== "PGRST202" || !allowLegacyFallback) throw new DataReadFailure("unavailable");
        try {
          rows = await fetchPainelMaeFallback(params);
        } catch (fallbackError) {
          if (fallbackError instanceof DataReadFailure && fallbackError.kind === "permission")
            throw fallbackError;
          const primary = await fetchPainelMae(params);
          if (primary.error) {
            const rpcError = primary.error;
            const rpcCode = typeof rpcError === "object" && rpcError !== null &&
              "code" in rpcError ? String(rpcError.code) : "";
            const rpcStatus = typeof rpcError === "object" && rpcError !== null &&
              "status" in rpcError ? Number(rpcError.status) : 0;
            if (rpcCode === "42501" || rpcStatus === 401 || rpcStatus === 403)
              throw new DataReadFailure("permission");
            throw new DataReadFailure("unavailable");
          }
          rows = primary.data;
        }
      }

      if (!current()) return;
      const row: PainelMaeRpcRow | null = Array.isArray(rows)
        ? (rows[0] ?? null)
        : rows;

      setError(null);
      setData(
        row
          ? {
              consumo_real_g_cab_dia:
                Number(row.consumo_real_g_cab_dia) || 0,
              consumo_global_g_cab_dia:
                Number(row.consumo_global_g_cab_dia) || 0,
              eficiencia: Number(row.eficiencia) || 0,
              pastos_na_meta_num: Number(row.pastos_na_meta_num) || 0,
              pastos_na_meta_den: Number(row.pastos_na_meta_den) || 0,
              peso_medio_kg: Number(row.peso_medio_kg) || 0,
            }
          : empty,
      );
    } catch (error) {
      if (!current()) return;
      setError(dataReadErrorMessage(error));
      setData(empty);
    } finally {
      if (current()) setLoading(false);
    }
  }, [fazendaId, retiroId, mes, ano, allowLegacyFallback]);

  useEffect(() => {
    void load();
    return () => { requestSequence.current++; };
  }, [load]);

  return { painelMae: data, loading, error, refresh: load };
}
