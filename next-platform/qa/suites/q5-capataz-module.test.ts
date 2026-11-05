import { describe, it, expect, beforeEach } from 'bun:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { I18nProvider } from '@consubov/ui';
import {
  CapatazView,
  CAPATAZ_MODULE_DESCRIPTOR,
  CapatazCochoTab,
  CapatazQrTab,
  CapatazContagemTab,
  CapatazFotosTab,
  CapatazHistoricoTab,
  CapatazStore,
  resetCapatazStoresForTesting
} from '../../apps/fazenda/capataz/src';

describe('Q5.1: Módulo Capataz de Campo, Abas ARIA, Escores 0 a 4 e Bilinguismo', () => {
  let store: CapatazStore;

  beforeEach(() => {
    resetCapatazStoresForTesting();
    store = new CapatazStore('consubov:tenant-test:user-capataz:fazenda-01:capataz');
  });

  it('Q5.1.1: deve exportar descritor canônico do módulo Capataz', () => {
    expect(CAPATAZ_MODULE_DESCRIPTOR.moduleId).toBe('capataz');
    expect(CAPATAZ_MODULE_DESCRIPTOR.profileId).toBe('capataz');
    expect(CAPATAZ_MODULE_DESCRIPTOR.title).toBeDefined();
    expect(CAPATAZ_MODULE_DESCRIPTOR.version).toBeDefined();
  });

  it('Q5.1.2: deve renderizar CapatazView em pt-BR com cabeçalho, abas e SyncStatusBar', () => {
    const html = renderToString(
      React.createElement(
        I18nProvider,
        { language: 'pt-BR' },
        React.createElement(CapatazView, { partitionKey: store.getPartitionKey() })
      )
    );

    expect(html).toContain('data-testid="capataz-module-view"');
    expect(html).toContain('Capataz de Campo');
    expect(html).toContain('Ronda de Cocho');
    expect(html).toContain('QR Code de Pasto');
    expect(html).toContain('Contagem de Rebanho');
    expect(html).toContain('Fotos do Cocho');
    expect(html).toContain('Histórico &amp; Filas');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('role="tabpanel"');
  });

  it('Q5.1.3: deve renderizar CapatazView em en-US com 100% de paridade linguística e zero vazamento de termos em português', () => {
    const html = renderToString(
      React.createElement(
        I18nProvider,
        { language: 'en-US' },
        React.createElement(CapatazView, { partitionKey: store.getPartitionKey() })
      )
    );

    expect(html).toContain('data-testid="capataz-module-view"');
    expect(html).toContain('Ranch Supervisor');
    expect(html).toContain('Bunk Reading');
    expect(html).toContain('Pasture QR Code');
    expect(html).toContain('Herd Count');
    expect(html).toContain('Trough Photos');
    expect(html).toContain('History &amp; Queue');

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

  it('Q5.1.8: deve renderizar CapatazHistoricoTab com status Web Locks, Circuit Breaker e outbox', () => {
    const state = store.getState();
    const html = renderToString(
      React.createElement(
        I18nProvider,
        { language: 'pt-BR' },
        React.createElement(CapatazHistoricoTab, { store, state })
      )
    );

    expect(html).toContain('data-testid="capataz-historico-tab"');
    expect(html).toContain('Status de Eleição de Líder Web Locks');
    expect(html).toContain('Circuit Breaker de Rede');
    expect(html).toContain('Comandos Pendentes de Envio');
    expect(html).toContain('Leituras de Cocho: Merge Aditivo aplicado automaticamente');
  });
});
