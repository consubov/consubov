import type { TenantExecutionContext } from "../../identity-tenancy";
import type { PastoId, RetiroId } from "./identity";
import type { OcupacaoPastoRecord, PastoRecord, RetiroRecord } from "./records";

/**
 * Fronteiras de leitura. São contratos: a implementação (acesso ao banco
 * remoto) fica fora do domínio e é resolvida pelo orquestrador.
 */
export interface PastoReaderPort {
  findById(pastoId: PastoId, context: TenantExecutionContext): Promise<PastoRecord | null>;
  listByRetiro(
    retiroId: RetiroId,
    context: TenantExecutionContext,
  ): Promise<readonly PastoRecord[]>;
}

export interface RetiroReaderPort {
  findById(retiroId: RetiroId, context: TenantExecutionContext): Promise<RetiroRecord | null>;
  listByFazenda(
    fazendaId: string,
    context: TenantExecutionContext,
  ): Promise<readonly RetiroRecord[]>;
}

export interface OcupacaoReaderPort {
  findByRetiro(
    retiroId: RetiroId,
    context: TenantExecutionContext,
  ): Promise<readonly OcupacaoPastoRecord[]>;
}
