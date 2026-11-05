import { describe, it, expect, beforeEach } from 'bun:test';
import {
  RollbackManager,
  safeDynamicImport,
  isChunkLoadError,
  ModuleArtifactRelease
} from '@consubov/module-release';

describe('Gate Q7.4: Atomic Chunk Rollback & 404 Fallback Guard (q7-chunk-404-rollback)', () => {
  let rollbackManager: RollbackManager;

  const sampleModuleV2: ModuleArtifactRelease = {
    module_id: 'gerente',
    version: '2.2.0',
    build_timestamp: new Date().toISOString(),
    commit_sha: 'commit-v2-abc',
    entrypoint_path: '/modules/gerente/v2.2.0/main.js',
    sri_hash: 'sha256-hash-v2',
    chunk_hashes: { 'chunk-main.js': 'hash-chunk-2' },
    min_contracts_version: '0.1.0'
  };

  const sampleModuleV1: ModuleArtifactRelease = {
    module_id: 'gerente',
    version: '2.1.0',
    build_timestamp: new Date().toISOString(),
    commit_sha: 'commit-v1-xyz',
    entrypoint_path: '/modules/gerente/v2.1.0/main.js',
    sri_hash: 'sha256-hash-v1',
    chunk_hashes: { 'chunk-main.js': 'hash-chunk-1' },
    min_contracts_version: '0.1.0'
  };

  beforeEach(() => {
    rollbackManager = new RollbackManager();
  });

  it('Q7.4.1: isChunkLoadError deve identificar corretamente erros de chunk 404 e rede', () => {
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module: /chunks/chunk-984.js'))).toBe(true);
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError({ name: 'ChunkLoadError', message: 'Loading chunk 4 failed' })).toBe(true);
    expect(isChunkLoadError(new Error('HTTP 404 Not Found for resource'))).toBe(true);

    expect(isChunkLoadError(new Error('SyntaxError: unexpected token'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });

  it('Q7.4.2: RollbackManager registra gerações N e N-1 e realiza rollback atômico', () => {
    rollbackManager.registerGenerations('gerente', sampleModuleV2, sampleModuleV1);

    expect(rollbackManager.getActiveGeneration('gerente')?.version).toBe('2.2.0');
    expect(rollbackManager.hasFallback('gerente')).toBe(true);

    // Dispara rollback por falha
    const restored = rollbackManager.triggerRollback('gerente', 'HTTP 404 no chunk principal');

    expect(restored.version).toBe('2.1.0');
    expect(rollbackManager.getActiveGeneration('gerente')?.version).toBe('2.1.0');
    expect(rollbackManager.hasFallback('gerente')).toBe(false);
  });

  it('Q7.4.3: RollbackManager deve lançar exceção explícita se rollback for impossível (sem N-1)', () => {
    rollbackManager.registerGenerations('capataz', sampleModuleV2, null);

    expect(() => {
      rollbackManager.triggerRollback('capataz', 'Tentativa sem fallback');
    }).toThrow(/FATAL_ROLLBACK_IMPOSSIBLE/);
  });

  it('Q7.4.4: safeDynamicImport carrega com sucesso sem acionar rollback quando import for bem-sucedido', async () => {
    rollbackManager.registerGenerations('gerente', sampleModuleV2, sampleModuleV1);

    const mockComponent = { default: () => 'GerenteComponent' };
    const importer = async () => mockComponent;

    let rollbackCalled = false;

    const result = await safeDynamicImport(importer, {
      moduleId: 'gerente',
      rollbackManager,
      onRollback: () => {
        rollbackCalled = true;
      }
    });

    expect(result).toBe(mockComponent);
    expect(rollbackCalled).toBe(false);
    expect(rollbackManager.getActiveGeneration('gerente')?.version).toBe('2.2.0');
  });

  it('Q7.4.5: safeDynamicImport intercepta chunk 404, executa retries e aciona fallback N-1 evitando Tela Branca (WSOD)', async () => {
    rollbackManager.registerGenerations('gerente', sampleModuleV2, sampleModuleV1);

    let attempts = 0;
    const failingV2Importer = async () => {
      attempts++;
      throw new Error('Failed to fetch dynamically imported module: /modules/gerente/chunk-404.js');
    };

    const stableV1Component = { default: () => 'GerenteComponentV1' };
    const fallbackV1Importer = async () => stableV1Component;

    let rollbackNotified = false;

    const result = await safeDynamicImport(failingV2Importer, {
      moduleId: 'gerente',
      maxRetries: 2,
      retryDelayMs: 10,
      fallbackImporter: fallbackV1Importer,
      rollbackManager,
      onRollback: (modId) => {
        rollbackNotified = true;
        expect(modId).toBe('gerente');
      }
    });

    // Tentou 1 inicial + 2 retries = 3 vezes
    expect(attempts).toBe(3);
    // Recuperou com sucesso via fallback
    expect(result).toBe(stableV1Component);
    expect(rollbackNotified).toBe(true);
    // RollbackManager agora aponta para a versão 2.1.0
    expect(rollbackManager.getActiveGeneration('gerente')?.version).toBe('2.1.0');
  });
});
