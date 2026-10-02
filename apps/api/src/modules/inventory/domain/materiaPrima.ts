/**
 * Crédito de matéria-prima por entrada de sacks
 * (migration 20260705231621:33-35):
 * `estoque_atual = COALESCE(estoque_atual,0) + COALESCE(quantidade,0)`.
 *
 * Não há piso zero aqui, ao contrário do saldo de retiro: o trigger roda só em
 * AFTER INSERT (migration 20260705231621:38-43) e soma qualquer quantidade
 * gravada. A tabela e a coluna pertencem ao módulo de fábrica.
 */
export function creditarEntradaMateriaPrima(
  estoqueAtual: number | null,
  quantidade: number | null,
): number {
  return (estoqueAtual ?? 0) + (quantidade ?? 0);
}

/**
 * Sinalização de estoque abaixo do mínimo: apenas leitura visual
 * (MateriasPrimasPage.tsx:132, FabricaDetailPage.tsx:584).
 *
 * Não bloqueia operação, não gera movimentação e não altera saldo; mínimo zero
 * ou nulo significa "sem mínimo cadastrado", portanto nunca sinaliza.
 */
export function estoqueAbaixoDoMinimo(input: {
  estoqueAtual: number | null;
  estoqueMinimo: number | null;
}): boolean {
  const minimo = input.estoqueMinimo ?? 0;
  return minimo > 0 && (input.estoqueAtual ?? 0) < minimo;
}