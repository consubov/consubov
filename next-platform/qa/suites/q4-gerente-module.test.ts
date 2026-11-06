import { GerenteDashboardTab } from '../../apps/fazenda/gerente/src/components/GerenteDashboardTab';
import { moduleSeedSnapshot } from '../harness/module-seed';
import { describe, it, expect, beforeEach } from 'bun:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { I18nProvider, ModuleRuntimeProvider } from '@consubov/ui';
import { GerenteView, GERENTE_MODULE_DESCRIPTOR } from '@consubov/fazenda-gerente';
import { GerenteStore } from '../../apps/fazenda/gerente/src/store/gerenteStore';
import { scanAstLiterals, findTsxFiles } from '../harness/ast-literal-guard';
import { resolve } from 'path';
import * as fs from 'fs';
import { APP_DICTIONARY, type ModuleExecutionContext, type ModuleLocalDataAPI, type LocalSnapshot, type LocalPendingCommand } from '@consubov/contracts';

describe('Q4.1: Módulo Gerente Local-First, Indicadores Zootécnicos, Metas e Bilinguismo', () => {
  let store: GerenteStore;
  const context: ModuleExecutionContext = {
    userId: 'user-gerente-test', tenantId: 'tenant-test', farmId: 'farm-test', retreatId: null,
    moduleId: 'gerente', profileId: 'gerente', deviceId: 'device-gerente-test', productId: 'consubov'
  };
  function makeLocalData(): ModuleLocalDataAPI {
    const snapshots: LocalSnapshot[] = [moduleSeedSnapshot('gerente')];
    const commands: LocalPendingCommand[] = [];
    return {
      readSnapshot: async () => null,
      listSnapshots: async <T,>() => snapshots as LocalSnapshot<T>[],
      commitMutation: async mutation => {
        snapshots.push(mutation.snapshot);
        commands.push({ command: mutation.command as unknown as LocalPendingCommand['command'], attachmentRefs: mutation.command.attachment_refs });
        return { commandId: mutation.command.command_id, committed: true };
      },
      readAttachment: async () => null,
      listPendingCommands: async limit => commands.slice(0, limit),
      getCursor: async () => null,
      getSchemaVersion: async () => 1
    };
  }
  let testLocalData: ModuleLocalDataAPI;

  beforeEach(async () => {
    testLocalData = makeLocalData();
    store = new GerenteStore(context, testLocalData);
    await store.ready;
  });

  it('Q4.1.1: deve exportar descritor canônico do módulo Gerente', () => {
    expect(GERENTE_MODULE_DESCRIPTOR.moduleId).toBe('gerente');
    expect(GERENTE_MODULE_DESCRIPTOR.profileId).toBe('gerente');
    expect(GERENTE_MODULE_DESCRIPTOR.title).toBeDefined();
    expect(GERENTE_MODULE_DESCRIPTOR.version).toBeDefined();
  });

  it('Q4.1.2: deve renderizar GerenteView em pt-BR com dados zootécnicos e sem erros', () => {
    const html = renderToString(
      React.createElement(I18nProvider, { language: 'pt-BR' }, React.createElement(ModuleRuntimeProvider, { localData: testLocalData }, React.createElement(GerenteView, { context })))
    );

    expect(html).toContain('data-testid="gerente-module-view"');
    expect(html).toContain('Gerente de Produção');
    expect(html).toContain('Carregando dados operacionais');
    expect(html).not.toContain('Lote 01 - Garrotes Nelore');
    expect(html).toContain('Gestão de Lotes');
  });

  it('Q4.1.3: deve renderizar GerenteView em en-US com 100% de paridade linguística e zero vazamento de português', () => {
    const html = renderToString(
      React.createElement(I18nProvider, { language: 'en-US' }, React.createElement(ModuleRuntimeProvider, { localData: testLocalData }, React.createElement(GerenteView, { context })))
    );

    expect(html).toContain('data-testid="gerente-module-view"');
    expect(html).toContain('Production Manager');
    expect(html).toContain('Loading operational data');
    expect(html).toContain('Trough Score');
    expect(html).toContain('Herd Lots Management');
    const dashboard = renderToString(React.createElement(I18nProvider, { language: 'en-US' },
      React.createElement(GerenteDashboardTab, { state: store.getState(), onRefresh: () => {}, onNavigateTab: () => {} })));
    expect(dashboard).toContain('Lot Identification');
    expect(dashboard).toContain('Head Count');
    expect(dashboard).toContain('Average Weight (kg)');
    expect(dashboard).toContain('Target ADG (kg/day)');

    // Asserções negativas obrigatórias contra vazamento de português em modo en-US
    const ptForbiddenTerms = [
      'Gerente de Produção',
      'Identificação do Lote',
      'Quantidade de Cabeças',
      'Peso Médio',
      'Movimentar para Pasto',
      'Apropriar Custos Mensais',
      'Ganho Médio Diário',
      'Escore de Cocho',
      'Visão Geral da Produção'
    ];
    for (const term of ptForbiddenTerms) {
      expect(html).not.toContain(term);
    }
  });

  it('Q4.1.4: store.definirMetas deve gerar AtomicCommandEnvelope válido e atualizar estado local', async () => {
    const envelope = await store.definirMetas({
      lote_id: 'lote-recria-01',
      gmd_alvo_kg_dia: 1.48,
      peso_final_alvo_kg: 520,
      data_alvo_abate: '2026-12-30T00:00:00.000Z',
      estrategia_nutricional: 'pasto_aguas',
      consumo_esperado_g_cab_dia: 1400
    });

    expect(envelope.command_type).toBe('gerente.metas.definir');
    expect(envelope.aggregate_type).toBe('lote');
    expect(envelope.aggregate_id).toBe('lote-recria-01');
    expect(envelope.status).toBe('PENDENTE');
    expect(envelope.payload.gmd_alvo_kg_dia).toBe(1.48);

    const state = store.getState();
    const lote = state.lotes.find(l => l.lote_id === 'lote-recria-01');
    expect(lote).toBeDefined();
    expect(lote?.meta_gmd_kg_dia).toBe(1.48);
    expect(state.kpis.gmdMeta).toBe(1.48);
    expect(state.outbox.length).toBe(1);
  });

  it('Q4.1.5: store.ajustarDieta deve registrar comando e atualizar meta de consumo', async () => {
    const envelope = await store.ajustarDieta({
      lote_id: 'lote-recria-01',
      produto_id: 'prod-suplemento-aguas',
      nova_meta_consumo_g_cab_dia: 1600,
      periodo_inicio: '2026-11-05T00:00:00.000Z',
      motivo_ajuste: 'Aumento de carga forrageira nas águas'
    });

    expect(envelope.command_type).toBe('gerente.gmd.ajustar_curva');
    expect(envelope.payload.nova_meta_consumo_g_cab_dia).toBe(1600);

    const state = store.getState();
    const lote = state.lotes.find(l => l.lote_id === 'lote-recria-01');
    expect(lote?.consumo_esperado_g_cab_dia).toBe(1600);
  });

  it('Q4.1.6: store.transferirPasto deve atualizar pasto do lote e gerar envelope de movimentação', async () => {
    const envelope = await store.transferirPasto({
      lote_id: 'lote-recria-01',
      pasto_origem_id: 'pasto-04',
      pasto_destino_id: 'pasto-12',
      quantidade_animais: 320,
      motivo_movimentacao: 'rotacionamento',
      data_movimentacao: '2026-11-05T08:00:00.000Z',
      responsavel_nome: 'Marcos Gerente'
    });

    expect(envelope.command_type).toBe('gerente.lote.transferir_pasto');
    expect(envelope.payload.pasto_destino_id).toBe('pasto-12');

    const state = store.getState();
    const lote = state.lotes.find(l => l.lote_id === 'lote-recria-01');
    expect(lote?.pasto_id).toBe('pasto-12');
  });

  it('Q4.1.7: store.apropriarCustos deve atualizar centros de custo do lote', async () => {
    const envelope = await store.apropriarCustos({
      lote_id: 'lote-recria-01',
      periodo_mes: 11,
      periodo_ano: 2026,
      valor_total_apropriado: 100000,
      itens_apropriacao: [
        { centro_custo: 'Nutricao', valor: 60000 },
        { centro_custo: 'Sanidade', valor: 20000 },
        { centro_custo: 'Operacional', valor: 20000 }
      ],
      data_apropriacao: '2026-11-05T09:00:00.000Z'
    });

    expect(envelope.command_type).toBe('gerente.custos.apropriar');
    expect(envelope.payload.valor_total_apropriado).toBe(100000);

    const state = store.getState();
    expect(state.custos.length).toBe(3);
    expect(state.custos[0]?.percentual).toBe(60);
  });

  it('Q4.1.8: store.aprovarLeituraCocho deve auditar e aprovar leitura de cocho', async () => {
    const envelope = await store.aprovarLeituraCocho({
      leitura_cocho_id: 'leitura-01',
      pasto_id: 'pasto-04',
      status_aprovacao: 'aprovado',
      escore_revisado: 3,
      novo_fornecimento_sacos: 9,
      justificativa_ajuste: 'Leitura condizente com o lote',
      aprovado_em: '2026-11-05T10:00:00.000Z'
    });

    expect(envelope.command_type).toBe('gerente.leitura_cocho.aprovar');
    expect(envelope.payload.status_aprovacao).toBe('aprovado');

    const state = store.getState();
    const leitura = state.auditoriasCocho.find(a => a.leitura_cocho_id === 'leitura-01');
    expect(leitura?.status).toBe('aprovado');
    expect(leitura?.sacos_fornecidos).toBe(9);
  });

  it('Q4.1.9: AST Guard — apps/fazenda/gerente/src deve ter ZERO violações de literais JSX', () => {
    const gerenteSrcDir = resolve(import.meta.dir, '../../apps/fazenda/gerente/src');
    const files = findTsxFiles(gerenteSrcDir);
    expect(files.length).toBeGreaterThanOrEqual(6);

    const violations = scanAstLiterals(files);
    if (violations.length > 0) {
      console.error(`[AST GUARD FAIL] ${violations.length} literais detectados em gerente/src:`, violations);
    }
    expect(violations).toEqual([]);
  });

  it('Q4.1.10: deve possuir semântica W3C ARIA Tabs completa e scope="col" nas tabelas', () => {
    const html = renderToString(
      React.createElement(I18nProvider, { language: 'pt-BR' }, React.createElement(ModuleRuntimeProvider, { localData: testLocalData }, React.createElement(GerenteView, { context })))
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('id="tab-overview"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-controls="tabpanel-overview"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('id="tabpanel-overview"');
    expect(html).toContain('aria-labelledby="tab-overview"');
    const dashboard = renderToString(React.createElement(I18nProvider, { language: 'pt-BR' },
      React.createElement(GerenteDashboardTab, { state: store.getState(), onRefresh: () => {}, onNavigateTab: () => {} })));
    expect(dashboard).toContain('scope="col"');
  });

  it('Q4.1.11: 100% das chaves passadas a t(...) em gerente/src devem existir em APP_DICTIONARY', () => {
    const gerenteSrcDir = resolve(import.meta.dir, '../../apps/fazenda/gerente/src');
    const files = findTsxFiles(gerenteSrcDir);
    const validPtKeys = new Set(Object.keys(APP_DICTIONARY['pt-BR']));
    const validEnKeys = new Set(Object.keys(APP_DICTIONARY['en-US']));

    const missingKeys: { file: string; key: string }[] = [];
    const tCallRegex = /\bt\(\s*['"]([a-zA-Z0-9_.-]+)['"]/g;

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      let match;
      while ((match = tCallRegex.exec(content)) !== null) {
        const key = match[1] ?? '';
        if (!validPtKeys.has(key) || !validEnKeys.has(key)) {
          missingKeys.push({ file, key });
        }
      }
    }

    expect(missingKeys).toEqual([]);
  });
});
