/**
 * Identificadores da fábrica de ração e das suas entidades.
 *
 * A tipagem de destino e de origem de transferência pertence ao módulo de
 * pasturas; aqui ficam apenas as entidades de fábrica.
 */
export type FabricaId = string & { readonly __brand: "FabricaId" };
export type FormulaId = string & { readonly __brand: "FormulaId" };
export type MateriaPrimaId = string & { readonly __brand: "MateriaPrimaId" };
export type BatidaId = string & { readonly __brand: "BatidaId" };
