import { supabase } from "@/integrations/supabase/client";

/**
 * Vínculo produto ↔ fazenda (tabela produtos_fazendas).
 * Retorna a lista de produto_id vinculados à fazenda informada.
 * Retorna null quando não há filtro a aplicar (sem fazenda em contexto,
 * erro de consulta ou fazenda ainda sem nenhum vínculo cadastrado) —
 * nesse caso o chamador deve manter o comportamento anterior (catálogo completo).
 */
export async function fetchProdutoIdsDaFazenda(
  fazendaId?: string | null,
): Promise<string[] | null> {
  if (!fazendaId) return null;
  const { data, error } = await (supabase as any)
    .from("produtos_fazendas")
    .select("produto_id")
    .eq("fazenda_id", fazendaId);
  if (error) {
    console.error("[produtosFazenda] erro ao carregar vínculos:", error);
    return null;
  }
  const ids = ((data ?? []) as { produto_id: string }[]).map((r) => r.produto_id);
  return ids.length > 0 ? ids : null;
}

/** Descobre a fazenda de um retiro. */
export async function fetchFazendaIdDoRetiro(retiroId?: string | null): Promise<string | null> {
  if (!retiroId) return null;
  const { data } = await supabase
    .from("retiros")
    .select("fazenda_id")
    .eq("id", retiroId)
    .maybeSingle();
  return (data as any)?.fazenda_id ?? null;
}

/** Todos os vínculos, agrupados por produto_id → fazenda_id[]. */
export async function fetchVinculosPorProduto(): Promise<Record<string, string[]>> {
  const { data, error } = await (supabase as any)
    .from("produtos_fazendas")
    .select("produto_id, fazenda_id");
  if (error) {
    console.error("[produtosFazenda] erro ao carregar vínculos:", error);
    return {};
  }
  const map: Record<string, string[]> = {};
  for (const row of (data ?? []) as { produto_id: string; fazenda_id: string }[]) {
    (map[row.produto_id] ||= []).push(row.fazenda_id);
  }
  return map;
}

/**
 * Substitui os vínculos de um produto pelas fazendas selecionadas.
 * Quando `escopoFazendaIds` é informado (caso do Gerente), apenas os vínculos
 * dessas fazendas são alterados — vínculos de outras fazendas ficam intactos.
 */
export async function salvarVinculosProduto(
  produtoId: string,
  fazendaIds: string[],
  escopoFazendaIds?: string[],
) {
  const client = supabase as any;
  let del = client.from("produtos_fazendas").delete().eq("produto_id", produtoId);
  if (escopoFazendaIds) del = del.in("fazenda_id", escopoFazendaIds);
  const { error: delErr } = await del;
  if (delErr) throw delErr;

  const alvo = escopoFazendaIds
    ? fazendaIds.filter((id) => escopoFazendaIds.includes(id))
    : fazendaIds;
  if (alvo.length === 0) return;
  const { error } = await client
    .from("produtos_fazendas")
    .insert(alvo.map((fazenda_id) => ({ produto_id: produtoId, fazenda_id })));
  if (error) throw error;
}
