import { requireReadRows, DataReadFailure } from "@/lib/dataReadGuard";
import { aggregatePainelMaeFallback, type MaePastoCanonico, type MaeLancamentoReal, type MaePastoAtivo } from "@/lib/painelMaeFallback";
import { supabase } from "@/integrations/supabase/client";

export interface PainelMaeRpcParams {
  fazendaId: string;
  retiroId: string | null;
  mes: number;
  ano: number;
}

export interface PainelMaeRpcRow {
  consumo_real_g_cab_dia?: number | string | null;
  consumo_global_g_cab_dia?: number | string | null;
  eficiencia?: number | string | null;
  pastos_na_meta_num?: number | string | null;
  pastos_na_meta_den?: number | string | null;
  peso_medio_kg?: number | string | null;
}

export interface PainelMaeRpcResult {
  data: PainelMaeRpcRow[] | PainelMaeRpcRow | null;
  error: unknown;
}

/**
 * Data boundary for the existing get_painel_mae RPC.
 * Mapping/defaults remain in the hook to keep this extraction behavior-neutral.
 */
export async function fetchPainelMae({
  fazendaId,
  retiroId,
  mes,
  ano,
}: PainelMaeRpcParams): Promise<PainelMaeRpcResult> {
  const result = await (supabase as any).rpc("get_painel_mae", {
    p_fazenda_id: fazendaId,
    p_retiro_id: retiroId,
    p_mes: mes,
    p_ano: ano,
  });

  return result as PainelMaeRpcResult;
}

/** Read-only fallback for RPC outages; all three sources use invoker/RLS scope.
 * Never turn a denied response or truncated response into dashboard zeros.
 */
export async function fetchPainelMaeFallback(params: PainelMaeRpcParams): Promise<PainelMaeRpcRow> {
  const { fazendaId, retiroId, mes, ano } = params;
  const maeBase = supabase.from("view_painel_mae_pasto")
    .select("fazenda_id, retiro_id, pasto_id, mes_referencia, ano_referencia, kg_fornecido, cab_dias_global, eficiencia_pasto, status_global, peso_medio_kg")
    .eq("fazenda_id", fazendaId).eq("mes_referencia", mes).eq("ano_referencia", ano);
  const realBase = supabase.from("view_lancamento_consumo_real")
    .select("fazenda_id, retiro_id, mes_referencia, ano_referencia, kg_fornecido, cab_dias_assumidos")
    .eq("fazenda_id", fazendaId).eq("mes_referencia", mes).eq("ano_referencia", ano);
  const [maeResult, realResult, retiroResult] = await Promise.all([
    (retiroId ? maeBase.eq("retiro_id", retiroId) : maeBase).limit(1000),
    (retiroId ? realBase.eq("retiro_id", retiroId) : realBase).limit(1000),
    supabase.from("retiros").select("id").eq("fazenda_id", fazendaId),
  ]);
  const maes = requireReadRows(maeResult) as MaePastoCanonico[];
  const reais = requireReadRows(realResult) as MaeLancamentoReal[];
  const retiros = requireReadRows(retiroResult);
  // PostgREST may truncate results at 1000. Do not aggregate partial history.
  if (maes.length >= 1000 || reais.length >= 1000) {
    throw new DataReadFailure("invalid_response");
  }
  const retiroIds = retiros.map(row => row.id);
  if (retiroId && !retiroIds.includes(retiroId)) throw new DataReadFailure("permission");
  let pastos: MaePastoAtivo[] = [];
  if (retiroIds.length > 0) {
    const query = supabase.from("pastos")
      .select("id, retiro_id, num_animais, peso_medio_kg")
      .in("retiro_id", retiroId ? [retiroId] : retiroIds)
      .eq("ativo", true)
      .gt("num_animais", 0)
      .limit(1000);
    pastos = requireReadRows(await query) as MaePastoAtivo[];
    if (pastos.length >= 1000) throw new DataReadFailure("invalid_response");
  }
  return aggregatePainelMaeFallback({ fazendaId, retiroId, mes, ano, retiroIds }, maes, reais, pastos);
}
