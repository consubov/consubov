import type {
  ArquivoCaminho,
  ArquivoReferencia,
  StoreFileCommand,
} from "./arquivo";
import type { TenantExecutionContext } from "../../identity-tenancy/domain/tenant-context";

/**
 * Fronteira de armazenamento de objetos. Nenhum provider está conectado nesta
 * fase: as implementações concretas ficam fora do domínio e nenhuma delas é
 * criada pela FASE 2.1.
 */
export interface FileStoragePort {
  store(command: StoreFileCommand, context?: TenantExecutionContext): Promise<ArquivoReferencia>;
  findRef(caminho: ArquivoCaminho, context?: TenantExecutionContext): Promise<ArquivoReferencia | null>;
  remove(caminho: ArquivoCaminho, context?: TenantExecutionContext): Promise<void>;
}

/**
 * URLs assinadas com prazo curto, distintas da leitura pública do bucket
 * compartilhado. Tempos comprovados no legado:
 * - foto de consulta: 6 horas, com expiração local em 5 horas
 *   (apps/web/src/lib/consultorOffline/signedUrlCache.ts:8,22);
 * - logo e comprovante: 1 hora (apps/web/src/lib/visitaPdf.ts:99,119;
 *   apps/web/src/pages/ConsultorDespesasPage.tsx:95,206);
 * - foto de auditoria de saída: 5 minutos
 *   (apps/web/src/components/gerente/AuditoriaFotosTab.tsx:318).
 */
export interface SignedUrlPort {
  createSignedUrl(
    caminho: ArquivoCaminho,
    ttlSegundos: number,
    context?: TenantExecutionContext,
  ): Promise<string>;
}
