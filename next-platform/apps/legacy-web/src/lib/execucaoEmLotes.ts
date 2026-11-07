/**
 * Executa gravações independentes em lotes pequenos e previsíveis.
 * Em caso de erro, aguarda todas as gravações já iniciadas e não inicia novos lotes.
 * Não promete atomicidade: gravações anteriores podem ter sido concluídas.
 */
const LIMITE_GRAVACOES_PARALELAS = 4;

export async function executarEmLotes<T>(
  itens: readonly T[],
  gravar: (item: T) => Promise<void>,
): Promise<void> {
  for (let inicio = 0; inicio < itens.length; inicio += LIMITE_GRAVACOES_PARALELAS) {
    const lote = itens.slice(inicio, inicio + LIMITE_GRAVACOES_PARALELAS);
    const resultados = await Promise.allSettled(lote.map((item) => Promise.resolve().then(() => gravar(item))));
    const falha = resultados.find((resultado) => resultado.status === "rejected");
    if (falha?.status === "rejected") throw falha.reason;
  }
}
