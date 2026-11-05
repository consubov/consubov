import {
  ApplicationReleaseCatalog,
  ApplicationReleaseCatalogSchema,
  ModuleArtifactRelease
} from './manifest.schema';
import { verifyChunkIntegritySha256 } from '../loader/integrity-check';
import { RollbackManager, globalRollbackManager } from '../loader/rollback-manager';

export class ReleaseManager {
  private currentCatalog: ApplicationReleaseCatalog | null = null;

  constructor(private readonly rollbackManager: RollbackManager = globalRollbackManager) {}

  public loadManifest(rawJson: unknown): ApplicationReleaseCatalog {
    const parsed = ApplicationReleaseCatalogSchema.parse(rawJson);
    this.currentCatalog = parsed;

    // Registra gerações no RollbackManager para cada módulo declarado
    for (const [moduleId, moduleData] of Object.entries(parsed.modules)) {
      this.rollbackManager.registerGenerations(moduleId, moduleData, null);
    }

    return parsed;
  }

  public registerModuleWithFallback(
    moduleId: string,
    current: ModuleArtifactRelease,
    previous: ModuleArtifactRelease | null
  ): void {
    this.rollbackManager.registerGenerations(moduleId, current, previous);
  }

  public async verifyChunk(
    chunkContent: string | ArrayBuffer | Uint8Array,
    expectedSha256: string
  ): Promise<boolean> {
    return verifyChunkIntegritySha256(chunkContent, expectedSha256);
  }

  public getCurrentVersion(): string {
    if (!this.currentCatalog) {
      throw new Error('CATALOG_NOT_LOADED: Nenhum catálogo de release foi carregado.');
    }
    return this.currentCatalog.current_version;
  }

  public getModule(moduleId: string): ModuleArtifactRelease | null {
    return this.rollbackManager.getActiveGeneration(moduleId);
  }

  public getRollbackManager(): RollbackManager {
    return this.rollbackManager;
  }

  public triggerRollback(moduleId: string, reason: string): ModuleArtifactRelease {
    return this.rollbackManager.triggerRollback(moduleId, reason);
  }
}

export const globalReleaseManager = new ReleaseManager();
