// Fotos das análises Penn State (Confinamento). Não altera o motor de cálculo.
import { supabase } from "@/integrations/supabase/client";

export interface PennStateFoto {
  id: string;
  penn_state_analise_id: string;
  url: string;
  ordem: number;
}

/** Fotos de várias análises, agrupadas por análise e ordenadas por `ordem`. */
export async function listarFotosPennState(analiseIds: string[]): Promise<Record<string, PennStateFoto[]>> {
  if (analiseIds.length === 0) return {};
  const { data, error } = await (supabase as any)
    .from("penn_state_analise_fotos")
    .select("*")
    .in("penn_state_analise_id", analiseIds)
    .order("ordem");
  if (error) throw error;
  const map: Record<string, PennStateFoto[]> = {};
  ((data as PennStateFoto[]) || []).forEach(f => {
    (map[f.penn_state_analise_id] ??= []).push(f);
  });
  return map;
}

/**
 * Continua a numeração global da visita nas fotos das análises Penn State,
 * seguindo a ordem das análises e a ordem das fotos dentro de cada uma.
 */
export function numerarFotosPennState(
  analises: { id: string; ordem: number }[],
  fotosPorAnalise: Record<string, PennStateFoto[]>,
  offset: number,
): Record<string, number> {
  const map: Record<string, number> = {};
  let n = offset + 1;
  [...analises].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).forEach(a => {
    [...(fotosPorAnalise[a.id] || [])].sort((x, y) => x.ordem - y.ordem).forEach(f => {
      map[f.id] = n++;
    });
  });
  return map;
}
