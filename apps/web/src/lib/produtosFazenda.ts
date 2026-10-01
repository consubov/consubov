import { supabase } from "@/integrations/supabase/client";

/**
 * Vínculo produto ↔ fazenda (tabela produtos_fazendas).
 * Retorna a lista de produto_id vinculados à fazenda informada.
 * Fazenda SEM nenhum vínculo cadastrado → lista vazia (sem fallback
 * para o catálogo completo): sem vínculo, sem produto.
 * Retorna null apenas quando não há fazenda em contexto ou a consulta
 * falhou (ex: offline) — nesse caso o chamador mantém o catálogo completo.
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
  return ((data ?? []) as { produto_id: string }[]).map((r) => r.produto_id);
}

/** Mensagem padrão quando a fazenda não tem nenhum produto vinculado. */
export const MSG_FAZENDA_SEM_PRODUTO =
  "Nenhum produto vinculado a esta fazenda — peça ao administrador para vincular um produto.";

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
