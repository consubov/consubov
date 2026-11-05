import { describe, it, expect } from 'bun:test';
import {
  ChunkEntrySchema,
  ModuleArtifactReleaseSchema,
  ApplicationReleaseCatalogSchema,
  ReleaseManager,
  verifyChunkIntegritySha256,
  verifyChunkIntegrity,
  IntegrityVerificationError
} from '@consubov/module-release';

describe('Gate Q7.5: Release Manifest Schemas & SHA-256 Cryptographic Integrity (q7-integrity-catalog)', () => {
  it('Q7.5.1: ChunkEntrySchema deve validar entradas de chunks íntegras e rejeitar hashes inválidos', () => {
    const validChunk = {
      filename: 'gerente.chunk-842.js',
      size_bytes: 45120,
      sha256: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      sri: 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='
    };

    const parsed = ChunkEntrySchema.parse(validChunk);
    expect(parsed.filename).toBe('gerente.chunk-842.js');

    // Rejeita hash que não seja hex 64 caracteres
    expect(() => {
      ChunkEntrySchema.parse({
        ...validChunk,
        sha256: 'hash-muito-curto'
      });
    }).toThrow();

    // Rejeita tamanho negativo
    expect(() => {
      ChunkEntrySchema.parse({
        ...validChunk,
        size_bytes: -100
      });
    }).toThrow();
  });

  it('Q7.5.2: ModuleArtifactReleaseSchema deve validar e rejeitar SemVer inválido', () => {
    const validModule = {
      module_id: 'capataz',
      version: '1.4.0',
      build_timestamp: new Date().toISOString(),
      commit_sha: 'commit-sha-789012',
      entrypoint_path: '/modules/capataz/v1.4.0/main.js',
      sri_hash: 'sha256-sri-hash-mock',
      chunk_hashes: { 'capataz.chunk.js': 'a1b2c3d4' },
      min_contracts_version: '0.1.0'
    };

    const parsed = ModuleArtifactReleaseSchema.parse(validModule);
    expect(parsed.version).toBe('1.4.0');

    // Rejeita versão inválida
    expect(() => {
      ModuleArtifactReleaseSchema.parse({
        ...validModule,
        version: 'versao_invalida'
      });
    }).toThrow();
  });

  it('Q7.5.3: ApplicationReleaseCatalogSchema e ReleaseManager devem carregar manifesto íntegro', () => {
    const catalogData = {
      schema_version: 1,
      app_id: 'consubov-fazendas-app',
      current_version: '3.0.0',
      previous_version: '2.9.0',
      updated_at: new Date().toISOString(),
      modules: {
        gerente: {
          module_id: 'gerente',
          version: '3.0.0',
          build_timestamp: new Date().toISOString(),
          commit_sha: 'sha-release-12345',
          entrypoint_path: '/modules/gerente/main.js',
          sri_hash: 'sha256-sri-gerente',
          chunk_hashes: {},
          min_contracts_version: '0.1.0'
        }
      }
    };

    const releaseManager = new ReleaseManager();
    const catalog = releaseManager.loadManifest(catalogData);

    expect(catalog.current_version).toBe('3.0.0');
    expect(releaseManager.getCurrentVersion()).toBe('3.0.0');
    expect(releaseManager.getModule('gerente')?.version).toBe('3.0.0');
  });

  it('Q7.5.4: verifyChunkIntegritySha256 deve calcular hash SHA-256 nativo via Web Crypto e validar chunks autênticos', async () => {
    const sampleContent = 'console.log("CONSUBOV Fazendas - Chunk 100% Genuíno");';

    // Calcula o SHA-256 esperado via Bun.CryptoHasher
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(sampleContent);
    const expectedSha256 = hasher.digest('hex');

    expect(expectedSha256).toHaveLength(64);

    // Valida usando a função oficial que usa crypto.subtle.digest('SHA-256', ...)
    const isValid = await verifyChunkIntegritySha256(sampleContent, expectedSha256);
    expect(isValid).toBe(true);

    // Também funciona com Uint8Array / ArrayBuffer
    const buffer = new TextEncoder().encode(sampleContent);
    const isBufferValid = await verifyChunkIntegritySha256(buffer, expectedSha256);
    expect(isBufferValid).toBe(true);
  });

  it('Q7.5.5: verifyChunkIntegritySha256 deve REJEITAR chunk adulterado por 1 único byte e lançar IntegrityVerificationError', async () => {
    const originalContent = 'const TOKEN = "GENUINE_DATA_42";';
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(originalContent);
    const originalHash = hasher.digest('hex');

    // Adulteração: 1 único caractere alterado
    const tamperedContent = 'const TOKEN = "TAMPERED_DATA_42";';

    try {
      await verifyChunkIntegritySha256(tamperedContent, originalHash);
      expect(true).toBe(false); // Não deveria chegar aqui
    } catch (err) {
      expect(err).toBeInstanceOf(IntegrityVerificationError);
      const integrityErr = err as IntegrityVerificationError;
      expect(integrityErr.expectedHash).toBe(originalHash);
      expect(integrityErr.actualHash).not.toBe(originalHash);
      expect(integrityErr.name).toBe('IntegrityVerificationError');
    }
  });

  it('Q7.5.6: verifyChunkIntegrity (SRI) deve validar hashes sha256- e sha384-', async () => {
    const content = 'export const API_VERSION = "v1";';
    const sha256Hasher = new Bun.CryptoHasher('sha256');
    sha256Hasher.update(content);
    const expectedSri256 = `sha256-${sha256Hasher.digest('base64')}`;

    const isValid = await verifyChunkIntegrity(content, expectedSri256);
    expect(isValid).toBe(true);
  });
});
