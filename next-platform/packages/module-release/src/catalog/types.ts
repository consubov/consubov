export interface ModuleArtifactRelease {
  module_id: 'shell' | 'gerente' | 'capataz' | 'escritorio' | 'fabrica' | 'admin-global';
  version: string;              // SemVer, ex: '2.1.0'
  build_timestamp: string;      // ISO 8601
  commit_sha: string;           // Git SHA exato da compilação
  entrypoint_path: string;      // ex: '/modules/gerente/v2.1.0/main.js'
  sri_hash: string;             // ex: 'sha384-oqVuAfXRKap7fdgcCY5uykM6...'
  chunk_hashes: Record<string, string>; // Mapa de arquivos internos e hashes
  min_contracts_version: string;
}

export interface ApplicationReleaseCatalog {
  schema_version: 1;
  app_id: 'consubov-fazendas-app' | 'admin-global-app';
  updated_at: string;
  modules: Record<string, ModuleArtifactRelease>;
}
