import { supabase } from "@/integrations/supabase/client";

export interface FazendaPremiacao {
  id: string;
  nome: string;
}

/**
 * Data boundary for the Premiação Admin screen.
 * The query intentionally mirrors the previous page-level Supabase call.
 */
export async function listActiveFazendasForPremiacao(): Promise<
  FazendaPremiacao[]
> {
  const { data } = await supabase
    .from("fazendas")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");

  return (data ?? []) as FazendaPremiacao[];
}
