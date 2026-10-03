import type { TenantExecutionContext } from "../../identity-tenancy";
import type { RetiroId } from "../../pastures";
import type { EstoqueRetiro } from "./consumo";
import type { MovimentacaoEstoque } from "./movimentacao";
import type { BucketPeriodo } from "./periodo";
import type { TransferenciaEstoque } from "./transferencia";

/**
 * Fronteira de leitura do inventário.
 *
 * Não há porta de escrita: quem decide gravar é a aplicação, e o saldo do bucket
 * só pode ser alterado com a serialização que já existe na base
 * (SELECT … FOR UPDATE em migration 20260922102509:139-147) mais a idempotência
 * por `referencia_id` + `origem='salga'` (índice parcial em
 * migration 20260626214626:1-2). Modelar isso aqui criaria uma regra que ainda
 * não foi decidida.
 */
export interface EstoqueRetiroLeituraPort {
  buscarSaldoDoBucket(
    retiroId: RetiroId,
    periodo: BucketPeriodo,
    context: TenantExecutionContext,
  ): Promise<EstoqueRetiro | null>;

  listarSaldosPorPeriodo(
    retiroIds: readonly RetiroId[],
    periodo: BucketPeriodo,
    context: TenantExecutionContext,
  ): Promise<readonly EstoqueRetiro[]>;
}

export interface MovimentacaoEstoqueLeituraPort {
  listarPorPeriodo(
    retiroId: RetiroId,
    periodo: BucketPeriodo,
    context: TenantExecutionContext,
  ): Promise<readonly MovimentacaoEstoque[]>;
}

export interface TransferenciaEstoqueLeituraPort {
  buscarPorId(
    id: TransferenciaEstoque["id"],
    context: TenantExecutionContext,
  ): Promise<TransferenciaEstoque | null>;

  listarEnvolvendoRetiros(
    retiroIds: readonly RetiroId[],
    context: TenantExecutionContext,
  ): Promise<readonly TransferenciaEstoque[]>;
}