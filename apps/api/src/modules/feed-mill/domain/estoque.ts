import type { ProdutoRecord } from "../../nutrition";
import type { FormulaRef } from "./formula";
import type { MateriaPrimaRef } from "./materiaPrima";

/**
 * A matéria-prima só é contada em sacos quando a unidade é "saco" E o peso do
 * saco está preenchido. Sack com peso desconhecido cai para kg, porque sem peso
 * não há conversão possível e o valor cru é a única leitura segura.
 * Origem: apps/web/src/components/fabrica/ProducaoTab.tsx:59-61.
 */
export function isMateriaEmSaco(mp?: MateriaPrimaRef | null): boolean {
  return mp?.unidade === "saco" && Number(mp.pesoPorSaco ?? 0) > 0;
}

/**
 * Quantidade debitada do estoque por um consumo em kg.
 *
 * Para matéria em saco o consumo é convertido para sacos e arredondado para
 * cima, de modo que a baixa nunca fica abaixo do que a fórmula pede. Para as
 * demais unidades o valor em kg é usado diretamente — não existe conversão
 * comprovada para litro, unidade ou tonelada.
 * Origem: apps/web/src/components/fabrica/ProducaoTab.tsx:85-88.
 */
export function getMateriaQuantidadeEmEstoque(
  quantidadeKg: number,
  mp?: MateriaPrimaRef | null,
): number {
  if (!isMateriaEmSaco(mp)) return quantidadeKg;

  const pesoPorSaco = Number((mp as MateriaPrimaRef).pesoPorSaco ?? 1);
  return Math.ceil(quantidadeKg / pesoPorSaco);
}

/**
 * O estoque cobre a quantidade pedida pela fórmula.
 * Origem: apps/web/src/components/fabrica/ProducaoTab.tsx:90-93.
 *
 * Falta de estoque não bloqueia a batida: a decisão é do operador no momento do
 * início, fora do domínio.
 */
export function hasEstoqueSuficiente(
  quantidadeKg: number,
  mp?: MateriaPrimaRef | null,
): boolean {
  const estoque = Number(mp?.estoqueAtual ?? 0);
  return estoque >= getMateriaQuantidadeEmEstoque(quantidadeKg, mp);
}

/**
 * Estoque restante depois da baixa por início de batida.
 *
 * O piso é zero: uma baixa maior que o estoque zera em vez de gerar estoque
 * negativo.
 * Origem: apps/web/src/components/fabrica/ProducaoTab.tsx:343-348.
 */
export function aplicarBaixaDeEstoque(
  estoqueAtual: number | null | undefined,
  quantidadeKg: number,
  mp?: MateriaPrimaRef | null,
): number {
  const atual = Number(estoqueAtual ?? 0);
  return Math.max(0, atual - getMateriaQuantidadeEmEstoque(quantidadeKg, mp));
}

/**
 * Peso do saco usado para converter sacos produzidos em kg.
 *
 * O peso do produto tem precedência sobre o peso declarado na fórmula: o produto
 * é a embalagem real que sai da fábrica.
 * Origem: apps/web/src/components/fabrica/ProducaoTab.tsx:405.
 */
export function resolverPesoPorSaco(
  produto: Pick<ProdutoRecord, "peso_saco_kg"> | null | undefined,
  formula: Pick<FormulaRef, "pesoPorSaco">,
): number {
  return Number(produto?.peso_saco_kg ?? formula.pesoPorSaco ?? 0);
}

/** Kg de ração equivalentes aos sacos produzidos. */
export function calcularKgProduzidos(
  quantidadeSacos: number,
  pesoPorSaco: number,
): number {
  return quantidadeSacos * pesoPorSaco;
}

export type EstoqueProdutoAcabadoRef = {
  quantidadeSacos: number | null;
  quantidadeKg: number | null;
};

/**
 * Acúmulo da batida no estoque de produto acabado, por produto.
 *
 * Somar sobre um estoque inexistente é o mesmo que criar a linha: a quantidade
 * anterior entra como zero.
 * Origem: apps/web/src/components/fabrica/ProducaoTab.tsx:412-424.
 */
export function acumularEstoqueProdutoAcabado(
  existente: EstoqueProdutoAcabadoRef | null | undefined,
  quantidadeSacos: number,
  quantidadeKg: number,
): Required<EstoqueProdutoAcabadoRef> {
  return {
    quantidadeSacos: Number(existente?.quantidadeSacos || 0) + quantidadeSacos,
    quantidadeKg: Number(existente?.quantidadeKg || 0) + quantidadeKg,
  };
}
