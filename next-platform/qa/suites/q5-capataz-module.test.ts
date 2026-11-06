import { describe, it, expect, beforeEach } from 'bun:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { I18nProvider, ModuleRuntimeProvider } from '@consubov/ui';
import {
  CapatazView,
  CAPATAZ_MODULE_DESCRIPTOR,
  CapatazCochoTab,
  CapatazQrTab,
  CapatazContagemTab,
  CapatazFotosTab,
  CapatazHistoricoTab,
  CapatazStore,
  getCapatazStore,
  resetCapatazStoresForTesting
} from '../../apps/fazenda/capataz/src';
import { createCapatazTestRuntime, createCapatazTestStore, resetCapatazTestData } from '../harness/capataz-test-runtime';

describe('Q5.1: Módulo Capataz de Campo, Abas ARIA, Escores 0 a 4 e Bilinguismo', () => {
  let store: CapatazStore;
  let testContext: ReturnType<typeof createCapatazTestRuntime>['context'];
  let testLocalData: ReturnType<typeof createCapatazTestRuntime>['localData'];

  beforeEach(async () => {
    resetCapatazStoresForTesting();
    resetCapatazTestData();
    const runtime = createCapatazTestRuntime('consubov:tenant-test:user-capataz:fazenda-01:capataz');
    testContext = runtime.context;
    testLocalData = runtime.localData;
    store = createCapatazTestStore('consubov:tenant-test:user-capataz:fazenda-01:capataz');
    await store.ready;
  });

  it('Q5.1.1: deve exportar descritor canônico do módulo Capataz', () => {
    expect(CAPATAZ_MODULE_DESCRIPTOR.moduleId).toBe('capataz');
    expect(CAPATAZ_MODULE_DESCRIPTOR.profileId).toBe('capataz');
    expect(CAPATAZ_MODULE_DESCRIPTOR.title).toBeDefined();
    expect(CAPATAZ_MODULE_DESCRIPTOR.version).toBeDefined();
  });

  it('Q5.1.1a: bloqueia mutações quando a hidratação inicial falha e mantém o erro visível', async () => {
    const runtime = createCapatazTestRuntime('consubov:tenant-hydration:user-capataz:fazenda-01:capataz');
    const localData = runtime.localData;
    localData.listSnapshots = async () => { throw new Error('IndexedDB indisponível'); };
    let committed = false;
    localData.commitMutation = async () => {
      committed = true;
      throw new Error('A mutação não deveria ser persistida');
    };
    const failedStore = new CapatazStore(runtime.context, localData);

    await expect(failedStore.ready).rejects.toThrow('IndexedDB indisponível');
    expect(failedStore.getState().quotaExceededError).toContain('IndexedDB indisponível');
    await expect(failedStore.registrarLeituraCocho({
      pasto_id: 'pasto-01', produto_id: 'prod-sal', escore_cocho: 2, sacos_fornecidos: 1
    })).rejects.toThrow('IndexedDB indisponível');
    expect(committed).toBe(false);
  });

  it('Q5.1.1b: serializa reload cross-tab depois da gravação local em andamento', async () => {
    const runtime = createCapatazTestRuntime('consubov:tenant-cross-tab:user-capataz:fazenda-01:capataz');
    const serialStore = new CapatazStore(runtime.context, runtime.localData);
    await serialStore.ready;
    const originalCommit = runtime.localData.commitMutation.bind(runtime.localData);
    const originalListSnapshots = runtime.localData.listSnapshots.bind(runtime.localData);
    let beginCommit!: () => void;
    let finishCommit!: () => void;
    const commitStarted = new Promise<void>(resolve => { beginCommit = resolve; });
    const commitGate = new Promise<void>(resolve => { finishCommit = resolve; });
    let committing = false;
    let hydratedDuringCommit = false;
    runtime.localData.commitMutation = async mutation => {
      committing = true;
      beginCommit();
      await commitGate;
      const result = await originalCommit(mutation);
      committing = false;
      return result;
    };
    runtime.localData.listSnapshots = async (...args) => {
      hydratedDuringCommit ||= committing;
      return originalListSnapshots(...args);
    };

    const mutation = serialStore.registrarLeituraCocho({
      pasto_id: 'pasto-01', produto_id: 'prod-sal', escore_cocho: 2, sacos_fornecidos: 1
    });
    await commitStarted;
    (serialStore as unknown as { enqueueHydration: () => void }).enqueueHydration();
    finishCommit();
    await mutation;
    await (serialStore as unknown as { mutationQueue: Promise<void> }).mutationQueue;

    expect(hydratedDuringCommit).toBe(false);
  });

  it('Q5.1.1c: mantém stores distintas quando o deviceId da execução muda', async () => {
    const first = createCapatazTestRuntime('consubov:tenant-device:user-capataz:fazenda-01:capataz');
    const second = createCapatazTestRuntime('consubov:tenant-device:user-capataz:fazenda-01:capataz');
    second.context.deviceId = 'device-capataz-rotated';

    const firstStore = getCapatazStore(first.context, first.localData);
    const secondStore = getCapatazStore(second.context, second.localData);
    expect(secondStore).not.toBe(firstStore);
    await Promise.all([firstStore.ready, secondStore.ready]);
  });

  it('Q5.1.2: deve renderizar CapatazView em pt-BR com cabeçalho, abas e SyncStatusBar', () => {
    const html = renderToString(
      React.createElement(
        I18nProvider,
        { language: 'pt-BR' },
        React.createElement(ModuleRuntimeProvider, { localData: testLocalData }, React.createElement(CapatazView, { context: testContext }))
      )
    );

    expect(html).toContain('data-testid="capataz-module-view"');
    expect(html).toContain('Capataz de Campo');
    expect(html).toContain('Ronda de Cocho');
    expect(html).toContain('QR Code de Pasto');
    expect(html).toContain('Contagem de Rebanho');
    expect(html).toContain('Fotos do Cocho');
    expect(html).toContain('Histórico de Campo');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('role="tabpanel"');
  });

  it('Q5.1.3: deve renderizar CapatazView em en-US com 100% de paridade linguística e zero vazamento de termos em português', () => {
    const html = renderToString(
      React.createElement(
        I18nProvider,
        { language: 'en-US' },
        React.createElement(ModuleRuntimeProvider, { localData: testLocalData }, React.createElement(CapatazView, { context: testContext }))
      )
    );

    expect(html).toContain('data-testid="capataz-module-view"');
    expect(html).toContain('Ranch Supervisor');
    expect(html).toContain('Bunk Reading');
    expect(html).toContain('Pasture QR Code');
    expect(html).toContain('Herd Count');
    expect(html).toContain('Trough Photos');
    expect(html).toContain('Field History');

    // Asserções negativas contra vazamento de português em modo en-US
    const ptForbiddenTerms = [
      'Capataz de Campo',
      'Ronda de Cocho',
      'QR Code de Pasto',
      'Contagem de Rebanho',
      'Fotos do Cocho',
      'Histórico & Filas',
      'Escore do Cocho',
      'Sacos Fornecidos',
      'Comandos Pendentes'
    ];

    for (const term of ptForbiddenTerms) {
      expect(html).not.toContain(term);
    }
  });

  it('Q5.1.4: deve renderizar CapatazCochoTab com escores 0 a 4 destacados e campos operacionais', () => {
    const state = store.getState();
    const html = renderToString(
      React.createElement(
        I18nProvider,
        { language: 'pt-BR' },
        React.createElement(CapatazCochoTab, { store, state })
      )
    );

    expect(html).toContain('data-testid="capataz-cocho-tab"');
    expect(html).toContain('Ronda e Avaliação de Cocho');
    expect(html).toContain('Escore do Cocho (0 a 4)');
    expect(html).toContain('Pasto / Piquete');
    expect(html).toContain('Lote Alocado');
    expect(html).toContain('Suplemento / Ração');
    expect(html).toContain('Sacos Fornecidos');
    expect(html).toContain('Peso do Saco (kg)');
    expect(html).toContain('Cocho foi limpo antes do fornecimento?');
    expect(html).toContain('Observações de Campo');
    expect(html).toContain('Registrar Ronda de Cocho');
    expect(html).toContain('role="radiogroup"');
  });

  it('Q5.1.5: deve renderizar CapatazQrTab com simulação e campos de pasto e aguada', () => {
    const state = store.getState();
    const html = renderToString(
      React.createElement(
        I18nProvider,
        { language: 'pt-BR' },
        React.createElement(CapatazQrTab, { store, state })
      )
    );

    expect(html).toContain('data-testid="capataz-qr-tab"');
    expect(html).toContain('Leitura de QR Code de Pasto');
    expect(html).toContain('Simular Leitura QR');
    expect(html).toContain('Altura Média do Pasto (cm)');
    expect(html).toContain('Massa de Forragem (1 a 5)');
    expect(html).toContain('Condição da Aguada');
    expect(html).toContain('Condição Estrutural do Cocho');
    expect(html).toContain('Entrada Manual com Justificativa');
    expect(html).toContain('Salvar Leitura de Pasto');
  });

  it('Q5.1.6: deve renderizar CapatazContagemTab com cabeças, bezerros e mortalidade', () => {
    const state = store.getState();
    const html = renderToString(
      React.createElement(
        I18nProvider,
        { language: 'pt-BR' },
        React.createElement(CapatazContagemTab, { store, state })
      )
    );

    expect(html).toContain('data-testid="capataz-contagem-tab"');
    expect(html).toContain('Contagem e Ronda de Rebanho');
    expect(html).toContain('Total de Cabeças Contadas');
    expect(html).toContain('Bezerros ao Pé');
    expect(html).toContain('Animais Mortos / Baixas');
    expect(html).toContain('Confirmar Contagem de Campo');
  });

  it('Q5.1.7: deve renderizar CapatazFotosTab com compressão client-side e galeria', () => {
    const state = store.getState();
    const html = renderToString(
      React.createElement(
        I18nProvider,
        { language: 'pt-BR' },
        React.createElement(CapatazFotosTab, { store, state })
      )
    );

    expect(html).toContain('data-testid="capataz-fotos-tab"');
    expect(html).toContain('Gestão de Fotos de Cocho');
    expect(html).toContain('Tirar Foto ou Carregar Arquivo');
    expect(html).toContain('Tipo de Registro Fotográfico');
    expect(html).toContain('Galeria de Fotos Locais do Dia');
  });

  it('Q5.1.8: mostra registros de campo e omite detalhes internos de sincronização', async () => {
    await store.registrarLeituraCocho({
      pasto_id: 'pasto-01', produto_id: 'prod-sal', escore_cocho: 3, sacos_fornecidos: 2
    });
    await store.registrarLeituraQrPasto({
      pasto_id: 'pasto-01', altura_media_cm: 72, qr_code_lido: 'PASTO-01-MOMBACA-SEDE'
    });
    await store.registrarContagemRebanho({
      pasto_id: 'pasto-01', lote_id: 'lote-recria-01', quantidade_cabecas: 42
    });
    const state = store.getState();
    const html = renderToString(
      React.createElement(
        I18nProvider,
        { language: 'pt-BR' },
        React.createElement(CapatazHistoricoTab, { store, state })
      )
    );

    expect(html).toContain('data-testid="capataz-historico-tab"');
    expect(html).toContain('Histórico de Operações');
    expect(html).toContain('Leitura de cocho');
    expect(html).toContain('Leitura de pasto');
    expect(html).toContain('Contagem de rebanho');
    expect(html).toContain('Pasto 01 - Mombaça Sede');
    expect(html).toContain('72 cm');
    expect(html).toContain('42 cabeças');

    for (const prohibited of ['Web Locks', 'Circuit Breaker', 'Outbox', 'Comandos Pendentes', 'Comandos Sincronizados', 'Forçar Tentativa', 'ID do Comando', 'OCC 409', 'Merge Aditivo']) {
      expect(html).not.toContain(prohibited);
    }

    const englishHtml = renderToString(
      React.createElement(I18nProvider, { language: 'en-US' }, React.createElement(CapatazHistoricoTab, { store, state }))
    );
    expect(englishHtml).toContain('Operation History');
    expect(englishHtml).toContain('Bunk reading');
    expect(englishHtml).toContain('Pasture reading');
    expect(englishHtml).toContain('Herd count');
    for (const prohibited of ['Web Locks', 'Circuit Breaker', 'Outbox', 'Pending Commands', 'Sync Retry', 'Command ID', 'OCC 409']) {
      expect(englishHtml).not.toContain(prohibited);
    }

    const conflictState = {
      ...state,
      conflitos: [{ command: state.outbox[0]!, detectedAt: new Date().toISOString(), reason: 'internal OCC 409 detail', serverVersion: 2 }]
    };
    const conflictHtml = renderToString(
      React.createElement(I18nProvider, { language: 'pt-BR' }, React.createElement(CapatazHistoricoTab, { store, state: conflictState }))
    );
    expect(conflictHtml).toContain('Registro precisa de revisão');
    expect(conflictHtml).not.toContain('Manter este registro');
    expect(conflictHtml).not.toContain('Usar registro atualizado');
    expect(conflictHtml).toContain('Os dados informados foram preservados');
    expect(conflictHtml).not.toContain('internal OCC 409 detail');
    expect(conflictHtml).not.toContain(state.outbox[0]!.command_id);
  });
});
