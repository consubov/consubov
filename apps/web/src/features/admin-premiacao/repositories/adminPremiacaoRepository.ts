import { supabase } from "@/integrations/supabase/client";
import type { FazendaPremiacao } from "../types";

export interface AdminPremiacaoRepository {
  listActiveFazendas(): Promise<FazendaPremiacao[]>;
}

/**
 * Mantém o contrato de leitura que já existia na página.
 *
 * Erros retornados pelo cliente não são promovidos nesta etapa porque a tela
 * anterior também apenas consumia `data` e usava lista vazia quando ausente.
 */
export const supabaseAdminPremiacaoRepository: AdminPremiacaoRepository = {
  async listActiveFazendas() {
    const { data } = await supabase
      .from("fazendas")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome");

    return (data ?? []) as FazendaPremiacao[];
  },
};
