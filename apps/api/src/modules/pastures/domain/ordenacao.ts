/**
 * Ordenação canônica da lista de pastos. Existe para que a lista não "pule" ao
 * alternar entre as duas fontes de dados do legado (mesma ordem no cache local
 * e nos dados do servidor).
 * Fonte: apps/web/src/lib/offlineDb.ts:283-287
 */
export function sortPastos<T extends { nome?: string | null }>(
  pastos: readonly T[],
): T[] {
  return [...pastos].sort((a, b) =>
    (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR", {
      numeric: true,
      sensitivity: "base",
    }),
  );
}
