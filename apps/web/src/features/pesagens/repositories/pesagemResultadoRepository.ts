import { supabase } from "@/integrations/supabase/client";

export interface PesagemAtualRow {
  lote_id: string;
  media_calculada: number | null;
  quantidade_animais: number | null;
  total_pesado: number | null;
  data_pesagem: string;
  pastos?: {
    nome?: string | null;
    num_animais?: number | null;
    retiros?: {
      fazendas?: {
        nome?: string | null;
      } | null;
    } | null;
  } | null;
  [key: string]: unknown;
}

export interface PesagemAnteriorRow {
  media_calculada: number | null;
  data_pesagem: string;
}

export interface QueryResult<T> {
  data: T;
  error: unknown;
}

export async function fetchPesagemAtual(
  pesagemId: string,
): Promise<QueryResult<PesagemAtualRow | null>> {
  const { data, error } = await (supabase.from("pesagens") as any)
    .select("*, pastos(nome, num_animais, retiros(fazendas(nome)))")
    .eq("id", pesagemId)
    .maybeSingle();

  return {
    data: (data as PesagemAtualRow | null) ?? null,
    error,
  };
}

export async function fetchPesagemAnterior(
  loteId: string,
  pesagemId: string,
): Promise<QueryResult<PesagemAnteriorRow[] | null>> {
  const { data, error } = await (supabase.from("pesagens") as any)
    .select("media_calculada, data_pesagem")
    .eq("lote_id", loteId)
    .neq("id", pesagemId)
    .order("data_pesagem", { ascending: false })
    .limit(1);

  return {
    data: (data as PesagemAnteriorRow[] | null) ?? null,
    error,
  };
}
