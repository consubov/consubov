import { describe, it, expect, beforeEach } from 'bun:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { I18nProvider } from '@consubov/ui';
import { EscritorioView, ESCRITORIO_MODULE_DESCRIPTOR } from '@consubov/fazenda-escritorio';
import { EscritorioStore } from '../../apps/fazenda/escritorio/src/store/escritorioStore';
import { scanAstLiterals, findTsxFiles } from '../harness/ast-literal-guard';
import { registrarNotaFiscalPayloadSchema } from '@consubov/contracts';
import { resolve } from 'path';

describe('Q4.2: Módulo Escritório Local-First, Gestão de NF-e, Compras, Lotes e Bilinguismo', () => {
  let store: EscritorioStore;

  beforeEach(() => {
    store = new EscritorioStore('consubov:test:escritorio:01');
  });

  it('Q4.2.1: deve exportar descritor canônico do módulo Escritório', () => {
    expect(ESCRITORIO_MODULE_DESCRIPTOR.moduleId).toBe('escritorio');
    expect(ESCRITORIO_MODULE_DESCRIPTOR.profileId).toBe('escritorio');
    expect(ESCRITORIO_MODULE_DESCRIPTOR.title).toBeDefined();
    expect(ESCRITORIO_MODULE_DESCRIPTOR.version).toBeDefined();
  });

  it('Q4.2.2: deve renderizar EscritorioView em pt-BR com abas e dados administrativos', () => {
    const html = renderToString(
      React.createElement(I18nProvider, { language: 'pt-BR' }, React.createElement(EscritorioView))
    );

    expect(html).toContain('data-testid="escritorio-module-view"');
    expect(html).toContain('Escritório Administrativo');
    expect(html).toContain('Notas Fiscais (NF-e)');
    expect(html).toContain('Pedidos de Compra');
    expect(html).toContain('Cadastros e Desdobramentos');
  });

  it('Q4.2.3: deve renderizar EscritorioView em en-US com 100% de paridade linguística', () => {
    const html = renderToString(
      React.createElement(I18nProvider, { language: 'en-US' }, React.createElement(EscritorioView))
    );

    expect(html).toContain('data-testid="escritorio-module-view"');
    expect(html).toContain('Administrative Office');
    expect(html).toContain('Invoices (NF-e)');
    expect(html).toContain('Purchase Orders');
    expect(html).toContain('Lot Registrations &amp; Splits');
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

  it('Q4.2.5: store.registrarNotaFiscal deve criar AtomicCommandEnvelope e registrar entrada no estado local', () => {
    const envelope = store.registrarNotaFiscal({
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

  it('Q4.2.6: store.criarPedidoCompra deve gerar envelope e registrar pedido no estado local', () => {
    const envelope = store.criarPedidoCompra({
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

  it('Q4.2.7: store.particionarLote deve gerar envelope e criar sub-lotes no estado local', () => {
    const envelope = store.particionarLote({
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

  it('Q4.2.8: store.fecharCustoLote deve gerar envelope e registrar fechamento financeiro', () => {
    const envelope = store.fecharCustoLote({
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
});
