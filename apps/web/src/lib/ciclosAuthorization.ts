import { supabase } from "@/integrations/supabase/client";

/** Defesa adicional de UI; a autorizacao definitiva pertence ao servidor/RLS. */
export async function administradorAtivoParaReabertura(userId: string): Promise<boolean> {
  if (!userId) return false;

  try {
    const { data, error } = await supabase
      .from("administradores")
      .select("id")
      .eq("user_id", userId)
      .eq("ativo", true)
      .maybeSingle();

    return !error && Boolean(data?.id);
  } catch {
    return false;
  }
}
