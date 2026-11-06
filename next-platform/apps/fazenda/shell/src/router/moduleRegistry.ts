import { UserProfileId } from '@consubov/contracts';
import { FazendaModuleId } from '@consubov/contracts';

export interface FazendaModuleDescriptor {
  moduleId: FazendaModuleId;
  profileId: Exclude<UserProfileId, 'administrador'>;
  basePath: string;
  titleKey: string;
  iconName: string;
  /** Runtime artifact URL. Resolving this URL is forbidden until auth and context selection succeed. */
  entryUrl: string;
  /** Expected artifact origin. Same-origin hosting is a delivery boundary, not a security boundary. */
  expectedOrigin: string;
  capabilities: readonly string[];
}

const artifactBase = import.meta.env.VITE_MODULE_ARTIFACT_BASE_URL ?? (import.meta.env.DEV ? 'http://127.0.0.1:5190/modules' : '/modules');

function descriptor(
  moduleId: FazendaModuleId,
  titleKey: string,
  iconName: string,
  capabilities: readonly string[]
): FazendaModuleDescriptor {
  return {
    moduleId,
    profileId: moduleId,
    basePath: `/fazenda/${moduleId}`,
    titleKey,
    iconName,
    entryUrl: `${artifactBase}/${moduleId}/current/index.html`,
    expectedOrigin: new URL(artifactBase, globalThis.location?.origin ?? 'http://127.0.0.1:5173').origin,
    capabilities
  };
}

/** Public catalog metadata only; it must never import or preload private module code. */
export const FAZENDA_MODULES: Record<Exclude<UserProfileId, 'administrador'>, FazendaModuleDescriptor> = {
  gerente: descriptor('gerente', 'role.gerente', 'chart-bar', ['local-data.read', 'local-data.write', 'sync.pull', 'sync.push']),
  capataz: descriptor('capataz', 'role.capataz', 'clipboard-check', ['local-data.read', 'local-data.write', 'sync.pull', 'sync.push']),
  escritorio: descriptor('escritorio', 'role.escritorio', 'building-office', ['local-data.read', 'local-data.write', 'sync.pull', 'sync.push']),
  fabrica: descriptor('fabrica', 'role.fabrica', 'cog-6-tooth', ['local-data.read', 'local-data.write', 'sync.pull', 'sync.push'])
};
