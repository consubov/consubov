import { supabase } from "@/integrations/supabase/client";

export interface SyncVetTrajeto {
  id: string;
  data: string;
  fazenda_id: string;
  distancia_km: number | null;
  duracao_min: number | null;
  origem_endereco: string | null;
}

export interface SyncVetTrajetoFazenda {
  id: string;
  nome: string;
}

export async function loadSyncVetTrajetos(
  empresaId: string,
  userId: string,
): Promise<{
  trajetos: SyncVetTrajeto[];
  fazendas: SyncVetTrajetoFazenda[] | null;
}> {
  const { data: equipe } = await supabase
    .from("syncvet_equipe")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("user_id", userId)
    .maybeSingle();
  const veterinarioId = (equipe as { id: string } | null)?.id;

  if (!veterinarioId) return { trajetos: [], fazendas: null };

  const [{ data: trajetos }, { data: fazendas }] = await Promise.all([
    supabase
      .from("syncvet_trajetos")
      .select("id, data, fazenda_id, distancia_km, duracao_min, origem_endereco")
      .eq("veterinario_id", veterinarioId)
      .order("data", { ascending: false })
      .limit(200),
    supabase
      .from("syncvet_fazendas")
      .select("id, nome")
      .eq("empresa_id", empresaId),
  ]);

  return {
    trajetos: (trajetos as SyncVetTrajeto[]) || [],
    fazendas: (fazendas as SyncVetTrajetoFazenda[]) || [],
  };
}
