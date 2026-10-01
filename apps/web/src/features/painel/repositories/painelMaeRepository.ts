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
