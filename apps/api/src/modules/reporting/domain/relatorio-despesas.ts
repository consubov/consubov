import type { PrincipalId } from "../../identity-tenancy";

/** Periodos aceitos pelo CHECK de `relatorios_despesas.tipo_periodo` (migrations/20260713181955:5). */
export const RELATORIO_DESPESAS_PERIODOS = [
  "semanal",
  "quinzenal",
  "mensal",
  "personalizado",
] as const;

export type RelatorioDespesasPeriodo = (typeof RELATORIO_DESPESAS_PERIODOS)[number];

/**
 * A tabela guarda apenas metadados do relatório: não há coluna de itens, e os
 * lançamentos de despesa vivem em `despesas_combustivel`, criada na mesma
 * migration e referenciada por `relatorio_despesa_id`
 * (migrations/20260713181955:2-11,23-31). Por isso este registro não carrega
 * itens nem regra de agregação de despesas.
 *
 * `id` permanece `string`: a lista de donos de identificadores não inclui
 * `reporting`, então o módulo não declara uma marca própria aqui.
 * Espelho das colunas em types.ts:4182-4190.
 */
export type RelatorioDespesasRecord = {
  id: string;
  consultor_id: PrincipalId;
  tipo_periodo: RelatorioDespesasPeriodo;
  data_inicio: string;
  data_fim: string;
  valor_total: number;
  gerado_em: string;
  pdf_url: string | null;
};