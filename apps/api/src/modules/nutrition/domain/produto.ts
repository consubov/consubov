import type { ProdutoId } from "./identifiers";

/**
 * Consumo por categoria viva (g ou kg por 100kg PV, conforme a coluna).
 * Origem das colunas: tipo gerado do cliente web, tabela produtos.
 */
export type ProdutoConsumoPorCategoria = {
  consumo_recria1?: number | null;
  consumo_recria2?: number | null;
  consumo_engorda?: number | null;
};

/**
 * Margem legada por categoria (não percentual): valor por 100kg PV, usado apenas
 * quando o produto ainda não tem as margens percentuais preenchidas.
 */
export type ProdutoMargemPorCategoria = {
  margem_recria1?: number | null;
  margem_recria2?: number | null;
  margem_engorda?: number | null;
};

/**
 * Margens percentuais por categoria e o buffer da faixa amarela que sustentam a
 * classificação de quatro estados. Produto só tem "quatro estados" quando ambos os
 * percentuais da categoria viva estão preenchidos.
 *
 * Espelha apps/web/src/lib/consumoCalc.ts:9-23.
 */
export type ProdutoMargens = ProdutoConsumoPorCategoria &
  ProdutoMargemPorCategoria & {
    margem_mais_recria1_pct?: number | null;
    margem_menos_recria1_pct?: number | null;
    margem_mais_recria2_pct?: number | null;
    margem_menos_recria2_pct?: number | null;
    margem_mais_engorda_pct?: number | null;
    margem_menos_engorda_pct?: number | null;
    amarelo_buffer_g?: number | null;
  };

/**
 * Produto do catálogo. Os nomes das propriedades espelham as colunas persistidas
 * de propósito: este tipo é o contrato de leitura da coluna, não um DTO reformulado.
 *
 * `peso_saco_kg` é a única coluna numérica não nulo do catálogo, por isso as
 * funções de custo podem multiplicar por ela sem guarda.
 */
export type ProdutoRecord = ProdutoMargens & {
  id: ProdutoId;
  nome: string;
  peso_saco_kg: number;
  preco_por_kg: number | null;
  consumo_por_100kg: number | null;
  marca: string | null;
  tipo: string | null;
  tipo_outro: string | null;
  ativo: boolean | null;
  criado_em: string | null;
  /**
   * Administrador responsável pelo cadastro. É a chave da tabela de
   * administradores, que é entidade própria e não um principal de autenticação —
   * o dono do identificador de administrador ainda não está definido entre os
   * módulos da plataforma.
   */
  administrador_id: string | null;
};

/** Campos de peso e preço consumidos pelo cálculo de custo do lote. */
export type ProdutoCustoRef = Pick<ProdutoRecord, "peso_saco_kg" | "preco_por_kg">;

/**
 * Produto que vale para um lançamento: o do pasto tem precedência sobre o do
 * retiro, e sem nenhum dos dois não há produto para custo.
 * Origem: apps/web/src/lib/painelMetrics.ts:280-283.
 *
 * As entradas são apenas identificadores porque a tipagem de pasto e de retiro é
 * do módulo de pasturas; aqui só a precedência é regra de nutrição.
 */
export function resolverProdutoIdDoLote(
  produtoIdDoPasto: string | null | undefined,
  produtoIdDoRetiro: string | null | undefined,
): ProdutoId | null {
  return (produtoIdDoPasto ?? produtoIdDoRetiro ?? null) as ProdutoId | null;
}
