import type { FabricaId, MateriaPrimaId } from "./identifiers";

/**
 * Unidade de estoque aceita no cadastro de matéria-prima.
 * Origem: apps/web/src/pages/MateriasPrimasPage.tsx:33 e
 * apps/web/src/pages/FabricaDetailPage.tsx:56.
 *
 * Estas são as unidades que o app oferece. A única conversão implementada em
 * produção é saco↔kg (ver isMateriaEmSaco); litro, unidade e tonelada são
 * estoque opaco, sem conversão comprovada.
 */
export type UnidadeMateriaPrima =
  | "kg"
  | "saco"
  | "litro"
  | "unidade"
  | "tonelada";

/**
 * Matéria-prima da fábrica.
 *
 * `pesoPorSaco` só tem efeito quando a unidade é "saco"; para as demais é
 * ignorado. `estoqueAtual` é sempre na unidade de `unidade`, exceto quando a
 * unidade é "saco", e nesse caso conta sacos — não kg.
 */
export type MateriaPrimaRef = {
  id: MateriaPrimaId;
  fabricaId: FabricaId;
  nome: string;
  unidade: UnidadeMateriaPrima;
  pesoPorSaco: number | null;
  estoqueAtual: number | null;
  estoqueMinimo: number | null;
  ativo: boolean | null;
};
