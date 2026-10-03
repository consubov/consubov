import type { PastoId, RetiroId } from "../../pastures";
import type { PrincipalId } from "../../identity-tenancy";
import type { TenantExecutionContext } from "../../identity-tenancy";
import type { PainelMetricsAggregate, RetiroMetricsAggregate } from "./agregados";
import type { RelatorioDespesasRecord } from "./relatorio-despesas";

/** Leitura dos metadados de relatório de despesas, sem itens (migrations/20260713181955:2-11,23-31). */
export interface RelatorioDespesasReader {
  findById(id: string, context: TenantExecutionContext): Promise<RelatorioDespesasRecord | null>;
  listByConsultor(consultorId: PrincipalId, context: TenantExecutionContext): Promise<readonly RelatorioDespesasRecord[]>;
}

/** Mês e ano de referência dos lançamentos (painelMetrics.ts:38-40). */
export type PeriodoReferencia = {
  mes: number | null;
  ano: number;
};

export type PainelMetricsFiltro = PeriodoReferencia & {
  retiroId?: RetiroId;
  pastoId?: PastoId;
};

/**
 * As métricas do painel chegam prontas: a API não recalcula consumo médio, custo
 * diário, custo mensal, eficiência nem a distribuição de status, porque hoje cada
 * tela recalcula o seu próprio número e não existe agregação compartilhada entre
 * módulos (apps/web/src/lib/painelMetrics.ts:298-350,352-399).
 */
export interface PainelMetricsReader {
  aggregate(filtro: PainelMetricsFiltro, context: TenantExecutionContext): Promise<PainelMetricsAggregate>;
  aggregateByRetiro(filtro: PainelMetricsFiltro, context: TenantExecutionContext): Promise<RetiroMetricsAggregate>;
}

/**
 * GMD de projeção por pasto. A fonte única é a função de banco
 * `gmd_do_pasto(p_pasto, p_dia)`, a mesma do motor diário e da previsão de abate;
 * nada é recalculado na aplicação (apps/web/src/lib/gmdConfigurado.ts:3-6,26-39).
 * `null` significa pasto sem GMD definido (gmdConfigurado.ts:35).
 */
export interface GmdProjectionReader {
  read(
    pastoIds: readonly PastoId[],
    dia: string,
    context: TenantExecutionContext,
  ): Promise<ReadonlyMap<PastoId, number | null>>;
}