import type { BatidaId, FabricaId, FormulaId, MateriaPrimaId } from "./identifiers";

/**
 * Situação de uma batida.
 *
 * O armazenamento guarda texto livre, mas "iniciada" e "finalizada" são os únicos
 * valores que o app grava e filtra
 * (apps/web/src/components/fabrica/ProducaoTab.tsx:206, :328 e :389).
 */
export type BatidaStatus = "iniciada" | "finalizada";

/**
 * Batida de produção.
 *
 * `quantidadeProduzida` só existe depois da finalização. `operadorId` é a chave da
 * tabela de operadores da fábrica, que é entidade própria e não um principal de
 * autenticação; o dono desse identificador ainda não está definido entre os módulos.
 */
export type BatidaRef = {
  id: BatidaId;
  fabricaId: FabricaId;
  formulaId: FormulaId;
  operadorId: string | null;
  dataInicio: string;
  horaInicio: string | null;
  dataFinalizacao: string | null;
  horaFinalizacao: string | null;
  quantidadeProduzida: number | null;
  status: BatidaStatus;
  observacao: string | null;
};

/**
 * Ingrediente registrado em uma batida.
 *
 * A quantidade esperada vem da fórmula em kg e é copiada para utilizada na
 * finalização.
 */
export type BatidaProducaoRef = {
  batidaId: BatidaId;
  materiaPrimaId: MateriaPrimaId;
  quantidadeEsperadaKg: number;
  quantidadeUtilizadaKg: number | null;
};

/**
 * Quantidade utilizada na finalização: a própria quantidade esperada.
 * Não existe leitura de consumo real pelo operador nesta etapa, então o valor
 * confirmado nunca diverge do planejado.
 * Origem: apps/web/src/components/fabrica/ProducaoTab.tsx:382-386.
 */
export function quantidadeUtilizadaPadraoKg(linha: {
  quantidadeEsperadaKg: number | null | undefined;
}): number {
  return Number(linha.quantidadeEsperadaKg ?? 0);
}
