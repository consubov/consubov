import { supabase } from "@/integrations/supabase/client";

export interface EventoLote {
  id: string;
  lote_id: string;
  tipo: string;
  usuario_id: string | null;
  data_evento: string;
  dados: any;
  criado_em: string;
}

export interface PesagemData {
  id: string;
  evento_id: string;
  lote_id: string;
  total_pesado: number;
  pesos: number[];
  media_calculada: number | null;
  peso_medio_aplicado: number | null;
  data_pesagem: string;
}

export interface EventoSanitarioData {
  id: string;
  evento_id: string;
  lote_id: string;
  categoria: string;
  medicamento: string;
  dose: string;
  lote_completo: boolean;
  quantidade_tratada: number | null;
  tem_carencia: boolean;
  dias_carencia: number | null;
  data_fim_carencia: string | null;
  aplicador_id: string | null;
  data_aplicacao: string;
}

export async function listEventosLote(loteId: string): Promise<EventoLote[]> {
  const { data } = await (supabase.from("eventos_lote") as any)
    .select("*")
    .eq("lote_id", loteId)
    .order("data_evento", { ascending: false });

  return (data as EventoLote[]) ?? [];
}

export async function getUltimaPesagem(
  loteId: string,
): Promise<PesagemData | null> {
  const { data } = await (supabase.from("pesagens") as any)
    .select("*")
    .eq("lote_id", loteId)
    .order("data_pesagem", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as PesagemData | null) ?? null;
}

export async function getUltimoSanitario(
  loteId: string,
): Promise<EventoSanitarioData | null> {
  const { data } = await (supabase.from("eventos_sanitarios") as any)
    .select("*")
    .eq("lote_id", loteId)
    .order("data_aplicacao", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as EventoSanitarioData | null) ?? null;
}
