import { RollbackManager, globalRollbackManager } from './rollback-manager';

export interface SafeDynamicImportOptions<T> {
  moduleId: string;
  maxRetries?: number;
  retryDelayMs?: number;
  fallbackImporter?: () => Promise<T>;
  onRollback?: (moduleId: string, error: unknown) => void;
  rollbackManager?: RollbackManager;
}

export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as Record<string, unknown>;
  const msg = typeof err['message'] === 'string' ? err['message'].toLowerCase() : '';
  const name = typeof err['name'] === 'string' ? err['name'] : '';

  return (
    name === 'ChunkLoadError' ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('404') ||
    msg.includes('chunk')
  );
}

/**
 * Wrapper resiliente para carregamento de módulos e lazy chunks em tempo de execução.
 * Intercepta erros HTTP 404 de chunks obsoletos ou falhas de rede transitórias,
 * realizando retries e acionando rollback atômico para a versão N-1 sem provocar Tela Branca (WSOD).
 */
export async function safeDynamicImport<T>(
  importer: () => Promise<T>,
  options: SafeDynamicImportOptions<T>
): Promise<T> {
  const {
    moduleId,
    maxRetries = 2,
    retryDelayMs = 200,
    fallbackImporter,
    onRollback,
    rollbackManager = globalRollbackManager
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await importer();
    } catch (err: unknown) {
      lastError = err;

      const isChunk = isChunkLoadError(err);
      if (isChunk) {
        console.warn(
          `[CHUNK_LOAD_WARN] Falha ao carregar chunk do módulo '${moduleId}' (tentativa ${attempt + 1}/${maxRetries + 1}).`
        );
      }

      // Se não for a última tentativa, aguarda com backoff exponencial
      if (attempt < maxRetries) {
        const delay = retryDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // Esgotadas as tentativas: aciona fallback / rollback
  console.error(
    `[CHUNK_FATAL_RECOVERY] Esgotadas ${maxRetries + 1} tentativas de carregar módulo '${moduleId}'. Acionando recuperação por rollback.`
  );

  if (rollbackManager.hasFallback(moduleId)) {
    try {
      rollbackManager.triggerRollback(
        moduleId,
        `Falha irrecuperável de carregamento de chunk: ${lastError instanceof Error ? lastError.message : String(lastError)}`
      );
    } catch (rbErr) {
      console.error(`[ROLLBACK_ERROR] Erro ao registrar triggerRollback:`, rbErr);
    }
  }

  onRollback?.(moduleId, lastError);

  if (fallbackImporter) {
    try {
      console.log(`[ROLLBACK_FALLBACK] Carregando módulo '${moduleId}' via fallbackImporter N-1...`);
      return await fallbackImporter();
    } catch (fallbackErr) {
      console.error(`[ROLLBACK_FALLBACK_FAILED] Fallback também falhou para módulo '${moduleId}':`, fallbackErr);
      throw fallbackErr;
    }
  }

  throw lastError;
}
