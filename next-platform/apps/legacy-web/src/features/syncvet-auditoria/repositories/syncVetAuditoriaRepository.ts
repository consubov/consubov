import { supabase } from "@/integrations/supabase/client";

export interface SyncVetAuditoriaRow {
  id: string;
  equipe_id: string | null;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  detalhes: Record<string, unknown> | null;
  gps_lat: number | null;
  gps_lng: number | null;
  dispositivo: string | null;
  created_at: string;
}

export interface SyncVetEquipeNome {
  id: string;
  nome: string;
}

export async function loadSyncVetAuditoria(empresaId: string): Promise<{
  equipes: SyncVetEquipeNome[];
  rows: SyncVetAuditoriaRow[];
}> {
  const { data: equipes } = await supabase
    .from("syncvet_equipe")
    .select("id, nome")
    .eq("empresa_id", empresaId);

  const { data: rows } = await supabase
    .from("syncvet_auditoria")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false })
    .limit(300);

  return {
    equipes: (equipes as SyncVetEquipeNome[]) || [],
    rows: (rows as SyncVetAuditoriaRow[]) || [],
  };
}
