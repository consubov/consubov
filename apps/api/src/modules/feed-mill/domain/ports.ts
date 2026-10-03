import type { TenantExecutionContext } from "../../identity-tenancy";
import type { BatidaRef, BatidaProducaoRef, BatidaStatus } from "./batida";
import type { FormulaIngrediente, FormulaRef } from "./formula";
import type { BatidaId, FabricaId, FormulaId, MateriaPrimaId } from "./identifiers";
import type { MateriaPrimaRef } from "./materiaPrima";

/**
 * Leitura de fórmulas de fábrica e de seus ingredientes.
 *
 * A implementação fica em um adaptador fora do domínio. Os ingredientes vêm
 * sempre em kg porque é a única unidade em que a tabela os guarda.
 */
export interface FormulaReader {
  findById(formulaId: FormulaId, context: TenantExecutionContext): Promise<FormulaRef | null>;
  listAtivasPorFabrica(
    fabricaId: FabricaId,
    context: TenantExecutionContext,
  ): Promise<readonly FormulaRef[]>;
  listIngredientes(
    formulaId: FormulaId,
    context: TenantExecutionContext,
  ): Promise<readonly FormulaIngrediente[]>;
}

/** Leitura do catálogo de matérias-primas de uma fábrica. */
export interface MateriaPrimaReader {
  findById(
    materiaPrimaId: MateriaPrimaId,
    context: TenantExecutionContext,
  ): Promise<MateriaPrimaRef | null>;
  listAtivasPorFabrica(
    fabricaId: FabricaId,
    context: TenantExecutionContext,
  ): Promise<readonly MateriaPrimaRef[]>;
}

/** Leitura de batidas e dos ingredientes registrados em cada batida. */
export interface BatidaReader {
  findById(batidaId: BatidaId, context: TenantExecutionContext): Promise<BatidaRef | null>;
  listPorFabrica(
    fabricaId: FabricaId,
    filtro: { status?: BatidaStatus },
    context: TenantExecutionContext,
  ): Promise<readonly BatidaRef[]>;
  listProducao(
    batidaId: BatidaId,
    context: TenantExecutionContext,
  ): Promise<readonly BatidaProducaoRef[]>;
}
