import { supabase } from "@/integrations/supabase/client";
import { DataReadFailure } from "@/lib/dataReadGuard";
import { runWithDeadline } from "@/lib/requestDeadline";

export interface GerenteLancamento {
  id: string; pasto_id: string; retiro_id: string; fazenda_id: string;
  num_sacos: number; num_animais: number;
  peso_medio_kg: number | null; categoria: string | null;
  sexo: string | null; origem: string | null;
  dias_no_pasto: number; created_at: string | null;
  mes_referencia: number; ano_referencia: number;
  consumo_g_cab_dia: number | null;
  status_consumo: string | null; indice_consumo: number | null;
}
type RpcResult = {
  data: unknown;
  error: { code?: string } | null;
  status?: number;
};
type SnapshotRpc = {
  rpc: (
    name: "get_gerente_lancamentos_rapido",
    args: { p_fazenda_id: string; p_mes: number; p_ano: number },
  ) => { abortSignal: (signal: AbortSignal) => PromiseLike<RpcResult> };
};

function numeric(value: unknown, nullable = false): number | null {
  if (nullable && value === null) return null;
  if ((typeof value !== "string" && typeof value !== "number") ||
    (typeof value === "string" && !value.trim())) {
    throw new DataReadFailure("invalid_response");
  }
  const n = Number(value);
  if (!Number.isFinite(n)) throw new DataReadFailure("invalid_response");
  return n;
}
function stringOrNull(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new DataReadFailure("invalid_response");
  return value;
}

/** Monthly manager-only snapshot; refuses cross-farm/stale/unscoped rows. */
export async function fetchGerenteLancamentos({
  fazendaId, mes, ano, signal,
}: { fazendaId: string; mes: number; ano: number; signal?: AbortSignal }): Promise<GerenteLancamento[]> {
  const rpc = supabase as unknown as SnapshotRpc;
  const response = await runWithDeadline(
    (requestSignal) => rpc.rpc("get_gerente_lancamentos_rapido", {
      p_fazenda_id: fazendaId, p_mes: mes, p_ano: ano,
    }).abortSignal(requestSignal),
    { signal, timeoutMs: 20_000 },
  );
  if (response.error) {
    if (response.error.code === "42501" || response.status === 401 || response.status === 403)
      throw new DataReadFailure("permission");
    throw new DataReadFailure("unavailable");
  }
  if (!Array.isArray(response.data)) throw new DataReadFailure("invalid_response");
  const seen = new Set<string>();
  return response.data.map((raw: unknown) => {
    if (!raw || typeof raw !== "object") throw new DataReadFailure("invalid_response");
    const row = raw as Record<string, unknown>;
    const id = row.id, retiroId = row.retiro_id, pastoId = row.pasto_id;
    if (typeof id !== "string" || !id ||
      typeof retiroId !== "string" || !retiroId ||
      typeof pastoId !== "string" || !pastoId ||
      row.fazenda_id !== fazendaId || seen.has(id) ||
      numeric(row.ano_referencia) !== ano || numeric(row.mes_referencia) !== mes) {
      throw new DataReadFailure("permission");
    }
    seen.add(id);
    const num_sacos = numeric(row.num_sacos);
    const num_animais = numeric(row.num_animais);
    const dias_no_pasto = numeric(row.dias_no_pasto);
    if (num_sacos === null || num_animais === null || dias_no_pasto === null ||
      !Number.isInteger(num_sacos) || num_sacos < 0 ||
      !Number.isInteger(num_animais) || num_animais <= 0 ||
      !Number.isInteger(dias_no_pasto)) {
      throw new DataReadFailure("invalid_response");
    }
    return {
      id, retiro_id: retiroId, pasto_id: pastoId, fazenda_id: fazendaId,
      num_sacos, num_animais, dias_no_pasto,
      peso_medio_kg: numeric(row.peso_medio_kg, true),
      categoria: stringOrNull(row.categoria),
      sexo: stringOrNull(row.sexo),
      origem: stringOrNull(row.origem),
      created_at: stringOrNull(row.created_at),
      mes_referencia: mes, ano_referencia: ano,
      consumo_g_cab_dia: numeric(row.consumo_g_cab_dia, true),
      status_consumo: stringOrNull(row.status_consumo),
      indice_consumo: numeric(row.indice_consumo, true),
    };
  });
}
