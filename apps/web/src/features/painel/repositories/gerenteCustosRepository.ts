import { supabase } from "@/integrations/supabase/client";
import { DataReadFailure } from "@/lib/dataReadGuard";
import { runWithDeadline } from "@/lib/requestDeadline";

export interface GerenteCustoRetiro {
  retiro_id: string;
  total_sacos: number;
  total_cab_dias: number;
  custo_mensal: number;
  custo_diario: number;
}

export interface GerenteCustosParams {
  fazendaId: string;
  mes: number;
  ano: number;
  signal?: AbortSignal;
}

export const GERENTE_CUSTOS_DEADLINE_MS = 20_000;

type RpcResponse = {
  data: unknown;
  error: { code?: string } | null;
  status?: number;
};
type ScopedRpc = {
  rpc: (
    name: "get_gerente_custos_rapido",
    args: { p_fazenda_id: string; p_mes: number; p_ano: number },
  ) => { abortSignal: (signal: AbortSignal) => PromiseLike<RpcResponse> };
};

function readNumeric(value: unknown): number {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && value.trim().length === 0)
  ) throw new DataReadFailure("invalid_response");
  const number = Number(value);
  if (!Number.isFinite(number)) throw new DataReadFailure("invalid_response");
  return number;
}

/**
 * Scoped authenticated RPC. A missing function, timeout or denied access
 * never fans out to the heavy legacy views or produces invented zero costs.
 */
export async function fetchGerenteCustos({
  fazendaId, mes, ano, signal,
}: GerenteCustosParams): Promise<GerenteCustoRetiro[]> {
  const rpc = supabase as unknown as ScopedRpc;
  const result = await runWithDeadline(
    (requestSignal) => rpc.rpc("get_gerente_custos_rapido", {
      p_fazenda_id: fazendaId, p_mes: mes, p_ano: ano,
    }).abortSignal(requestSignal),
    { signal, timeoutMs: GERENTE_CUSTOS_DEADLINE_MS },
  );
  if (result.error) {
    if (result.error.code === "42501" || result.status === 401 || result.status === 403) {
      throw new DataReadFailure("permission");
    }
    throw new DataReadFailure("unavailable");
  }
  if (!Array.isArray(result.data)) throw new DataReadFailure("invalid_response");
  const seen = new Set<string>();
  return result.data.map((raw: unknown) => {
    if (!raw || typeof raw !== "object") throw new DataReadFailure("invalid_response");
    const row = raw as Record<string, unknown>;
    if (typeof row.retiro_id !== "string" || !row.retiro_id ||
      seen.has(row.retiro_id)) throw new DataReadFailure("invalid_response");
    seen.add(row.retiro_id);
    const total_sacos = readNumeric(row.total_sacos);
    const total_cab_dias = readNumeric(row.total_cab_dias);
    const custo_mensal = readNumeric(row.custo_mensal);
    const custo_diario = readNumeric(row.custo_diario);
    if (total_sacos < 0 || total_cab_dias < 0 ||
      !Number.isInteger(total_sacos)) throw new DataReadFailure("invalid_response");
    return { retiro_id: row.retiro_id, total_sacos, total_cab_dias, custo_mensal, custo_diario };
  });
}
