import { useCallback, useEffect, useRef, useState } from "react";
import { dataReadErrorMessage, DataReadFailure } from "@/lib/dataReadGuard";
import {
  fetchPainelMae,
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
      const primary = await fetchPainelMae(params);
      let rows: PainelMaeRpcRow[] | PainelMaeRpcRow | null = primary.data;

      if (primary.error) {
        const rpcError = primary.error;
        const code = typeof rpcError === "object" && rpcError !== null &&
          "code" in rpcError ? String(rpcError.code) : "";
        const status = typeof rpcError === "object" && rpcError !== null &&
          "status" in rpcError ? Number(rpcError.status) : 0;
        // Never recover a permission error using an alternative data path.
        if (code === "42501" || status === 401 || status === 403) {
          throw new DataReadFailure("permission");
        }
        // The two views used by the RPC are security_invoker and selected
        // only for the same farm, retreat and month/year. No invented values.
        rows = await fetchPainelMaeFallback(params);
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
  }, [fazendaId, retiroId, mes, ano]);

  useEffect(() => {
    void load();
    return () => { requestSequence.current++; };
  }, [load]);

  return { painelMae: data, loading, error, refresh: load };
}
