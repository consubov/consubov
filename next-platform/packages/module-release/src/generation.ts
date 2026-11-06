export interface VerifiedModuleManifest {
  moduleId: string;
  profileId: string;
  version: string;
  protocolVersion: number;
  apiVersions: string[];
  entry: string;
  assets: Array<{ url: string; bytes: number; sha256: string; integrity: string }>;
  localDataSchemaVersion?: number;
  capabilities?: string[];
  dependencies?: string[];
}

/** A generation is pinned by both manifest digest and exact CacheStorage name.
 * It never resolves resources through a mutable current-release alias. */
export interface PinnedModuleGeneration {
  moduleId: string;
  generation: string;
  manifestDigest: string;
  cacheName: string;
  resourceBase: string;
  manifest: VerifiedModuleManifest;
  legacy: boolean;
  health: 'candidate' | 'healthy';
}
