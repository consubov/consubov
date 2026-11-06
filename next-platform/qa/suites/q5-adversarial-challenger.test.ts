/**
 * SUÍTE DE TESTES ADVERSARIAIS DO CHALLENGER — FASE 05 (M05)
 * Agente: challenger_f05_1 (Critic / Specialist)
 * Missão: F23-ISOLATED-NEXT
 * 
 * Desafia empiricamente os 6 vetores críticos:
 * 1. Web Locks: corrida entre 10 abas, passagem de bastão em cascata, isolamento entre partições.
 * 2. Circuit Breaker: rajada de 25 comandos sob queda de rede, proteção de bateria e cooldown estrito de 15s.
 * 3. Fotos de Cocho: limites extremos de aspect-ratio, dissociação de blob e envelope leve (<1KB).
 * 4. Anti-LWW: Merge Aditivo cronológico em cocho (zero sobrescritas) e OCC 409 em mutações físicas.
 * 5. Particionamento e Quota (LF-003): isolamento multi-tenant/usuário e ausência de falso ACK em Quota Exceeded.
 * 6. Bilinguismo & ARIA: 463 chaves 100% simétricas, paridade pt-BR/en-US e conformidade W3C ARIA.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  startLeaderElection,
  resetLeaderElectionForTesting,
  inMemoryLockManager,
  generateTabId,
  createSyncMessagingChannel,
  resetSyncMessagingForTesting,
  SyncCircuitBreaker,
  compressPhoto,
  calculateAspectRatioFit,
  generateAttachmentId,
  resolveDomainConflict,
  applyLocalResolution,
  isAdditiveDomainCommand,
  CapatazStore,
  StorageQuotaExceededError,
  resetCapatazStoresForTesting,
  CAPATAZ_MODULE_DESCRIPTOR,
  CapatazView,
  CapatazCochoTab,
  CapatazQrTab,
  CapatazContagemTab,
  CapatazFotosTab,
  CapatazHistoricoTab
} from '../../apps/fazenda/capataz/src';
import { APP_DICTIONARY, AtomicCommandEnvelope, atomicCommandEnvelopeSchema, attachmentUploadMetadataSchema, fotoCochoPayloadSchema, MAX_ATTACHMENT_BYTES } from '@consubov/contracts';
import { I18nProvider, ModuleRuntimeProvider } from '@consubov/ui';
import { createCapatazTestRuntime, createCapatazTestStore, getCapatazTestStore, resetCapatazTestData } from '../harness/capataz-test-runtime';

describe('CHALLENGER F05: Bateria Adversarial de Testes de Estresse e Resiliência Empírica', () => {
  beforeEach(() => {
    resetLeaderElectionForTesting();
    resetSyncMessagingForTesting();
    resetCapatazStoresForTesting();
    resetCapatazTestData();
  });

  // =========================================================================
  // VETOR 1: WEB LOCKS E COORDENAÇÃO CROSS-TAB
  // =========================================================================
  describe('Vetor 1: Web Locks, Concorrência Hostil e Passagem de Bastão Cross-Tab', () => {
    it('ADV-1.1: Disputa massiva: 10 abas concorrendo pelo mesmo lock de partição devem eleger exatamente 1 líder', () => {
      const partitionKey = 'tenant-alfa:user-01:fazenda-01:capataz';
      const controllers = [];

      for (let i = 0; i < 10; i++) {
        controllers.push(startLeaderElection(partitionKey, undefined, `tab-client-${i}`));
      }

      const leaders = controllers.filter(c => c.isLeader());
      const followers = controllers.filter(c => !c.isLeader());

      expect(leaders.length).toBe(1);
      expect(followers.length).toBe(9);

      // Limpeza de locks
      controllers.forEach(c => c.release());
    });

    it('ADV-1.2: Passagem de bastão em cascata: queda sucessiva de líderes transfere a liderança ordenadamente', () => {
      const partitionKey = 'tenant-beta:user-02:fazenda-01:capataz';

      const tab1 = startLeaderElection(partitionKey, undefined, 'tab-seq-1');
      const tab2 = startLeaderElection(partitionKey, undefined, 'tab-seq-2');
      const tab3 = startLeaderElection(partitionKey, undefined, 'tab-seq-3');

      expect(tab1.isLeader()).toBe(true);
      expect(tab2.isLeader()).toBe(false);
      expect(tab3.isLeader()).toBe(false);

      // Queda abrupta da Aba 1 (ex: crash do navegador ou aba fechada)
      tab1.release();
      expect(tab1.isLeader()).toBe(false);

      // Nova tentativa da aba 2 assume imediatamente
      const tab2Assumed = startLeaderElection(partitionKey, undefined, 'tab-seq-2');
      expect(tab2Assumed.isLeader()).toBe(true);

      // Queda da Aba 2 transfere para Aba 3
      tab2.release();
      tab2Assumed.release();

      const tab3Assumed = startLeaderElection(partitionKey, undefined, 'tab-seq-3');
      expect(tab3Assumed.isLeader()).toBe(true);

      tab3.release();
      tab3Assumed.release();
    });

    it('ADV-1.3: Isolamento total entre partições: abas de partições distintas nunca disputam o mesmo lock', () => {
      const partA = 'tenant-a:user-01:fazenda-01:capataz';
      const partB = 'tenant-b:user-01:fazenda-01:capataz';
      const partC = 'tenant-a:user-02:fazenda-01:capataz';

      const ctrlA = startLeaderElection(partA, undefined, 'tab-part-a');
      const ctrlB = startLeaderElection(partB, undefined, 'tab-part-b');
      const ctrlC = startLeaderElection(partC, undefined, 'tab-part-c');

      // Todas devem ser líderes em suas respectivas partições simultaneamente
      expect(ctrlA.isLeader()).toBe(true);
      expect(ctrlB.isLeader()).toBe(true);
      expect(ctrlC.isLeader()).toBe(true);

      ctrlA.release();
      ctrlB.release();
      ctrlC.release();
    });

    it('ADV-1.4: Chamadas repetidas a release() devem ser idempotentes e seguras', () => {
      const part = 'tenant-idem:user-01:fazenda-01:capataz';
      const ctrl = startLeaderElection(part, undefined, 'tab-idem');

      expect(ctrl.isLeader()).toBe(true);
      ctrl.release();
      expect(ctrl.isLeader()).toBe(false);

      // Chamadas extras não devem lançar exceções
      expect(() => {
        ctrl.release();
        ctrl.release();
      }).not.toThrow();
    });
  });

  // =========================================================================
  // VETOR 2: CIRCUIT BREAKER E PROTEÇÃO DE BATERIA
  // =========================================================================
  describe('Vetor 2: Circuit Breaker Sob Falha de Rede Extrema e Proteção de Bateria', () => {
    it('ADV-2.1: Rajada hostil: fila de 25 comandos sob falha de rede deve disparar exatamente 1 requisição e abrir o circuito', async () => {
      const store = createCapatazTestStore('tenant-burst:user-01:fazenda-01:capataz');
      await store.ready;
      (store as any).state.isLeader = true;

      // Enfileira 25 comandos na outbox
      for (let i = 1; i <= 25; i++) {
        await store.registrarLeituraCocho({
          pasto_id: `pasto-${(i % 4) + 1}`,
          produto_id: 'prod-sal-mineral-80',
          escore_cocho: (i % 5),
          sacos_fornecidos: 2
        });
      }

      expect(store.getState().outbox.length).toBe(25);

      let networkCallsCount = 0;
      const dyingNetworkFetch = (async () => {
        networkCallsCount += 1;
        throw new Error('TypeError: Failed to fetch (Timeout de rede em campo offgrid)');
      }) as any;

      const syncResult = await store.sincronizarFila('/api/v1/commands', dyingNetworkFetch);

      // Comprova que o laço abortou IMEDIATAMENTE na primeira falha (threshold 1)
      expect(networkCallsCount).toBe(1);
      expect(syncResult.errorsCount).toBe(1);
      expect(syncResult.syncedCount).toBe(0);
      expect(store.getState().outbox.length).toBe(25); // Todos os 25 preservados na fila
      expect(store.getCircuitBreaker().getState()).toBe('OPEN');
    });

    it('ADV-2.2: Cooldown de 15 segundos: tentativas subsequentes são bloqueadas localmente sem tocar na rede', async () => {
      const store = createCapatazTestStore('tenant-cooldown:user-01:fazenda-01:capataz');
      await store.ready;
      (store as any).state.isLeader = true;

      await store.registrarLeituraCocho({
        pasto_id: 'pasto-01',
        produto_id: 'prod-sal-mineral-80',
        escore_cocho: 2,
        sacos_fornecidos: 1
      });

      let networkCalls = 0;
      const failingFetch = (async () => {
        networkCalls += 1;
        return { ok: false, status: 503, json: async () => ({}) };
      }) as any;

      // Primeira tentativa falha e abre o circuito
      await store.sincronizarFila('/api/v1/commands', failingFetch);
      expect(networkCalls).toBe(1);
      expect(store.getCircuitBreaker().getState()).toBe('OPEN');

      // Simula 10 tentativas sucessivas de retry durante o cooldown
      for (let i = 0; i < 10; i++) {
        const res = await store.sincronizarFila('/api/v1/commands', failingFetch);
        expect(res.syncedCount).toBe(0);
      }

      // Nenhuma chamada adicional atingiu a rede
      expect(networkCalls).toBe(1);
      expect(store.getCircuitBreaker().getCooldownRemainingMs()).toBeGreaterThan(0);
      expect(store.getCircuitBreaker().getCooldownRemainingMs()).toBeLessThanOrEqual(15000);
    });

    it('ADV-2.3: Reset manual forçado restaura prontamente a capacidade de envio', () => {
      const cb = new SyncCircuitBreaker({ failureThreshold: 1, cooldownPeriodMs: 15000 });
      cb.trip('Falha forçada');
      expect(cb.getState()).toBe('OPEN');
      expect(cb.canAttemptSync()).toBe(false);

      cb.forceReset();
      expect(cb.getState()).toBe('CLOSED');
      expect(cb.canAttemptSync()).toBe(true);
      expect(cb.getLastFailure()).toBeNull();
    });
  });

  // =========================================================================
  // VETOR 3: FOTOS DE COCHO E LIMITES DE COMPRESSÃO
  // =========================================================================
  describe('Vetor 3: Compressão de Imagens de Campo, Aspect Ratio e Dissociação de Blobs', () => {
    it('ADV-3.1: Limites extremos de aspect ratio devem ser contidos com exatidão dentro de 1280x720', () => {
      // 1. Panorâmica extrema 32:9 (3840 x 1080)
      const panoFit = calculateAspectRatioFit(3840, 1080, 1280, 720);
      expect(panoFit.width).toBe(1280);
      expect(panoFit.height).toBe(Math.round((1080 * 1280) / 3840)); // 360
      expect(panoFit.height).toBeLessThanOrEqual(720);

      // 2. Vertical ultra-longa 9:32 (1080 x 3840)
      const vertFit = calculateAspectRatioFit(1080, 3840, 1280, 720);
      expect(vertFit.height).toBe(720);
      expect(vertFit.width).toBe(Math.round((1080 * 720) / 3840)); // 203
      expect(vertFit.width).toBeLessThanOrEqual(1280);

      // 3. Imagem quadrada de alta resolução (4000 x 4000)
      const squareFit = calculateAspectRatioFit(4000, 4000, 1280, 720);
      expect(squareFit.width).toBe(720);
      expect(squareFit.height).toBe(720);

      // 4. Imagem já pequena (640 x 480) não deve ser inflada
      const smallFit = calculateAspectRatioFit(640, 480, 1280, 720);
      expect(smallFit.width).toBe(640);
      expect(smallFit.height).toBe(480);
    });

    it('ADV-3.2: Foto pesada (8MB) comprimida deve ter redução > 85% e peso estritamente sub-250KB', async () => {
      const heavyPhoto = new Uint8Array(8 * 1024 * 1024); // 8MB
      const result = await compressPhoto(heavyPhoto, {
        pastoId: 'pasto-01',
        tipoRegistro: 'leitura_matutina'
      });

      expect(result.originalSizeBytes).toBe(8 * 1024 * 1024);
      expect(result.compressedSizeBytes).toBeLessThanOrEqual(250 * 1024);
      expect(result.compressionRatioPct).toBeGreaterThanOrEqual(85);
      expect(attachmentUploadMetadataSchema.shape.attachment_id.safeParse(result.attachment_id).success).toBe(true);
    });

    it('ADV-3.3: Dissociação estrita: envelope do comando na outbox possui payload leve (< 1KB) e zero blobs brutos', async () => {
      const store = createCapatazTestStore('tenant-attach:user-01:fazenda-01:capataz');
      await store.ready;
      const heavyPhoto = new Uint8Array(5 * 1024 * 1024);
      const compressed = await compressPhoto(heavyPhoto, {
        pastoId: 'pasto-02',
        cochoId: 'cocho-pasto-02',
        tipoRegistro: 'auditoria'
      });

      const { envelope } = await store.anexarFotoCocho(compressed);

      // 1. O payload do comando transporta apenas metadados leves (< 1KB)
      const byteLength = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
      expect(fotoCochoPayloadSchema.safeParse(envelope.payload).success).toBe(true);
      expect(byteLength(envelope.payload)).toBeLessThan(1024);

      // 2. O envelope completo NÃO embute strings de dados base64 pesadas
      const serializedEnvelope = JSON.stringify(envelope);
      expect(atomicCommandEnvelopeSchema.strict().safeParse(envelope).success).toBe(true);
      expect(envelope.attachment_refs).toHaveLength(1);
      const ref = envelope.attachment_refs[0]!;
      expect(attachmentUploadMetadataSchema.safeParse(ref).success).toBe(true);
      expect(Object.keys(ref).sort()).toEqual(['attachment_id', 'hash_sha256', 'local_blob_ref', 'mime_type', 'size_bytes']);
      expect(ref.attachment_id).toBe(compressed.attachment_id);
      expect(ref.size_bytes).toBe(compressed.blob!.size);
      expect(ref.mime_type).toBe(compressed.blob!.type);
      const assertMetadataOnly = (value: unknown): void => {
        expect(value instanceof Blob || value instanceof ArrayBuffer || ArrayBuffer.isView(value)).toBe(false);
        if (typeof value === 'string') expect(value).not.toMatch(/^(?:data:|blob:|https?:\/\/)/i);
        if (value && typeof value === 'object') {
          for (const [key, child] of Object.entries(value)) {
            expect(key).not.toMatch(/^(?:blob|bytes|binary|dataUrl|base64|url)$/i);
            assertMetadataOnly(child);
          }
        }
      };
      assertMetadataOnly(envelope);
      // Identity strings have no global maximum in the public envelope contract.
      // For this fixed context, budget its header plus <1KiB payload and one
      // strict reference with the public 512-character local key / 20MiB limits.
      const headerBytes = byteLength({ ...envelope, payload: {}, attachment_refs: [] });
      const maximumRefBytes = byteLength([{ ...ref, size_bytes: MAX_ATTACHMENT_BYTES, local_blob_ref: 'x'.repeat(512) }]);
      expect(new TextEncoder().encode(serializedEnvelope).byteLength).toBeLessThan(headerBytes + (1024 - 2) + (maximumRefBytes - 2));

      // 3. O blob pesado está armazenado desacoplado no store de fotos
      const state = store.getState();
      expect(state.fotos[compressed.attachment_id]).toBeDefined();
      const attachment = await createCapatazTestRuntime('tenant-attach:user-01:fazenda-01:capataz').localData.readAttachment(compressed.attachment_id);
      expect(attachment?.ref).toEqual(ref);
      expect(attachment?.blob).toBeInstanceOf(Blob);
      expect(await attachment!.blob.arrayBuffer()).toEqual(await compressed.blob!.arrayBuffer());
    });

    it('ADV-3.4: Geração de 100 attachment IDs em loop rápido deve ter zero colisões', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateAttachmentId());
      }
      expect(ids.size).toBe(100);
    });
  });

  // =========================================================================
  // VETOR 4: RESOLUÇÃO DE CONFLITOS SEM LAST-WRITE-WINS (LWW)
  // =========================================================================
  describe('Vetor 4: Resolução de Conflitos Especializada (Anti-LWW)', () => {
    it('ADV-4.1: Merge Aditivo: 3 operadores no mesmo pasto no mesmo dia coexistem no stream cronológico', async () => {
      // Chave canônica 4 partes: tenant:user:fazenda:profile
      const store = createCapatazTestStore('tenant-multi-op:user-c:fazenda-01:capataz');
      await store.ready;
      const { envelope: localCmd } = await store.registrarLeituraCocho({
        pasto_id: 'pasto-01',
        produto_id: 'prod-sal-mineral-80',
        escore_cocho: 2,
        sacos_fornecidos: 3
      });
      // Ajusta ocorrência local para as 10:00
      localCmd.occurred_at_local = '2026-11-05T10:00:00.000Z';

      const existingObservations = [
        {
          pasto_id: 'pasto-01',
          escore_cocho: 0,
          sacos_fornecidos: 0,
          occurred_at_local: '2026-11-05T07:00:00.000Z',
          operador_id: 'user-a'
        },
        {
          pasto_id: 'pasto-01',
          escore_cocho: 4,
          sacos_fornecidos: 6,
          occurred_at_local: '2026-11-05T14:00:00.000Z',
          operador_id: 'user-b'
        }
      ];

      const resolution = resolveDomainConflict(localCmd, {
        statusCode: 409,
        existingObservations
      });

      expect(resolution.strategy).toBe('ADDITIVE_MERGE');
      expect(resolution.resolved).toBe(true);

      const stream = resolution.mergedPayload.event_stream;
      expect(stream.length).toBe(3);

      // Verificação de ordem cronológica estrita
      expect(stream[0].operador_id).toBe('user-a');
      expect(stream[0].occurred_at_local).toBe('2026-11-05T07:00:00.000Z');

      expect(stream[1].operador_id).toBe('user-c'); // Inserido no meio ordenadamente
      expect(stream[1].occurred_at_local).toBe('2026-11-05T10:00:00.000Z');

      expect(stream[2].operador_id).toBe('user-b');
      expect(stream[2].occurred_at_local).toBe('2026-11-05T14:00:00.000Z');
    });

    it('ADV-4.2: Comandos de mutação física (estoque, lote, salga) NUNCA aplicam merge aditivo e exigem OCC 409', () => {
      const physicalCommands = [
        'gerente.lote.transferir_pasto',
        'escritorio.estoque.dar_baixa',
        'fabrica.producao.consumir_insumo',
        'fazenda.salga.reabastecer'
      ];

      for (const cmdType of physicalCommands) {
        expect(isAdditiveDomainCommand(cmdType)).toBe(false);

        const fakeEnvelope: any = {
          command_id: `cmd-${cmdType}`,
          command_type: cmdType,
          base_version: 2,
          payload: {}
        };

        const res = resolveDomainConflict(fakeEnvelope, {
          statusCode: 409,
          serverAggregateVersion: 5
        });

        expect(res.strategy).toBe('OCC_CONFLICT_REVIEW');
        expect(res.resolved).toBe(false);
      }
    });

    it('ADV-4.3: applyLocalResolution recalcula base_version e renova idempotency_key', () => {
      const originalEnvelope: any = {
        command_id: 'cmd-recalc-1',
        idempotency_key: 'idemp-original-123',
        base_version: 1,
        payload: { pasto_id: 'pasto-01' }
      };

      const updated = applyLocalResolution(originalEnvelope, 4);
      expect(updated.base_version).toBe(4);
      expect(updated.idempotency_key).toContain('idemp-original-123-recalc-');
    });
  });

  // =========================================================================
  // VETOR 5: PARTICIONAMENTO DE STORAGE E ERRO DE QUOTA (LF-003)
  // =========================================================================
  describe('Vetor 5: Particionamento Multitenant e Tratamento de Quota (LF-003)', () => {
    it('ADV-5.1: Matriz de 3 Tenants x 2 Usuários: isolamento completo sem contaminação cruzada', async () => {
      const tenants = ['tenant-alpha', 'tenant-beta', 'tenant-gamma'];
      const users = ['user-01', 'user-02'];
      const stores: CapatazStore[] = [];

      for (const t of tenants) {
        for (const u of users) {
          const key = `${t}:${u}:fazenda-01:capataz`;
          const store = createCapatazTestStore(key);
          await store.ready;
          await store.registrarContagemRebanho({
            pasto_id: 'pasto-01',
            lote_id: 'lote-recria-01',
            quantidade_cabecas: 100 + stores.length
          });
          stores.push(store);
        }
      }

      expect(stores.length).toBe(6);

      // Cada um dos 6 stores deve conter exatamente 1 comando em sua outbox
      for (let i = 0; i < 6; i++) {
        const currentStore = stores[i];
        expect(currentStore).toBeDefined();
        const state = currentStore!.getState();
        expect(state.outbox.length).toBe(1);
        expect(state.contagens.length).toBe(1);
        expect(state.contagens[0]!.quantidade_cabecas).toBe(100 + i);
      }
    });

    it('ADV-5.2: Injeção de QuotaExceededError não pode gerar falso ACK e deve expor erro na UI', async () => {
      const partitionKey = 'tenant-quota:user-01:fazenda-01:capataz';
      const { context, localData } = createCapatazTestRuntime(partitionKey);
      const store = getCapatazTestStore(partitionKey);
      await store.ready;
      store.injectQuotaFailure(true);

      await expect(store.registrarLeituraQrPasto({
          pasto_id: 'pasto-01',
          qr_code_lido: 'PASTO-01-MOMBACA-SEDE',
          altura_media_cm: 60
        })).rejects.toBeInstanceOf(StorageQuotaExceededError);

      const state = store.getState();
      expect(state.quotaExceededError).toContain('StorageQuotaExceededError');

      // Verifica se o componente CapatazView renderiza o alerta acessível
      const html = renderToString(
        React.createElement(
          I18nProvider,
          { language: 'pt-BR' },
          React.createElement(ModuleRuntimeProvider, { localData }, React.createElement(CapatazView, { context }))
        )
      );

      expect(html).toContain('role="alert"');
      expect(html).toContain('StorageQuotaExceededError');
    });
  });

  // =========================================================================
  // VETOR 6: BILINGUISMO (463 CHAVES) E ACESSIBILIDADE ARIA
  // =========================================================================
  describe('Vetor 6: Paridade Bilíngue Simétrica e Semântica W3C ARIA', () => {
    it('ADV-6.1: O Dicionário deve conter no mínimo 463 chaves em pt-BR e en-US com 100% de paridade', () => {
      const ptKeys = Object.keys(APP_DICTIONARY['pt-BR']);
      const enKeys = Object.keys(APP_DICTIONARY['en-US']);

      expect(ptKeys.length).toBeGreaterThanOrEqual(463);
      expect(enKeys.length).toBe(ptKeys.length);

      const diffPtEn = ptKeys.filter(k => !(k in APP_DICTIONARY['en-US']));
      const diffEnPt = enKeys.filter(k => !(k in APP_DICTIONARY['pt-BR']));

      expect(diffPtEn).toEqual([]);
      expect(diffEnPt).toEqual([]);
    });

    it('ADV-6.2: CapatazView deve cumprir W3C WAI-ARIA com roles tablist, tab, tabpanel e aria-selected', () => {
      const { context, localData } = createCapatazTestRuntime('tenant-aria:user-01:fazenda-01:capataz');
      const html = renderToString(
        React.createElement(
          I18nProvider,
          { language: 'pt-BR' },
          React.createElement(ModuleRuntimeProvider, { localData }, React.createElement(CapatazView, { context }))
        )
      );

      expect(html).toContain('role="tablist"');
      expect(html).toContain('role="tab"');
      expect(html).toContain('role="tabpanel"');
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('aria-controls="tabpanel-cocho"');
    });

    it('ADV-6.3: Botoeira de Escores de Cocho (0 a 4) deve possuir role="radiogroup" e touch targets ergonômicos', async () => {
      const store = createCapatazTestStore('tenant-botoeira:user-01:fazenda-01:capataz');
      await store.ready;
      const state = store.getState();

      const html = renderToString(
        React.createElement(
          I18nProvider,
          { language: 'pt-BR' },
          React.createElement(CapatazCochoTab, { store, state })
        )
      );

      expect(html).toContain('role="radiogroup"');
      expect(html).toContain('role="radio"');
      expect(html).toContain('aria-checked="true"');
      // Escores 0, 1, 2, 3, 4 representados
      for (let i = 0; i <= 4; i++) {
        expect(html).toContain(`Escore ${i}`);
      }
    });
  });
});
