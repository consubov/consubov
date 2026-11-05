import { z } from 'zod';

export const ChunkEntrySchema = z.object({
  filename: z.string().min(1, 'Nome do chunk não pode ser vazio'),
  size_bytes: z.number().int().nonnegative('Tamanho em bytes deve ser não-negativo'),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i, 'Hash SHA-256 deve ter 64 caracteres hexadecimais'),
  sri: z.string().regex(/^sha(256|384|512)-[A-Za-z0-9+/=]+$/, 'Formato de integridade SRI inválido')
});

export const ModuleArtifactReleaseSchema = z.object({
  module_id: z.enum(['shell', 'gerente', 'capataz', 'escritorio', 'fabrica', 'admin-global']),
  version: z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/, 'Versão SemVer inválida'),
  build_timestamp: z.string().datetime({ message: 'build_timestamp deve estar no formato ISO 8601' }),
  commit_sha: z.string().min(7, 'Commit SHA deve ter pelo menos 7 caracteres'),
  entrypoint_path: z.string().min(1, 'entrypoint_path obrigatório'),
  sri_hash: z.string().min(1, 'sri_hash obrigatório'),
  chunk_hashes: z.record(z.string(), z.string()),
  min_contracts_version: z.string().min(1, 'min_contracts_version obrigatório')
});

export const ApplicationReleaseCatalogSchema = z.object({
  schema_version: z.literal(1),
  app_id: z.enum(['consubov-fazendas-app', 'admin-global-app']),
  current_version: z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/, 'Versão SemVer inválida'),
  previous_version: z
    .string()
    .regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/)
    .nullable()
    .optional(),
  updated_at: z.string().datetime({ message: 'updated_at deve estar no formato ISO 8601' }),
  modules: z.record(z.string(), ModuleArtifactReleaseSchema)
});

export type ChunkEntry = z.infer<typeof ChunkEntrySchema>;
export type ModuleArtifactRelease = z.infer<typeof ModuleArtifactReleaseSchema>;
export type ApplicationReleaseCatalog = z.infer<typeof ApplicationReleaseCatalogSchema>;
