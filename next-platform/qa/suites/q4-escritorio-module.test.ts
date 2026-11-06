import { EscritorioDashboardTab } from '../../apps/fazenda/escritorio/src/components/EscritorioDashboardTab';
import { moduleSeedSnapshot } from '../harness/module-seed';
import { describe, it, expect, beforeEach } from 'bun:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { I18nProvider, ModuleRuntimeProvider } from '@consubov/ui';
import { EscritorioView, ESCRITORIO_MODULE_DESCRIPTOR } from '@consubov/fazenda-escritorio';
import { EscritorioStore } from '../../apps/fazenda/escritorio/src/store/escritorioStore';
import { EscritorioFinanceiroTab } from '../../apps/fazenda/escritorio/src/components/EscritorioFinanceiroTab';
import { scanAstLiterals, findTsxFiles } from '../harness/ast-literal-guard';
import { registrarNotaFiscalPayloadSchema, APP_DICTIONARY, type ModuleExecutionContext, type ModuleLocalDataAPI, type LocalPendingCommand, type LocalMutation } from '@consubov/contracts';
import { resolve } from 'path';
import * as fs from 'fs';

describe('Q4.2: Módulo Escritório Local-First, Gestão de NF-e, Compras, Lotes e Bilinguismo', () => {
  let store: EscritorioStore;
  let localData: ModuleLocalDataAPI;
  const context: ModuleExecutionContext = {
    userId: 'user-escritorio-test', tenantId: 'tenant-test', farmId: 'fazenda-test', retreatId: null,
    moduleId: 'escritorio', profileId: 'escritorio', deviceId: 'device-test', productId: 'consubov'
  };

  beforeEach(async () => {
    const pending: LocalPendingCommand[] = [];
    localData = {
      readSnapshot: async () => null,
      listSnapshots: async <T,>() => [moduleSeedSnapshot('escritorio')] as import('@consubov/contracts').LocalSnapshot<T>[],
      commitMutation: async <T,>(mutation: LocalMutation<T>) => {
        pending.push({ command: mutation.command as LocalPendingCommand['command'], attachmentRefs: mutation.command.attachment_refs });
        return { commandId: mutation.command.command_id, committed: true };
      },
      readAttachment: async () => null,
      listPendingCommands: async (limit: number) => pending.slice(0, limit),
      getCursor: async () => null,
      getSchemaVersion: async () => 1
    };
    store = new EscritorioStore(context, localData);
    await store.ready;
  });

  function renderView(language: 'pt-BR' | 'en-US'): string {
    return renderToString(React.createElement(I18nProvider, { language }, React.createElement(ModuleRuntimeProvider, {
      localData,
      children: React.createElement(EscritorioView, { context })
    })));
  }

  it('Q4.2.1: deve exportar descritor canônico do módulo Escritório', () => {
    expect(ESCRITORIO_MODULE_DESCRIPTOR.moduleId).toBe('escritorio');
    expect(ESCRITORIO_MODULE_DESCRIPTOR.profileId).toBe('escritorio');
    expect(ESCRITORIO_MODULE_DESCRIPTOR.title).toBeDefined();
    expect(ESCRITORIO_MODULE_DESCRIPTOR.version).toBeDefined();
  });

  it('Q4.2.2: deve renderizar EscritorioView em pt-BR com abas e dados administrativos', () => {
    const html = renderView('pt-BR');

    expect(html).toContain('data-testid="escritorio-module-view"');
    expect(html).toContain('Escritório Administrativo');
    expect(html).toContain('Notas Fiscais (NF-e)');
    expect(html).toContain('Pedidos de Compra');
    expect(html).toContain('Cadastros e Desdobramentos');
  });

  it('Q4.2.3: deve renderizar EscritorioView em en-US com 100% de paridade linguística e zero vazamento de português', () => {
    const html = renderView('en-US');

    expect(html).toContain('data-testid="escritorio-module-view"');
    expect(html).toContain('Administrative Office');
    expect(html).toContain('Invoices (NF-e)');
    expect(html).toContain('Purchase Orders');
    expect(html).toContain('Lot Registrations &amp; Splits');
    expect(html).toContain('Administrative Overview');
    expect(html).not.toContain('Reconciliation Outbox Queue');
    expect(html).not.toContain('Pending Dispatch');

    // Asserções negativas obrigatórias contra vazamento de português em modo en-US
    const ptForbiddenTerms = [
      'Escritório Administrativo',
      'Resumo Administrativo',
      'Fila Outbox de Conciliação',
      'Pendentes de Envio',
      'Notas Fiscais (NF-e)',
      'Pedidos de Compra',
      'Cadastros e Desdobramentos',
      'Fechamento Financeiro'
    ];
    for (const term of ptForbiddenTerms) {
      expect(html).not.toContain(term);
    }
  });

  it('keeps administrative records usable without displaying delivery queues or synchronization state', async () => {
    await store.ready;
    await store.criarPedidoCompra({
      pedido_compra_id: 'pc-ui-no-status', fornecedor_id: 'forn-cerrado-nutri',
      produto_insumo_id: 'insumo-nucleo-confinamento', quantidade_pedida: 20,
      unidade: 'ton', preco_unitario_brl: 3400, condicao_pagamento: '30_60_dias',
      previsao_entrega: '2026-11-20T00:00:00.000Z'
    });
    expect(store.getState().outbox.length).toBeGreaterThan(0);
    for (const language of ['pt-BR', 'en-US'] as const) {
      const dashboard = renderView(language);
      const financial = renderToString(React.createElement(I18nProvider, { language },
        React.createElement(EscritorioFinanceiroTab, { state: store.getState(), store })));
      expect(financial).toContain(language === 'pt-BR' ? 'Emitir Relatório Financeiro' : 'Generate Financial Report');
      for (const html of [dashboard, financial]) {
        expect(html).not.toMatch(/outbox|pendentes de envio|pending dispatch|sincronizado|synchroni[sz]|sync status/i);
      }
    }
  });

  it('Q4.2.4: validação Zod da chave de acesso de 44 dígitos da NF-e (válida vs inválida)', () => {
    const validPayload = {
      nota_fiscal_id: 'nf-2026-999',
      numero_nf: '102938',
      serie: '1',
      chave_acesso_nfe: '35261100000000000000550010001029381000000018', // 44 dígitos
      fornecedor_cnpj_cpf: '12.345.678/0001-90',
      fornecedor_nome: 'Nutrição Animal do Cerrado Ltda',
      valor_total_brl: 125000,
      data_emissao: '2026-11-05T00:00:00.000Z',
      itens: [
        {
          produto_descricao: 'Milho Grão Seco',
          quantidade: 50,
          unidade_medida: 'ton' as const,
          valor_unitario_brl: 1100,
          valor_total_item_brl: 55000
        },
        {
          produto_descricao: 'Farelo de Soja 46%',
          quantidade: 35,
          unidade_medida: 'ton' as const,
          valor_unitario_brl: 2000,
          valor_total_item_brl: 70000
        }
      ]
    };

    const validResult = registrarNotaFiscalPayloadSchema.safeParse(validPayload);
    expect(validResult.success).toBe(true);

    // Chave com 43 dígitos (deve falhar)
    const invalidShortKey = { ...validPayload, chave_acesso_nfe: '3526110000000000000055001000102938100000001' };
    const shortResult = registrarNotaFiscalPayloadSchema.safeParse(invalidShortKey);
    expect(shortResult.success).toBe(false);

    // Chave com letras (deve falhar)
    const invalidLettersKey = { ...validPayload, chave_acesso_nfe: '3526110000000000000055001000102938100000001A' };
    const lettersResult = registrarNotaFiscalPayloadSchema.safeParse(invalidLettersKey);
    expect(lettersResult.success).toBe(false);

    // Sem itens (deve falhar)
    const invalidNoItems = { ...validPayload, itens: [] };
    const noItemsResult = registrarNotaFiscalPayloadSchema.safeParse(invalidNoItems);
    expect(noItemsResult.success).toBe(false);
  });

  it('Q4.2.5: store.registrarNotaFiscal deve criar AtomicCommandEnvelope e registrar entrada no estado local', async () => {
    const envelope = await store.registrarNotaFiscal({
      nota_fiscal_id: 'nf-2026-test-01',
      numero_nf: '88102',
      serie: '2',
      chave_acesso_nfe: '35261100000000000000550010001029381000000018',
      fornecedor_cnpj_cpf: '01.234.567/0001-89',
      fornecedor_nome: 'Fornecedora Vale do Boi',
      valor_total_brl: 45000,
      data_emissao: '2026-11-05T00:00:00.000Z',
      itens: [
        {
          produto_descricao: 'Sal Mineral 80',
          quantidade: 300,
          unidade_medida: 'sc',
          valor_unitario_brl: 150,
          valor_total_item_brl: 45000
        }
      ]
    });

    expect(envelope.command_type).toBe('escritorio.notas.registrar_entrada');
    expect(envelope.aggregate_type).toBe('nota_fiscal');
    expect(envelope.aggregate_id).toBe('nf-2026-test-01');
    expect(envelope.status).toBe('PENDENTE');

    const state = store.getState();
    const nf = state.notasFiscais.find(n => n.nota_fiscal_id === 'nf-2026-test-01');
    expect(nf).toBeDefined();
    expect(nf?.valor_total_brl).toBe(45000);
    expect(state.outbox.length).toBe(1);
  });

  it('Q4.2.6: store.criarPedidoCompra deve gerar envelope e registrar pedido no estado local', async () => {
    const envelope = await store.criarPedidoCompra({
      pedido_compra_id: 'pc-2026-900',
      fornecedor_id: 'forn-cerrado-nutri',
      produto_insumo_id: 'insumo-nucleo-confinamento',
      quantidade_pedida: 20,
      unidade: 'ton',
      preco_unitario_brl: 3400,
      condicao_pagamento: '30_60_dias',
      previsao_entrega: '2026-11-20T00:00:00.000Z'
    });

    expect(envelope.command_type).toBe('escritorio.compras.criar_pedido');
    expect(envelope.aggregate_id).toBe('pc-2026-900');

    const state = store.getState();
    const pedido = state.pedidosCompra.find(p => p.pedido_compra_id === 'pc-2026-900');
    expect(pedido).toBeDefined();
    expect(pedido?.quantidade_pedida).toBe(20);
    expect(pedido?.status).toBe('pendente');
  });

  it('Q4.2.7: store.particionarLote deve gerar envelope e criar sub-lotes no estado local', async () => {
    const envelope = await store.particionarLote({
      lote_origem_id: 'lote-adm-01',
      novos_lotes: [
        {
          nome_lote: 'Lote 01A - Recria Pesada',
          pasto_destino_id: 'pasto-05',
          quantidade_cabecas: 160,
          peso_medio_kg: 310
        },
        {
          nome_lote: 'Lote 01B - Recria Leve',
          pasto_destino_id: 'pasto-06',
          quantidade_cabecas: 160,
          peso_medio_kg: 260
        }
      ],
      data_particao: '2026-11-05T00:00:00.000Z'
    });

    expect(envelope.command_type).toBe('escritorio.lotes.particionar');
    expect(envelope.aggregate_id).toBe('lote-adm-01');

    const state = store.getState();
    expect(state.lotes.length).toBeGreaterThanOrEqual(3);
  });

  it('Q4.2.8: store.fecharCustoLote deve gerar envelope e registrar fechamento financeiro', async () => {
    const envelope = await store.fecharCustoLote({
      lote_id: 'lote-adm-01',
      periodo_mes: 10,
      periodo_ano: 2026,
      custo_nutricao_brl: 45000,
      custo_sanidade_brl: 8000,
      custo_pastagem_brl: 5000,
      custo_operacional_brl: 12000,
      valor_total_apropriado_brl: 70000,
      fechado_em: '2026-11-01T00:00:00.000Z'
    });

    expect(envelope.command_type).toBe('escritorio.custos.fechar');
    expect(envelope.aggregate_id).toBe('lote-adm-01');

    const state = store.getState();
    expect(state.fechamentos.length).toBe(1);
    expect(state.fechamentos[0]?.valor_total_apropriado_brl).toBe(70000);
  });

  it('Q4.2.9: AST Guard — apps/fazenda/escritorio/src deve ter ZERO violações de literais JSX', () => {
    const escritorioSrcDir = resolve(import.meta.dir, '../../apps/fazenda/escritorio/src');
    const files = findTsxFiles(escritorioSrcDir);
    expect(files.length).toBeGreaterThanOrEqual(6);

    const violations = scanAstLiterals(files);
    if (violations.length > 0) {
      console.error(`[AST GUARD FAIL] ${violations.length} literais detectados em escritorio/src:`, violations);
    }
    expect(violations).toEqual([]);
  });

  it('Q4.2.10: deve possuir semântica W3C ARIA Tabs completa e scope="col" nas tabelas', () => {
    const html = renderView('pt-BR');

    expect(html).toContain('role="tablist"');
    expect(html).toContain('id="tab-overview"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-controls="tabpanel-overview"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('id="tabpanel-overview"');
    expect(html).toContain('aria-labelledby="tab-overview"');
    const dashboard = renderToString(React.createElement(I18nProvider, { language: 'pt-BR' },
      React.createElement(EscritorioDashboardTab, { state: store.getState(), onRefresh: () => {}, onNavigateTab: () => {} })));
    expect(dashboard).toContain('scope="col"');
  });

  it('Q4.2.11: 100% das chaves passadas a t(...) em escritorio/src devem existir em APP_DICTIONARY', () => {
    const escritorioSrcDir = resolve(import.meta.dir, '../../apps/fazenda/escritorio/src');
    const files = findTsxFiles(escritorioSrcDir);
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
