import { supabase } from "@/integrations/supabase/client";

export interface PastoRetiroRow {
  id: string;
  nome: string;
  num_animais: number | null;
  peso_medio_kg: number | null;
  gmd_kg_dia: number | null;
}

export interface PainelPastoAtualRow {
  pasto_id: string;
  consumo_global_g_cab_dia: number | null;
  indice_global: number | null;
  status_global: string | null;
  num_animais: number | null;
  peso_medio_kg: number | null;
}

export interface PainelPastoMesRow {
  pasto_id: string;
  num_sacos: number | null;
}

export interface DataSourceResult<T> {
  data: T[] | null;
  error: unknown;
}

export interface PastosRetiroSources {
  pastosRes: DataSourceResult<PastoRetiroRow>;
  atualRes: DataSourceResult<PainelPastoAtualRow>;
  mesRes: DataSourceResult<PainelPastoMesRow>;
}

/**
 * Keeps the three database reads used by usePastosRetiro behind one boundary.
 * Composition and business-facing defaults intentionally remain in the hook.
 */
export async function fetchPastosRetiroSources(
  retiroId: string,
  mes: number,
  ano: number,
): Promise<PastosRetiroSources> {
  const [pastosRes, atualRes, mesRes] = await Promise.all([
    supabase
      .from("pastos")
      .select("id, nome, num_animais, peso_medio_kg, gmd_kg_dia")
      .eq("retiro_id", retiroId)
      .eq("ativo", true)
      .order("nome"),
    (supabase as any)
      .from("view_painel_mae_pasto_atual")
      .select(
        "pasto_id, consumo_global_g_cab_dia, indice_global, status_global, num_animais, peso_medio_kg",
      )
      .eq("retiro_id", retiroId),
    (supabase as any)
      .from("view_painel_mae_pasto")
      .select("pasto_id, num_sacos")
      .eq("retiro_id", retiroId)
      .eq("mes_referencia", mes)
      .eq("ano_referencia", ano),
  ]);

  return {
    pastosRes: pastosRes as DataSourceResult<PastoRetiroRow>,
    atualRes: atualRes as DataSourceResult<PainelPastoAtualRow>,
    mesRes: mesRes as DataSourceResult<PainelPastoMesRow>,
  };
}
