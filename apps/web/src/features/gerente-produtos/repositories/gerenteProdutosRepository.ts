import { supabase } from "@/integrations/supabase/client";

interface RetiroFazenda {
  fazenda_id: string;
}

/** Resolves the farm used by the existing manager-products retiro shortcut. */
export async function findFazendaIdByRetiro(
  retiroId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("retiros")
    .select("fazenda_id")
    .eq("id", retiroId)
    .maybeSingle();

  return (data as RetiroFazenda | null)?.fazenda_id ?? null;
}
