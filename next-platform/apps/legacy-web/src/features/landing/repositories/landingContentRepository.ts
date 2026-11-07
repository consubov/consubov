import { supabase } from "@/integrations/supabase/client";

export type LandingContent = Record<string, string>;
export type LandingSlug = "consubov" | "relatto";

type LandingContentRow = {
  chave: string;
  valor: string | null;
};

/**
 * Keeps the persistence detail for landing content outside React hooks.
 *
 * Error semantics intentionally match the previous hook behavior: Supabase
 * responses with no data resolve to an empty content map instead of throwing.
 */
export async function fetchLandingContent(
  slug: LandingSlug,
): Promise<LandingContent> {
  const { data } = await supabase
    .from("landing_page_content")
    .select("chave, valor")
    .eq("landing_slug", slug);

  const content: LandingContent = {};

  for (const row of (data ?? []) as LandingContentRow[]) {
    content[row.chave] = row.valor ?? "";
  }

  return content;
}
