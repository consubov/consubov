import type { FormulaConfig } from "./formulasSistema";
import type { ProdutoId } from "./identifiers";
import type { ProdutoRecord } from "./produto";

/**
 * Leitura do catálogo de produtos.
 *
 * O catálogo é global: a associação com a fazenda é lida de outra tabela, por isso
 * esta porta não recebe tenant. A implementação fica em um adaptador, fora do
 * domínio, e é responsável por resolver a persistência.
 */
export interface ProductNutritionReader {
  findById(produtoId: ProdutoId): Promise<ProdutoRecord | null>;
  listAtivos(): Promise<readonly ProdutoRecord[]>;
}

/**
 * Leitura da parametrização de fórmulas do sistema.
 *
 * A implementação decide a origem (registro do banco ou FORMULAS_FALLBACK) e
 * devolve o contrato já normalizado; o domínio não sabe de onde veio.
 */
export interface FormulaConfigReader {
  load(): Promise<FormulaConfig>;
}
