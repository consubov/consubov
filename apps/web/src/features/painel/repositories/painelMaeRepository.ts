import { requireReadRows, DataReadFailure, assertReadSuccess } from "@/lib/dataReadGuard";
import {
  aggregatePainelMaeLight,
  type MaeLightSource, type MaeLightReal, type MaeLightPasto, type MaeLightRetiro,
  type MaeLightOcupacao, type MaeLightProduto, type MaeLightOriginal,
} from "@/lib/painelMaeLight";
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

/**
 * Lightweight read-only source that avoids nested view_painel_mae_pasto.
 * The month/farm are filtered on both security_invoker, security_barrier views.
 * Products/occupations are fetched only by IDs returned from authorized views
 * and verified against the authenticated retreat/pasture scope in the reducer.
 * Never convert a failed or truncated read into an invented zero.
 */
export async function fetchPainelMaeFallback(params: PainelMaeRpcParams): Promise<PainelMaeRpcRow> {
  const { fazendaId, retiroId, mes, ano } = params;
  // RLS-protected proof of farm access: zero rows from views alone does not
  // distinguish an empty month from an unauthorized tenant.
  const farmRead = await supabase.from("fazendas")
    .select("id").eq("id", fazendaId).maybeSingle();
  assertReadSuccess(farmRead);
  if (!farmRead.data || farmRead.data.id !== fazendaId)
    throw new DataReadFailure("permission");
  const pageSize = 500;
  async function pages<T>(
    read: (start: number, end: number) => PromiseLike<{
      data: T[] | null; error: { code?: string } | null; status?: number;
    }>,
  ): Promise<T[]> {
    const result: T[] = [];
    for (let page = 0; page < 100; page++) {
      const rows = requireReadRows(await read(page * pageSize, page * pageSize + pageSize - 1));
      if (rows.length > pageSize) throw new DataReadFailure("invalid_response");
      result.push(...rows);
      if (rows.length < pageSize) return result;
    }
    throw new DataReadFailure("invalid_response");
  }
  const vctrQ = supabase.from("view_consumo_tempo_real")
    .select("id,fazenda_id,retiro_id,pasto_id,mes_referencia,ano_referencia,num_animais,num_sacos,dias_no_pasto,consumo_g_cab_dia,indice_consumo,peso_medio_kg,created_at")
    .eq("fazenda_id", fazendaId).eq("mes_referencia", mes).eq("ano_referencia", ano)
    .order("id");
  const realQ = supabase.from("view_lancamento_consumo_real")
    .select("lancamento_id,fazenda_id,retiro_id,pasto_id,mes_referencia,ano_referencia,ocupacao_id,kg_fornecido,cab_dias_assumidos")
    .eq("fazenda_id", fazendaId).eq("mes_referencia", mes).eq("ano_referencia", ano)
    .order("lancamento_id");
  const originalQ = supabase.from("view_consumo_consolidado")
    .select("id,consumo_g_cab_dia,dias_no_pasto")
    .eq("fazenda_id", fazendaId).eq("mes_referencia", mes).eq("ano_referencia", ano)
    .order("id");
  const retiroQ = supabase.from("retiros")
    .select("id,fazenda_id,produto_id,peso_saco_kg")
    .eq("fazenda_id", fazendaId);
  const [vctr, reais, originais, retiros] = await Promise.all([
    pages<MaeLightSource>((start,end) => (retiroId ? vctrQ.eq("retiro_id", retiroId) : vctrQ).range(start,end)),
    pages<MaeLightReal>((start,end) => (retiroId ? realQ.eq("retiro_id", retiroId) : realQ).range(start,end)),
    pages<MaeLightOriginal>((start,end) => originalQ.range(start,end)),
    pages<MaeLightRetiro>((start,end) => retiroQ.order("id").range(start,end)),
  ]);
  const authorizedIds = retiros.map(r => r.id);
  if (retiroId && !authorizedIds.includes(retiroId)) throw new DataReadFailure("permission");
  if (authorizedIds.length === 0) {
    if (vctr.length || reais.length) throw new DataReadFailure("permission");
    return aggregatePainelMaeLight({
      scope: params, vctr, reais, pastos: [], retiros, ocupacoes: [], produtos: [], originais,
    });
  }
  const selectedRetreats = retiroId ? [retiroId] : authorizedIds;
  const pastos = pages<MaeLightPasto>((start,end) =>
    supabase.from("pastos").select("id,retiro_id,num_animais,peso_medio_kg,sexo,produto_id,ativo")
      .in("retiro_id", selectedRetreats).order("id").range(start,end)
  );
  const pastosData = await pastos;

  // An occupation ID is eligible only if it came from the secured real view.
  const ocupacaoIds = [...new Set(reais.map(r => r.ocupacao_id).filter((id): id is string => !!id))];
  const ocupacoes: MaeLightOcupacao[] = [];
  for (let i = 0; i < ocupacaoIds.length; i += 60) {
    const chunk = ocupacaoIds.slice(i,i+60);
    const rows = requireReadRows(await supabase.from("ocupacoes_pasto")
      .select("id,pasto_id,retiro_id,produto_id").in("id",chunk));
    ocupacoes.push(...(rows as MaeLightOcupacao[]));
  }
  const productIds = [...new Set([
    ...pastosData.map(p => p.produto_id),
    ...retiros.map(r => r.produto_id),
    ...ocupacoes.map(o => o.produto_id),
  ].filter((id): id is string => !!id))];
  const produtos: MaeLightProduto[] = [];
  for (let i = 0; i < productIds.length; i += 60) {
    const rows = requireReadRows(await supabase.from("produtos").select(
      "id,peso_saco_kg,amarelo_buffer_g,consumo_recria1,consumo_recria2,consumo_engorda,margem_mais_recria1_pct,margem_mais_recria2_pct,margem_mais_engorda_pct,margem_menos_recria1_pct,margem_menos_recria2_pct,margem_menos_engorda_pct"
    ).in("id",productIds.slice(i,i+60)));
    produtos.push(...(rows as MaeLightProduto[]));
  }
  return aggregatePainelMaeLight({
    scope: params, vctr, reais, pastos: pastosData,
    retiros: retiroId ? retiros.filter(r => r.id === retiroId) : retiros,
    ocupacoes, produtos, originais,
  });
}
