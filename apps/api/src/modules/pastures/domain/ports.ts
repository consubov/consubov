import type { PastoId, RetiroId } from "./identity";
import type { OcupacaoPastoRecord, PastoRecord, RetiroRecord } from "./records";

/**
 * Fronteiras de leitura. São contratos: a implementação (acesso ao banco
 * remoto) fica fora do domínio e é resolvida pelo orquestrador.
 */
export interface PastoReaderPort {
  findById(pastoId: PastoId): Promise<PastoRecord | null>;
  listByRetiro(retiroId: RetiroId): Promise<readonly PastoRecord[]>;
}

export interface RetiroReaderPort {
  findById(retiroId: RetiroId): Promise<RetiroRecord | null>;
  listByFazenda(fazendaId: string): Promise<readonly RetiroRecord[]>;
}

export interface OcupacaoReaderPort {
  findByRetiro(retiroId: RetiroId): Promise<readonly OcupacaoPastoRecord[]>;
}
