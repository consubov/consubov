import type { TenantExecutionContext } from "../../identity-tenancy";
import type { FarmId, FarmRecord } from "./farm";

/**
 * Leitura de fazenda. Sem escrita nesta fase: o legado continua sendo o dono
 * dos dados e a API não está conectada a nenhuma persistência.
 */
export interface FarmReaderPort {
  findById(id: FarmId, context: TenantExecutionContext): Promise<FarmRecord | null>;
}
