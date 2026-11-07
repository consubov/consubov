import { supabase } from "@/integrations/supabase/client";

export type UserRoleTable =
  | "capatazes"
  | "gerentes"
  | "administradores"
  | "operadores_fabrica";

export const normalizeUserDisplayName = (
  name?: string | null,
): string | null => (name && !name.includes("@") ? name : null);

/**
 * Finds the first valid display name following the caller-provided role-table
 * order. Query errors intentionally behave like missing data, matching the
 * previous hook semantics.
 */
export async function findUserDisplayName(
  userId: string,
  tables: UserRoleTable[],
): Promise<string | null> {
  for (const table of tables) {
    const { data } = await (supabase as any)
      .from(table)
      .select("nome")
      .eq("user_id", userId)
      .maybeSingle();

    const name = normalizeUserDisplayName(data?.nome);
    if (name) return name;
  }

  return null;
}
