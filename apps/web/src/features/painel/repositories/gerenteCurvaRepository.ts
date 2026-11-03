import { supabase } from "@/integrations/supabase/client";
import { DataReadFailure } from "@/lib/dataReadGuard";
import { runWithDeadline } from "@/lib/requestDeadline";

export interface GerenteCurvaMes {
  ano_referencia: number;
  mes_referencia: number;
  kg_fornecido: number;
  cab_dias_assumidos: number;
}

type RpcResult = {
  data: unknown;
  error: { code?: string } | null;
  status?: number;
};
type GerenteCurvaRpc = {
  rpc: (
    name: "get_gerente_curva_rapida",
    args: { p_fazenda_id: string; p_retiro_id: string | null },
  ) => { abortSignal: (signal: AbortSignal) => PromiseLike<RpcResult> };
};
const numeric = (value: unknown) => {
  if ((typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())) throw new DataReadFailure("invalid_response");
  const n = Number(value);
  if (!Number.isFinite(n)) throw new DataReadFailure("invalid_response");
  return n;
};

/** One annual history request, aggregated server-side and restricted by JWT. */
export async function fetchGerenteCurva(params: {
  fazendaId: string;
  retiroId: string | null;
  signal?: AbortSignal;
}): Promise<GerenteCurvaMes[]> {
  const rpc = supabase as unknown as GerenteCurvaRpc;
  const result = await runWithDeadline(
    (signal) => rpc.rpc("get_gerente_curva_rapida", {
      p_fazenda_id: params.fazendaId, p_retiro_id: params.retiroId,
    }).abortSignal(signal),
    { signal: params.signal, timeoutMs: 20_000 },
  );
  if (result.error) {
    if (result.error.code === "42501" || result.status === 401 || result.status === 403)
      throw new DataReadFailure("permission");
    throw new DataReadFailure("unavailable");
  }
  if (!Array.isArray(result.data)) throw new DataReadFailure("invalid_response");
  const seen = new Set<string>();
  return result.data.map((value: unknown) => {
    if (!value || typeof value !== "object") throw new DataReadFailure("invalid_response");
    const row = value as Record<string, unknown>;
    const ano_referencia = numeric(row.ano_referencia);
    const mes_referencia = numeric(row.mes_referencia);
    const kg_fornecido = numeric(row.kg_fornecido);
    const cab_dias_assumidos = numeric(row.cab_dias_assumidos);
    const key = String(ano_referencia) + "-" + String(mes_referencia);
    if (!Number.isInteger(ano_referencia) || !Number.isInteger(mes_referencia) ||
      mes_referencia < 1 || mes_referencia > 12 ||
      kg_fornecido < 0 || cab_dias_assumidos < 0 || seen.has(key)) {
      throw new DataReadFailure("invalid_response");
    }
    seen.add(key);
    return { ano_referencia, mes_referencia, kg_fornecido, cab_dias_assumidos };
  });
}
