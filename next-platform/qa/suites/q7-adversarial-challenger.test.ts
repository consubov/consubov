import { describe, it, expect, beforeEach } from 'bun:test';
import {
  QuiescenceRegistry,
  CriticalOperationType,
  RollbackManager,
  safeDynamicImport,
  isChunkLoadError,
  verifyChunkIntegritySha256,
  IntegrityVerificationError,
  ChunkEntrySchema,
  ModuleArtifactReleaseSchema,
  ApplicationReleaseCatalogSchema,
  ReleaseManager,
  ModuleArtifactRelease
} from '@consubov/module-release';
import { APP_DICTIONARY } from '@consubov/contracts';
import { UpdateCoordinator } from '../../apps/fazenda/shell/src/pwa/UpdateCoordinator';

// Helper mock para ServiceWorker e Registration em ambiente de teste hermético
function createMockServiceWorker(initialState: ServiceWorkerState = 'installed') {
  const sentMessages: any[] = [];
  return {
    state: initialState,
    scriptURL: '/sw.js',
    postMessage: (message: any) => {
      sentMessages.push(message);
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    onerror: null,
    onstatechange: null,
    _sentMessages: sentMessages
  } as unknown as ServiceWorker & { _sentMessages: any[] };
}

function createMockRegistration(waitingWorker?: ServiceWorker | null) {
  return {
    installing: null,
    waiting: waitingWorker ?? null,
    active: null,
    scope: '/',
    update: async () => {},
    unregister: async () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    onupdatefound: null
  } as unknown as ServiceWorkerRegistration;
}

describe('Challenger Adversarial F07: Estresse Extremo, Falhas Catastróficas e Bypasses (q7-adversarial-challenger)', () => {
  // =========================================================================
  // VETOR 1: Estresse Extremo e Condições de Corrida no QuiescenceRegistry
  // =========================================================================
  describe('Vetor 1: Estresse Extremo e Condições de Corrida no QuiescenceRegistry', () => {
    let registry: QuiescenceRegistry;

    beforeEach(() => {
      registry = new QuiescenceRegistry();
    });

    it('ADV-1.1: 120 aquisições e liberações simultâneas e assíncronas concorrentes misturando as 6 travas', async () => {
      const lockTypes: CriticalOperationType[] = [
        'FORM_DIRTY',
        'CAMERA_ACTIVE',
        'WEIGHING_ACTIVE',
        'OUTBOX_SYNCING',
        'QR_SCANNING',
        'LOCAL_DB_TRANSACTION'
      ];

      const TOTAL_OPERATIONS = 120;
      const tasks: Promise<void>[] = [];

      // Registra 120 operações assíncronas concorrentes com delays de liberação pseudo-aleatórios
      for (let i = 0; i < TOTAL_OPERATIONS; i++) {
        const type = lockTypes[i % lockTypes.length]!;
        const lockId = `adversarial-lock-${type}-${i}`;
        const delay = 5 + (i % 25); // 5ms a 29ms

        tasks.push(
          new Promise<void>((resolve) => {
            const release = registry.acquireLock(lockId, type, { operationIndex: i });

            // Durante a retenção, o registry não pode ser quiescente
            expect(registry.isQuiescent()).toBe(false);

            setTimeout(() => {
              release();
              resolve();
            }, delay);
          })
        );
      }

      // Aguarda conclusão de todas as 120 operações assíncronas
      await Promise.all(tasks);

      // Ao término de todas as liberações, o registry deve estar estritamente quiescente
      expect(registry.isQuiescent()).toBe(true);
      expect(registry.getActiveLocks()).toHaveLength(0);

      // Nenhuma das 6 travas pode estar ativa
      for (const type of lockTypes) {
        expect(registry.hasLockType(type)).toBe(false);
      }
    });

    it('ADV-1.2: Corrida de 50 listeners concorrentes em whenQuiescent()', async () => {
      // Bloqueia com 3 travas de tipos diferentes
      const releaseForm = registry.acquireLock('lock-form-dirty', 'FORM_DIRTY');
      const releaseCamera = registry.acquireLock('lock-camera', 'CAMERA_ACTIVE');
      const releaseSync = registry.acquireLock('lock-sync', 'OUTBOX_SYNCING');

      expect(registry.isQuiescent()).toBe(false);

      const LISTENER_COUNT = 50;
      const listenerPromises: Promise<boolean>[] = [];

      for (let i = 0; i < LISTENER_COUNT; i++) {
        listenerPromises.push(registry.whenQuiescent(5000));
      }

      // Liberação assíncrona gradual
      setTimeout(() => releaseForm(), 15);
      setTimeout(() => releaseCamera(), 25);
      setTimeout(() => releaseSync(), 35);

      // Todos os 50 listeners devem resolver true após a última liberação
      const results = await Promise.all(listenerPromises);

      expect(results).toHaveLength(LISTENER_COUNT);
      for (const res of results) {
        expect(res).toBe(true);
      }

      expect(registry.isQuiescent()).toBe(true);
    });

    it('ADV-1.3: Timeout controlado de whenQuiescent(timeoutMs) sob travas permanentemente retidas', async () => {
      // Adquire trava e NÃO a libera
      registry.acquireLock('trava-eterna', 'LOCAL_DB_TRANSACTION', { reason: 'transacao demorada' });

      expect(registry.isQuiescent()).toBe(false);

      const startTime = Date.now();
      const resolvedQuiescent = await registry.whenQuiescent(60);
      const elapsed = Date.now() - startTime;

      // Deve ter resolvido false dentro da margem do timeout
      expect(resolvedQuiescent).toBe(false);
      expect(elapsed).toBeGreaterThanOrEqual(45); // Tolerância de timer do sistema
      expect(registry.isQuiescent()).toBe(false);
      expect(registry.hasLockType('LOCAL_DB_TRANSACTION')).toBe(true);
    });

    it('ADV-1.4: Idempotência de liberação de travas inexistentes ou duplicadas sem corrupção interna', () => {
      // Liberações de IDs que nunca existiram
      for (let i = 0; i < 20; i++) {
        expect(() => registry.releaseLock(`inexistente-${i}`)).not.toThrow();
      }

      // Adquire uma trava legítima
      const release = registry.acquireLock('trava-legitima', 'QR_SCANNING');
      expect(registry.isQuiescent()).toBe(false);
      expect(registry.getActiveLocks()).toHaveLength(1);

      // Libera a trava legítima
      release();
      expect(registry.isQuiescent()).toBe(true);
      expect(registry.getActiveLocks()).toHaveLength(0);

      // Libera repetidamente via callback retornado e via releaseLock com mesmo ID
      expect(() => release()).not.toThrow();
      expect(() => release()).not.toThrow();
      expect(() => registry.releaseLock('trava-legitima')).not.toThrow();

      // Estado permanece íntegro
      expect(registry.isQuiescent()).toBe(true);
      expect(registry.getActiveLocks()).toHaveLength(0);
    });

    it('ADV-1.5: clearAllLocks() atômico sob 60 travas retidas simultaneamente', () => {
      for (let i = 0; i < 60; i++) {
        registry.acquireLock(`multi-lock-${i}`, i % 2 === 0 ? 'FORM_DIRTY' : 'WEIGHING_ACTIVE');
      }

      expect(registry.isQuiescent()).toBe(false);
      expect(registry.getActiveLocks()).toHaveLength(60);

      let notifiedQuiescent = false;
      registry.subscribe((q) => {
        notifiedQuiescent = q;
      });

      registry.clearAllLocks();

      expect(registry.isQuiescent()).toBe(true);
      expect(registry.getActiveLocks()).toHaveLength(0);
      expect(notifiedQuiescent).toBe(true);
    });
  });

  // =========================================================================
  // VETOR 2: Falhas Catastróficas em Chunks Dinâmicos (404 Fallback Guard & Anti-WSOD)
  // =========================================================================
  describe('Vetor 2: Falhas Catastróficas em Chunks Dinâmicos (404 Fallback Guard & Anti-WSOD)', () => {
    let rollbackManager: RollbackManager;

    const modGerenteV2: ModuleArtifactRelease = {
      module_id: 'gerente',
      version: '2.5.0',
      build_timestamp: new Date().toISOString(),
      commit_sha: 'sha-v2-active',
      entrypoint_path: '/modules/gerente/v2.5.0/entry.js',
      sri_hash: 'sha256-hash-v2',
      chunk_hashes: { 'chunk-main.js': 'hash-v2' },
      min_contracts_version: '0.1.0'
    };

    const modGerenteV1: ModuleArtifactRelease = {
      module_id: 'gerente',
      version: '2.4.0',
      build_timestamp: new Date().toISOString(),
      commit_sha: 'sha-v1-stable',
      entrypoint_path: '/modules/gerente/v2.4.0/entry.js',
      sri_hash: 'sha256-hash-v1',
      chunk_hashes: { 'chunk-main.js': 'hash-v1' },
      min_contracts_version: '0.1.0'
    };

    beforeEach(() => {
      rollbackManager = new RollbackManager();
      rollbackManager.registerGenerations('gerente', modGerenteV2, modGerenteV1);
    });

    it('ADV-2.1: safeDynamicImport sob simulação de HTTP 404 em chunk de CDN com retries e recuperação N-1', async () => {
      let attempts = 0;
      const failingV2Importer = async () => {
        attempts++;
        throw new Error('Failed to fetch dynamically imported module: https://cdn.consubov.local/modules/gerente/chunk-c9182.js');
      };

      const fallbackV1Component = { default: () => 'GerenteComponentV1Stable' };
      const fallbackImporter = async () => fallbackV1Component;

      let rollbackLogged = false;

      const loaded = await safeDynamicImport(failingV2Importer, {
        moduleId: 'gerente',
        maxRetries: 2,
        retryDelayMs: 5,
        fallbackImporter,
        rollbackManager,
        onRollback: (id, err) => {
          rollbackLogged = true;
          expect(id).toBe('gerente');
          expect(err).toBeDefined();
        }
      });

      // 1 tentativa inicial + 2 retries = 3 tentativas
      expect(attempts).toBe(3);
      expect(rollbackLogged).toBe(true);
      expect(loaded).toBe(fallbackV1Component);

      // RollbackManager atualizado para v1
      expect(rollbackManager.getActiveGeneration('gerente')?.version).toBe('2.4.0');
      expect(rollbackManager.hasFallback('gerente')).toBe(false);
    });

    it('ADV-2.2: safeDynamicImport com erro típico ChunkLoadError do Webpack/Vite', async () => {
      const chunkError = { name: 'ChunkLoadError', message: 'Loading chunk 14 failed' };

      const fallbackComponent = { default: () => 'GerenteRecovered' };

      const loaded = await safeDynamicImport(async () => {
        throw chunkError;
      }, {
        moduleId: 'gerente',
        maxRetries: 1,
        retryDelayMs: 5,
        fallbackImporter: async () => fallbackComponent,
        rollbackManager
      });

      expect(loaded).toBe(fallbackComponent);
      expect(rollbackManager.getActiveGeneration('gerente')?.version).toBe('2.4.0');
    });

    it('ADV-2.3: Exaustão de retries quando TANTO vN QUANTO o fallback vN-1 falham (lançamento controlado em vez de WSOD silencioso)', async () => {
      const v2Importer = async () => {
        throw new Error('error loading dynamically imported module: chunk-v2.js');
      };

      const brokenFallbackImporter = async () => {
        throw new Error('FATAL_FALLBACK_OFFLINE: Cache vN-1 também inacessível');
      };

      let errorCaught: unknown = null;

      try {
        await safeDynamicImport(v2Importer, {
          moduleId: 'gerente',
          maxRetries: 1,
          retryDelayMs: 5,
          fallbackImporter: brokenFallbackImporter,
          rollbackManager
        });
      } catch (err) {
        errorCaught = err;
      }

      // Erro NÃO deve ter sido suprimido
      expect(errorCaught).toBeDefined();
      expect((errorCaught as Error).message).toContain('FATAL_FALLBACK_OFFLINE');
    });

    it('ADV-2.4: Isolamento estrito de rollback entre múltiplos módulos independentes', () => {
      const modCapatazV2: ModuleArtifactRelease = {
        ...modGerenteV2,
        module_id: 'capataz',
        version: '1.8.0'
      };
      const modCapatazV1: ModuleArtifactRelease = {
        ...modGerenteV1,
        module_id: 'capataz',
        version: '1.7.0'
      };

      rollbackManager.registerGenerations('capataz', modCapatazV2, modCapatazV1);

      expect(rollbackManager.getActiveGeneration('gerente')?.version).toBe('2.5.0');
      expect(rollbackManager.getActiveGeneration('capataz')?.version).toBe('1.8.0');

      // Executa rollback apenas do módulo 'gerente'
      rollbackManager.triggerRollback('gerente', 'Chunk 404 detectado no Gerente');

      // Apenas 'gerente' reverte; 'capataz' permanece intacto na v2
      expect(rollbackManager.getActiveGeneration('gerente')?.version).toBe('2.4.0');
      expect(rollbackManager.getActiveGeneration('capataz')?.version).toBe('1.8.0');
      expect(rollbackManager.hasFallback('capataz')).toBe(true);
    });

    it('ADV-2.5: Rejeição incondicional a rollback consecutivo sem novo N-1 registrado', () => {
      // Primeiro rollback: sucesso
      rollbackManager.triggerRollback('gerente', 'Primeiro erro');
      expect(rollbackManager.getActiveGeneration('gerente')?.version).toBe('2.4.0');

      // Segundo rollback consecutivo: deve falhar com erro FATAL_ROLLBACK_IMPOSSIBLE
      expect(() => {
        rollbackManager.triggerRollback('gerente', 'Segundo erro consecutivo');
      }).toThrow(/FATAL_ROLLBACK_IMPOSSIBLE/);

      // Versão permanece 2.4.0
      expect(rollbackManager.getActiveGeneration('gerente')?.version).toBe('2.4.0');
    });
  });

  // =========================================================================
  // VETOR 3: Ataques e Bypass no Ciclo de Vida do Service Worker e UpdateCoordinator
  // =========================================================================
  describe('Vetor 3: Ataques e Bypass no Ciclo de Vida do Service Worker e UpdateCoordinator', () => {
    let registry: QuiescenceRegistry;

    beforeEach(() => {
      registry = new QuiescenceRegistry();
    });

    it('ADV-3.1: Neutralização de tentativa de ativação forçada enquanto travas de formulário e pesagem estão ativas', async () => {
      // 1. Adquire travas de operação crítica
      const releaseForm = registry.acquireLock('form-lote-55', 'FORM_DIRTY', { loteId: 55 });
      const releaseWeighing = registry.acquireLock('pesagem-animal-99', 'WEIGHING_ACTIVE', { animalId: 99 });

      const mockWorker = createMockServiceWorker();
      const mockReg = createMockRegistration(mockWorker);

      let onUpdateAvailableCalled = false;
      let waitingQuiescenceCalled = false;
      let activeLocksNotified: any[] = [];

      const coordinator = new UpdateCoordinator({
        quiescenceRegistry: registry,
        autoReloadOnQuiescent: false,
        onUpdateAvailable: () => {
          onUpdateAvailableCalled = true;
        },
        onWaitingForQuiescence: (locks) => {
          waitingQuiescenceCalled = true;
          activeLocksNotified = [...locks];
        }
      });

      coordinator.initialize(mockReg);

      await new Promise((r) => setTimeout(r, 20));

      expect(onUpdateAvailableCalled).toBe(true);
      expect(waitingQuiescenceCalled).toBe(true);
      expect(activeLocksNotified).toHaveLength(2);

      // Comprovado: NENHUMA mensagem SKIP_WAITING foi enviada ao Service Worker
      expect(mockWorker._sentMessages).toHaveLength(0);
      expect(coordinator.isHoldingForQuiescence()).toBe(true);

      // 2. Simula chamadas repetidas de checkForUpdates() enquanto travas continuam retidas
      await coordinator.checkForUpdates();
      await coordinator.checkForUpdates();

      expect(mockWorker._sentMessages).toHaveLength(0);
      expect(coordinator.isHoldingForQuiescence()).toBe(true);

      coordinator.destroy();
      releaseForm();
      releaseWeighing();
    });

    it('ADV-3.2: Liberação estritamente sequencial das travas com disparo único de SKIP_WAITING', async () => {
      const releaseForm = registry.acquireLock('form-vacina-1', 'FORM_DIRTY');
      const releaseSync = registry.acquireLock('sync-outbox-1', 'OUTBOX_SYNCING');

      const mockWorker = createMockServiceWorker();
      const mockReg = createMockRegistration(mockWorker);

      const coordinator = new UpdateCoordinator({
        quiescenceRegistry: registry,
        autoReloadOnQuiescent: false
      });

      coordinator.initialize(mockReg);
      await new Promise((r) => setTimeout(r, 15));

      expect(mockWorker._sentMessages).toHaveLength(0);

      // Libera apenas a trava do formulário; trava de sync continua ativa
      releaseForm();
      await new Promise((r) => setTimeout(r, 15));

      // Continua retido e sem mensagens enviadas
      expect(coordinator.isHoldingForQuiescence()).toBe(true);
      expect(mockWorker._sentMessages).toHaveLength(0);

      // Libera a trava de sync final
      releaseSync();
      await new Promise((r) => setTimeout(r, 25));

      // Agora sim, exatamente 1 mensagem SKIP_WAITING enviada
      expect(coordinator.isHoldingForQuiescence()).toBe(false);
      expect(mockWorker._sentMessages).toHaveLength(1);
      expect(mockWorker._sentMessages[0]).toEqual({ type: 'SKIP_WAITING' });

      coordinator.destroy();
    });

    it('ADV-3.3: Salvaguarda anti-perda de dados no evento controllerchange sob retenção de quiescência', async () => {
      let reloadInvokedCount = 0;

      // Mock de window e location para interceptar reload
      const originalWindow = (globalThis as any).window;
      const originalNavigator = (globalThis as any).navigator;

      let controllerChangeCb: (() => void) | null = null;

      (globalThis as any).navigator = {
        serviceWorker: {
          controller: {},
          addEventListener: (event: string, cb: any) => {
            if (event === 'controllerchange') {
              controllerChangeCb = cb;
            }
          },
          removeEventListener: () => {
            controllerChangeCb = null;
          }
        }
      };

      (globalThis as any).window = {
        location: {
          reload: () => {
            reloadInvokedCount++;
          }
        }
      };

      try {
        const coordinator = new UpdateCoordinator({
          quiescenceRegistry: registry,
          autoReloadOnQuiescent: true
        });

        const mockReg = createMockRegistration(null);
        coordinator.initialize(mockReg);

        // Operador está fotografando o cocho (trava ativa)
        const releaseCamera = registry.acquireLock('camera-cocho-05', 'CAMERA_ACTIVE');

        // Disparo inoportuno do evento controllerchange
        expect(controllerChangeCb).toBeDefined();
        controllerChangeCb!();

        await new Promise((r) => setTimeout(r, 20));

        // window.location.reload NÃO deve ter sido invocado por causa da trava
        expect(reloadInvokedCount).toBe(0);

        // Operador conclui a foto e salva
        releaseCamera();

        await new Promise((r) => setTimeout(r, 30));

        // window.location.reload deve ter sido invocado apenas após atingir quiescência
        expect(reloadInvokedCount).toBe(1);

        coordinator.destroy();
      } finally {
        (globalThis as any).window = originalWindow;
        (globalThis as any).navigator = originalNavigator;
      }
    });

    it('ADV-3.4: Desconexão hermética (destroy()) e neutralização de eventos', () => {
      const mockReg = createMockRegistration(null);
      const coordinator = new UpdateCoordinator({
        quiescenceRegistry: registry,
        checkIntervalMs: 1000
      });

      coordinator.initialize(mockReg);
      coordinator.destroy();

      expect(() => coordinator.destroy()).not.toThrow();
    });
  });

  // =========================================================================
  // VETOR 4: Corrupção Criptográfica e Falsificação no Catálogo de Releases
  // =========================================================================
  describe('Vetor 4: Corrupção Criptográfica e Falsificação no Catálogo de Releases', () => {
    it('ADV-4.1: Corrupção de 1 bit/byte em binário de 64KB e rejeição incondicional com IntegrityVerificationError', async () => {
      const BUFFER_SIZE = 64 * 1024; // 64KB
      const originalBuffer = new Uint8Array(BUFFER_SIZE);

      // Preenche com padrão determinístico
      for (let i = 0; i < BUFFER_SIZE; i++) {
        originalBuffer[i] = (i * 37 + 13) & 0xff;
      }

      // Calcula hash SHA-256 autêntico
      const hasher = new Bun.CryptoHasher('sha256');
      hasher.update(originalBuffer);
      const authenticSha256 = hasher.digest('hex');

      // Verifica que o original passa
      const isValid = await verifyChunkIntegritySha256(originalBuffer, authenticSha256);
      expect(isValid).toBe(true);

      // 10 posições de adulteração hostil de 1 único byte
      const corruptedPositions = [0, 1, 1024, 16384, 32767, 32768, 50000, 60000, 65534, 65535];

      for (const pos of corruptedPositions) {
        const tamperedBuffer = new Uint8Array(originalBuffer);
        // Inverte bits do byte
        tamperedBuffer[pos] = (tamperedBuffer[pos]! ^ 0xff) & 0xff;

        let errorCaught: unknown = null;
        try {
          await verifyChunkIntegritySha256(tamperedBuffer, authenticSha256);
        } catch (err) {
          errorCaught = err;
        }

        expect(errorCaught).toBeInstanceOf(IntegrityVerificationError);
        const integrityErr = errorCaught as IntegrityVerificationError;
        expect(integrityErr.expectedHash).toBe(authenticSha256);
        expect(integrityErr.actualHash).not.toBe(authenticSha256);
      }
    });

    it('ADV-4.2: Rejeição estrita a hashes SHA-256 com tamanho incorreto ou caracteres não-hexadecimais', async () => {
      const data = 'consubov-payload-test';

      // 63 caracteres (1 a menos)
      const shortHash = 'a'.repeat(63);
      await expect(verifyChunkIntegritySha256(data, shortHash)).rejects.toThrow(IntegrityVerificationError);

      // 65 caracteres (1 a mais)
      const longHash = 'a'.repeat(65);
      await expect(verifyChunkIntegritySha256(data, longHash)).rejects.toThrow(IntegrityVerificationError);

      // 64 caracteres com caractere não-hexadecimal ('z')
      const invalidCharHash = 'z' + 'a'.repeat(63);
      await expect(verifyChunkIntegritySha256(data, invalidCharHash)).rejects.toThrow(IntegrityVerificationError);
    });

    it('ADV-4.3: Zod Schemas sob ataques adversariais (SemVer adulterado, ISO 8601 malformado, enums ilegais)', () => {
      const validModule = {
        module_id: 'gerente',
        version: '1.2.3',
        build_timestamp: new Date().toISOString(),
        commit_sha: 'commit-sha-valid-123',
        entrypoint_path: '/modules/gerente/entry.js',
        sri_hash: 'sha256-valid-sri',
        chunk_hashes: { 'chunk-1.js': 'a'.repeat(64) },
        min_contracts_version: '0.1.0'
      };

      // 1. SemVer adulterado
      const invalidVersions = ['v1.0', '1.0', '1.0.0.0', 'alfa-release', '../malicious', ''];
      for (const badVer of invalidVersions) {
        expect(() => {
          ModuleArtifactReleaseSchema.parse({
            ...validModule,
            version: badVer
          });
        }).toThrow();
      }

      // 2. ISO 8601 malformado
      const invalidTimestamps = ['ontem', '2026-99-99T99:99:99Z', '12345', ''];
      for (const badTime of invalidTimestamps) {
        expect(() => {
          ModuleArtifactReleaseSchema.parse({
            ...validModule,
            build_timestamp: badTime
          });
        }).toThrow();
      }

      // 3. Module ID ilegal
      expect(() => {
        ModuleArtifactReleaseSchema.parse({
          ...validModule,
          module_id: 'malicious-injected-module'
        });
      }).toThrow();

      // 4. ChunkEntrySchema com hash de 63 caracteres ou negativo
      expect(() => {
        ChunkEntrySchema.parse({
          filename: 'chunk.js',
          size_bytes: -10,
          sha256: 'a'.repeat(64),
          sri: 'sha256-abc'
        });
      }).toThrow();

      // 5. ApplicationReleaseCatalogSchema com App ID adulterado
      expect(() => {
        ApplicationReleaseCatalogSchema.parse({
          schema_version: 1,
          app_id: 'attacker-app',
          current_version: '1.0.0',
          updated_at: new Date().toISOString(),
          modules: {}
        });
      }).toThrow();
    });
  });

  // =========================================================================
  // VETOR 5: Bilinguismo e Casos Limítrofes no Namespace update.*
  // =========================================================================
  describe('Vetor 5: Bilinguismo e Casos Limítrofes no Namespace update.*', () => {
    const ptDict = APP_DICTIONARY['pt-BR'];
    const enDict = APP_DICTIONARY['en-US'];

    it('ADV-5.1: 100% de paridade estrita em todas as chaves do namespace update.*', () => {
      const ptKeys = Object.keys(ptDict).filter((k) => k.startsWith('update.'));
      const enKeys = Object.keys(enDict).filter((k) => k.startsWith('update.'));

      expect(ptKeys.length).toBeGreaterThanOrEqual(25);
      expect(ptKeys.length).toBe(enKeys.length);

      const missingInEn = ptKeys.filter((k) => !enDict[k]);
      const missingInPt = enKeys.filter((k) => !ptDict[k]);

      expect(missingInEn).toEqual([]);
      expect(missingInPt).toEqual([]);

      for (const k of ptKeys) {
        expect(ptDict[k]?.trim().length).toBeGreaterThan(0);
        expect(enDict[k]?.trim().length).toBeGreaterThan(0);
      }
    });

    it('ADV-5.2: Simetria estrita dos tokens de interpolação ({version}, {locks}) entre pt-BR e en-US', () => {
      const ptKeys = Object.keys(ptDict).filter((k) => k.startsWith('update.'));

      const tokenRegex = /\{([a-zA-Z0-9_]+)\}/g;

      for (const key of ptKeys) {
        const ptVal = ptDict[key] ?? '';
        const enVal = enDict[key] ?? '';

        const ptTokens = (ptVal.match(tokenRegex) ?? []).sort();
        const enTokens = (enVal.match(tokenRegex) ?? []).sort();

        expect(ptTokens).toEqual(enTokens);

        // Se houver tokens, simula interpolação real
        if (ptTokens.length > 0) {
          const sampleParams: Record<string, string> = {
            version: '2.0.0',
            locks: 'Edição de Lote'
          };

          let formattedPt = ptVal;
          let formattedEn = enVal;

          for (const token of ptTokens) {
            const rawName = token.replace(/[{}]/g, '');
            const replacement = sampleParams[rawName] ?? 'VALOR';
            formattedPt = formattedPt.replace(token, replacement);
            formattedEn = formattedEn.replace(token, replacement);
          }

          expect(formattedPt).not.toContain('{');
          expect(formattedPt).not.toContain('}');
          expect(formattedEn).not.toContain('{');
          expect(formattedEn).not.toContain('}');
        }
      }
    });

    it('ADV-5.3: Cobertura semântica para os 6 tipos de travas de quiescência no dicionário', () => {
      const expectedLockMap: Record<CriticalOperationType, string> = {
        FORM_DIRTY: 'update.lock.formDirty',
        CAMERA_ACTIVE: 'update.lock.cameraActive',
        WEIGHING_ACTIVE: 'update.lock.weighingActive',
        OUTBOX_SYNCING: 'update.lock.outboxSyncing',
        QR_SCANNING: 'update.lock.qrScanning',
        LOCAL_DB_TRANSACTION: 'update.lock.localDbTransaction'
      };

      for (const [lockType, key] of Object.entries(expectedLockMap)) {
        const ptText = ptDict[key];
        const enText = enDict[key];

        expect(ptText).toBeDefined();
        expect(ptText!.length).toBeGreaterThan(5);

        expect(enText).toBeDefined();
        expect(enText!.length).toBeGreaterThan(5);
      }
    });
  });
});
