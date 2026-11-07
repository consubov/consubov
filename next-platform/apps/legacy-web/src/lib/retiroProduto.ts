/**
 * Campos copiados do produto para o retiro ao trocar o produto ativo.
 * Usado pela RetiroConfigSection (Admin) e pelo card de produto do Gerente.
 * Comportamento idêntico nos dois fluxos (opção A): peso do saco, preço,
 * consumo e margens de Recria 1, Recria 2 e Engorda vêm do novo produto.
 */

export interface ProdutoParaRetiro {
  id: string;
  peso_saco_kg: number | null;
  preco_por_kg: number | null;
  consumo_recria1: number | null;
  consumo_recria2: number | null;
  consumo_engorda: number | null;
  margem_recria1: number | null;
  margem_recria2: number | null;
  margem_engorda: number | null;
}

export interface CamposProdutoRetiro {
  produto_id: string | null;
  peso_saco_kg: number | null;
  preco_por_kg: number | null;
  consumo_recria1: number | null;
  consumo_recria2: number | null;
  consumo_engorda: number | null;
  margem_recria1: number | null;
  margem_recria2: number | null;
  margem_engorda: number | null;
}

/**
 * Monta os campos do retiro ao trocar o produto, preservando o valor atual
 * do retiro quando o produto não tem o campo preenchido (?? prev).
 */
export function camposProdutoParaRetiro(
  produto: ProdutoParaRetiro | undefined,
  produtoId: string,
  prev: Omit<CamposProdutoRetiro, "produto_id">,
): CamposProdutoRetiro {
  return {
    produto_id: produtoId || null,
    peso_saco_kg: produto?.peso_saco_kg ?? prev.peso_saco_kg,
    preco_por_kg: produto?.preco_por_kg ?? prev.preco_por_kg,
    consumo_recria1: produto?.consumo_recria1 ?? prev.consumo_recria1,
    consumo_recria2: produto?.consumo_recria2 ?? prev.consumo_recria2,
    consumo_engorda: produto?.consumo_engorda ?? prev.consumo_engorda,
    margem_recria1: produto?.margem_recria1 ?? prev.margem_recria1,
    margem_recria2: produto?.margem_recria2 ?? prev.margem_recria2,
    margem_engorda: produto?.margem_engorda ?? prev.margem_engorda,
  };
}
