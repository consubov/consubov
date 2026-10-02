import type { ProdutoId } from "../../nutrition";
import type { FabricaId, FormulaId, MateriaPrimaId } from "./identifiers";

/**
 * Fórmula de fábrica: a receita de uma batida e o produto que ela rende.
 *
 * `pesoBatida`, `pesoPorSaco` e `producaoEsperada` são obrigatórios no
 * armazenamento, mas o app trabalha com eles como se pudessem faltar, então as
 * funções que os consomem aceitam nulo e tratam como zero.
 *
 * `produtoId` é do catálogo de nutrição; quando é nulo a finalização da batida
 * não pode creditar estoque de produto acabado.
 */
export type FormulaRef = {
  id: FormulaId;
  fabricaId: FabricaId;
  nome: string;
  pesoBatida: number;
  pesoPorSaco: number;
  producaoEsperada: number;
  produtoId: ProdutoId | null;
  ativo: boolean | null;
};

/**
 * Ingrediente de uma fórmula.
 *
 * A quantidade é SEMPRE em kg: o armazenamento de ingrediente não tem coluna de
 * unidade e o app apresenta a soma dos ingredientes rotulada em kg
 * (apps/web/src/components/fabrica/FormulasTab.tsx:266).
 */
export type FormulaIngrediente = {
  formulaId: FormulaId;
  materiaPrimaId: MateriaPrimaId;
  quantidadeKg: number;
};

/**
 * Soma dos ingredientes da fórmula em kg.
 * Origem: apps/web/src/components/fabrica/FormulasTab.tsx:95.
 */
export function somarIngredientesKg(
  ingredientes: readonly FormulaIngrediente[],
): number {
  return ingredientes.reduce(
    (soma, ingrediente) => soma + (Number(ingrediente.quantidadeKg) || 0),
    0,
  );
}

/**
 * Ingrediente que pode ser salvo: matéria-prima escolhida e quantidade positiva.
 * A checagem usa a quantidade já convertida para número, então texto vazio ou
 * inválido não passa.
 * Origem: apps/web/src/components/fabrica/FormulasTab.tsx:102.
 */
export function ehIngredienteValido(ingrediente: {
  materiaPrimaId: string | null | undefined;
  quantidadeKg: number | null | undefined;
}): boolean {
  return Boolean(ingrediente.materiaPrimaId) &&
    (Number(ingrediente.quantidadeKg) || 0) > 0;
}
