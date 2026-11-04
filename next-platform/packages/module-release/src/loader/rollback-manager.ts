import { ModuleArtifactRelease } from '../catalog/types';

export interface GenerationHistory {
  current: ModuleArtifactRelease;
  fallbackNMinusOne: ModuleArtifactRelease | null;
}

export class RollbackManager {
  private activeGenerations = new Map<string, GenerationHistory>();

  public registerGenerations(
    moduleId: string,
    current: ModuleArtifactRelease,
    previous: ModuleArtifactRelease | null
  ): void {
    this.activeGenerations.set(moduleId, {
      current,
      fallbackNMinusOne: previous
    });
  }

  public getActiveGeneration(moduleId: string): ModuleArtifactRelease | null {
    return this.activeGenerations.get(moduleId)?.current ?? null;
  }

  public triggerRollback(moduleId: string, failureReason: string): ModuleArtifactRelease {
    const history = this.activeGenerations.get(moduleId);
    if (!history || !history.fallbackNMinusOne) {
      throw new Error(`FATAL_ROLLBACK_IMPOSSIBLE: Módulo ${moduleId} não possui geração N-1 íntegra registrada. Motivo: ${failureReason}`);
    }

    console.warn(`[ROLLBACK_ATIVADO] Módulo ${moduleId} revertendo de ${history.current.version} para ${history.fallbackNMinusOne.version}. Razão: ${failureReason}`);
    
    const fallback = history.fallbackNMinusOne;

    // Atualiza geração ativa
    this.activeGenerations.set(moduleId, {
      current: fallback,
      fallbackNMinusOne: null // Consumiu o fallback
    });

    return fallback;
  }
}
