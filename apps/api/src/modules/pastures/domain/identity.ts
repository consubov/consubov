/**
 * Identificadores e categoria do pasto.
 *
 * `RetiroId` e `PastoId` têm marca para que um retiro nunca seja usado onde se
 * espera um pasto. O retiro é dono da fazenda (`retiros.fazenda_id`), e o pasto
 * é dono do retiro (`pastos.retiro_id`) — a fazenda NÃO é um tenant: a tabela
 * `fazendas` não tem coluna de tenant (types.ts:1687-1703).
 *
 * Aqui mora a categoria do PASTO (coluna `pastos.categoria`), inclusive o valor
 * "Cria". A categoria derivada de peso e sexo para consumir ração é do módulo
 * `nutrition`, que tem lista própria e não inclui "Cria".
 */
export type RetiroId = string & { readonly __brand: "RetiroId" };
export type PastoId = string & { readonly __brand: "PastoId" };

// Lista única de categorias aceitas no salvamento do pasto.
// Fonte: apps/web/src/lib/categoriaPasto.ts:2
export const CATEGORIAS_PASTO = [
  "Engorda",
  "Recria 1",
  "Recria 2",
  "Cria",
] as const;

export type CategoriaPasto = (typeof CATEGORIAS_PASTO)[number];

/**
 * A coluna `pastos.categoria` é texto livre no banco (types.ts:3291); por isso a
 * validação é feita no domínio e não pelo tipo.
 * Fonte: apps/web/src/lib/categoriaPasto.ts:6-8
 */
export function isCategoriaValida(
  categoria: string | null | undefined,
): boolean {
  return (
    !!categoria && (CATEGORIAS_PASTO as readonly string[]).includes(categoria)
  );
}

/**
 * Pasto com cabeças e sem categoria válida não pode ser salvo.
 * Fonte: apps/web/src/lib/categoriaPasto.ts:11-13
 */
export function faltaCategoria(
  numAnimaisFinal: number,
  categoria: string | null | undefined,
): boolean {
  return numAnimaisFinal > 0 && !isCategoriaValida(categoria);
}
