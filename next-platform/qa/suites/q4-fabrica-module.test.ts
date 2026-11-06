import { moduleSeedSnapshot } from '../harness/module-seed';
import { describe, it, expect, beforeEach } from 'bun:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { I18nProvider, ModuleRuntimeProvider } from '@consubov/ui';
import { FabricaView, FABRICA_MODULE_DESCRIPTOR } from '@consubov/fazenda-fabrica';
import { FabricaStore } from '../../apps/fazenda/fabrica/src/store/fabricaStore';
import { scanAstLiterals, findTsxFiles } from '../harness/ast-literal-guard';
import { iniciarBatidaPayloadSchema, concluirBatidaPayloadSchema, criarFormulaRacaoPayloadSchema, APP_DICTIONARY, type ModuleExecutionContext, type ModuleLocalDataAPI, type LocalSnapshot, type LocalPendingCommand } from '@consubov/contracts';
import { resolve } from 'path';
import * as fs from 'fs';

describe('Q4.3: Módulo Fábrica Local-First, Batidas Industriais, Baixa de Silos e Bilinguismo', () => {
  let store: FabricaStore;
  const context: ModuleExecutionContext = {
    userId: 'user-fabrica-test', tenantId: 'tenant-test', farmId: 'farm-test', retreatId: null,
    moduleId: 'fabrica', profileId: 'fabrica', deviceId: 'device-fabrica-test', productId: 'consubov'
  };
  function makeLocalData(): ModuleLocalDataAPI {
    const snapshots: LocalSnapshot[] = [moduleSeedSnapshot('fabrica')];
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
    store = new FabricaStore(context, testLocalData);
    await store.ready;
  });

  it('Q4.3.1: deve exportar descritor canônico do módulo Fábrica', () => {
    expect(FABRICA_MODULE_DESCRIPTOR.moduleId).toBe('fabrica');
    expect(FABRICA_MODULE_DESCRIPTOR.profileId).toBe('fabrica');
    expect(FABRICA_MODULE_DESCRIPTOR.title).toBeDefined();
    expect(FABRICA_MODULE_DESCRIPTOR.version).toBeDefined();
  });

  it('Q4.3.2: deve renderizar FabricaView em pt-BR com misturadores e silos', () => {
    const html = renderToString(
      React.createElement(I18nProvider, { language: 'pt-BR' }, React.createElement(ModuleRuntimeProvider, { localData: testLocalData, children: React.createElement(FabricaView, { context }) }))
    );

    expect(html).toContain('data-testid="fabrica-module-view"');
    expect(html).toContain('Operador da Fábrica de Ração');
    expect(html).toContain('Batidas e Misturadores');
    expect(html).toContain('Fórmulas Nutricionais');
    expect(html).toContain('Estoque de Silos');
    expect(html).toContain('Balança e Calibração');
  });

  it('Q4.3.3: deve renderizar FabricaView em en-US com 100% de paridade linguística e zero vazamento de português', () => {
    const html = renderToString(
      React.createElement(I18nProvider, { language: 'en-US' }, React.createElement(ModuleRuntimeProvider, { localData: testLocalData, children: React.createElement(FabricaView, { context }) }))
    );

    expect(html).toContain('data-testid="fabrica-module-view"');
    expect(html).toContain('Feed Mill Operator');
    expect(html).toContain('Feed Batches &amp; Mixers');
    expect(html).toContain('Nutritional Formulas');
    expect(html).toContain('Silo Inventory');
    expect(html).toContain('Scales &amp; Calibration');
    expect(html).toContain('Feed Mill Overview');

    // Asserções negativas obrigatórias contra vazamento de português em modo en-US
    const ptForbiddenTerms = [
      'Operador da Fábrica de Ração',
      'Painel da Fábrica',
      'Batidas e Misturadores',
      'Fórmulas Nutricionais',
      'Estoque de Silos',
      'Balança e Calibração',
      'Salvar Fórmula Nutricional',
      'Produto Armazenado',
      'Ajustar Inventário do Silo',
      'Receber Carga de Matéria-Prima'
    ];
    for (const term of ptForbiddenTerms) {
      expect(html).not.toContain(term);
    }
  });

  it('Q4.3.4: validação matemática estrita da soma de 100% dos ingredientes na fórmula (Store e Schema Zod .refine)', async () => {
    // 1. Frontend Store: Fórmula com soma incorreta (90%): deve lançar erro
    expect(() => {
      store.salvarFormula({
        formula_id: 'formula-errada-90',
        nome_formula: 'Fórmula Incompleta',
        tipo_raca_destino: 'racao_confinamento',
        tamanho_batida_padrao_kg: 2000,
        ativo: true,
        ingredientes: [
          { materia_prima_id: 'mp-milho', nome_ingrediente: 'Milho Moído', porcentagem_inclusao: 60 },
          { materia_prima_id: 'mp-soja', nome_ingrediente: 'Farelo de Soja', porcentagem_inclusao: 30 }
        ]
      });
    }).toThrow('Soma das porcentagens de inclusão deve ser exatamente 100%');

    // 2. Schema Zod criarFormulaRacaoPayloadSchema com .refine():
    // 90% deve falhar no schema
    const parseResult90 = criarFormulaRacaoPayloadSchema.safeParse({
      formula_id: 'formula-zod-90',
      nome_formula: 'Fórmula 90%',
      tipo_raca_destino: 'racao_confinamento',
      tamanho_batida_padrao_kg: 2000,
      ativo: true,
      ingredientes: [
        { materia_prima_id: 'mp-milho', nome_ingrediente: 'Milho Moído', porcentagem_inclusao: 60 },
        { materia_prima_id: 'mp-soja', nome_ingrediente: 'Farelo de Soja', porcentagem_inclusao: 30 }
      ]
    });
    expect(parseResult90.success).toBe(false);

    // 99.9% deve falhar no schema
    const parseResult99 = criarFormulaRacaoPayloadSchema.safeParse({
      formula_id: 'formula-zod-99',
      nome_formula: 'Fórmula 99.9%',
      tipo_raca_destino: 'racao_confinamento',
      tamanho_batida_padrao_kg: 2000,
      ativo: true,
      ingredientes: [
        { materia_prima_id: 'mp-milho', nome_ingrediente: 'Milho Moído', porcentagem_inclusao: 65 },
        { materia_prima_id: 'mp-soja', nome_ingrediente: 'Farelo de Soja', porcentagem_inclusao: 25 },
        { materia_prima_id: 'mp-nucleo', nome_ingrediente: 'Núcleo', porcentagem_inclusao: 7 },
        { materia_prima_id: 'mp-calcario', nome_ingrediente: 'Calcário', porcentagem_inclusao: 2.9 }
      ]
    });
    expect(parseResult99.success).toBe(false);

    // 100.1% deve falhar no schema
    const parseResult1001 = criarFormulaRacaoPayloadSchema.safeParse({
      formula_id: 'formula-zod-1001',
      nome_formula: 'Fórmula 100.1%',
      tipo_raca_destino: 'racao_confinamento',
      tamanho_batida_padrao_kg: 2000,
      ativo: true,
      ingredientes: [
        { materia_prima_id: 'mp-milho', nome_ingrediente: 'Milho Moído', porcentagem_inclusao: 65 },
        { materia_prima_id: 'mp-soja', nome_ingrediente: 'Farelo de Soja', porcentagem_inclusao: 25 },
        { materia_prima_id: 'mp-nucleo', nome_ingrediente: 'Núcleo', porcentagem_inclusao: 7 },
        { materia_prima_id: 'mp-calcario', nome_ingrediente: 'Calcário', porcentagem_inclusao: 3.1 }
      ]
    });
    expect(parseResult1001.success).toBe(false);

    // 100.0% exato deve passar no schema
    const parseResult100 = criarFormulaRacaoPayloadSchema.safeParse({
      formula_id: 'formula-zod-100',
      nome_formula: 'Fórmula 100%',
      tipo_raca_destino: 'racao_confinamento',
      tamanho_batida_padrao_kg: 2000,
      ativo: true,
      ingredientes: [
        { materia_prima_id: 'mp-milho', nome_ingrediente: 'Milho Moído', porcentagem_inclusao: 65 },
        { materia_prima_id: 'mp-soja', nome_ingrediente: 'Farelo de Soja', porcentagem_inclusao: 25 },
        { materia_prima_id: 'mp-nucleo', nome_ingrediente: 'Núcleo', porcentagem_inclusao: 10 }
      ]
    });
    expect(parseResult100.success).toBe(true);

    // 3. Fórmula com soma exata de 100% no Store: deve ser aceita com sucesso
    const envelope = await store.salvarFormula({
      formula_id: 'formula-certa-100',
      nome_formula: 'Ração Confinamento Terminação',
      tipo_raca_destino: 'racao_confinamento',
      tamanho_batida_padrao_kg: 2000,
      ativo: true,
      ingredientes: [
        { materia_prima_id: 'mp-milho', nome_ingrediente: 'Milho Moído', porcentagem_inclusao: 65 },
        { materia_prima_id: 'mp-soja', nome_ingrediente: 'Farelo de Soja', porcentagem_inclusao: 25 },
        { materia_prima_id: 'mp-nucleo', nome_ingrediente: 'Núcleo Confinamento', porcentagem_inclusao: 10 }
      ]
    });

    expect(envelope.command_type).toBe('fabrica.formulas.salvar');
    expect(envelope.aggregate_id).toBe('formula-certa-100');
    expect(store.getState().formulas.some(f => f.formula_id === 'formula-certa-100')).toBe(true);
  });

  it('Q4.3.5: store.iniciarBatida deve alterar estado do misturador para "misturando" e gerar envelope', async () => {
    const envelope = await store.iniciarBatida({
      batida_id: 'bat-2026-test-101',
      ordem_producao_id: 'op-2026-090',
      formula_id: 'formula-conf-alta-energia',
      misturador_id: 'misturador-02',
      quantidade_planejada_kg: 1500,
      operador_id: 'user-fabrica-synthetic',
      iniciado_em: '2026-11-05T08:00:00.000Z'
    });

    expect(envelope.command_type).toBe('fabrica.batidas.iniciar');
    expect(envelope.status).toBe('PENDENTE');

    const state = store.getState();
    const mixer = state.misturadores.find(m => m.misturador_id === 'misturador-02');
    expect(mixer?.status).toBe('misturando');
    expect(mixer?.batida_atual_id).toBe('bat-2026-test-101');

    const batida = state.batidas.find(b => b.batida_id === 'bat-2026-test-101');
    expect(batida?.status).toBe('em_andamento');
  });

  it('Q4.3.6: store.concluirBatida deve liberar misturador, baixar estoque nos silos proporcionalmente e atualizar KPIs', async () => {
    // Registra batida em andamento com a formula existente 'form-terminacao-22' (65% milho)
    await store.iniciarBatida({
      batida_id: 'bat-baixa-01',
      ordem_producao_id: 'op-01',
      formula_id: 'form-terminacao-22',
      misturador_id: 'misturador-02',
      quantidade_planejada_kg: 1000,
      operador_id: 'user-fabrica-synthetic',
      iniciado_em: '2026-11-05T08:00:00.000Z'
    });

    // Estado dos silos antes da conclusão
    const siloMilhoAntes = store.getState().silos.find(s => s.materia_prima_id === 'mp-milho')?.nivel_atual_kg ?? 0;

    // Conclusão de 1000kg (fórmula tem 65% de milho = 650kg de consumo esperado)
    const envelope = await store.concluirBatida({
      batida_id: 'bat-baixa-01',
      quantidade_realizada_kg: 1000,
      tempo_mistura_segundos: 240,
      finalizado_em: '2026-11-05T08:05:00.000Z',
      desvio_peso_kg: 0
    });

    expect(envelope.command_type).toBe('fabrica.batidas.concluir');

    const state = store.getState();
    const mixer = state.misturadores.find(m => m.misturador_id === 'misturador-02');
    expect(mixer?.status).toBe('ocioso');

    const siloMilhoDepois = state.silos.find(s => s.materia_prima_id === 'mp-milho')?.nivel_atual_kg ?? 0;
    expect(siloMilhoDepois).toBe(siloMilhoAntes - 650); // 65% de 1000kg
  });

  it('Q4.3.7: store.calibrarBalanca deve registrar calibração de balança e gerar envelope', async () => {
    const envelope = await store.calibrarBalanca({
      balanca_id: 'balanca-mist-01',
      equipamento_tipo: 'celula_carga_misturador',
      peso_padrao_afericao_kg: 500,
      peso_medido_kg: 501.2,
      desvio_percentual: 0.24,
      calibrado: true,
      proxima_calibracao_data: '2026-12-05T00:00:00.000Z',
      data_calibracao: '2026-11-05T07:30:00.000Z'
    });

    expect(envelope.command_type).toBe('fabrica.balanca.calibrar');
    expect(envelope.aggregate_id).toBe('balanca-mist-01');

    const state = store.getState();
    expect(state.calibracoes.length).toBeGreaterThanOrEqual(1);
    expect(state.calibracoes[0]?.calibrado).toBe(true);
  });

  it('Q4.3.8: validação Zod dos contratos de batida (iniciar e concluir batida)', () => {
    // Iniciar batida válido
    const validIniciar = {
      batida_id: 'bat-zod-01',
      ordem_producao_id: 'op-zod-01',
      formula_id: 'form-01',
      misturador_id: 'mist-01',
      quantidade_planejada_kg: 2000,
      operador_id: 'op-01',
      iniciado_em: '2026-11-05T08:00:00.000Z'
    };
    expect(iniciarBatidaPayloadSchema.safeParse(validIniciar).success).toBe(true);

    // Concluir batida com tempo menor que 30s deve falhar
    const invalidMixTime = {
      batida_id: 'bat-zod-01',
      quantidade_realizada_kg: 2000,
      tempo_mistura_segundos: 15, // inválido (< 30s)
      finalizado_em: '2026-11-05T08:01:00.000Z',
      desvio_peso_kg: 0
    };
    expect(concluirBatidaPayloadSchema.safeParse(invalidMixTime).success).toBe(false);

    // Concluir batida válido
    const validConcluir = { ...invalidMixTime, tempo_mistura_segundos: 180 };
    expect(concluirBatidaPayloadSchema.safeParse(validConcluir).success).toBe(true);
  });

  it('Q4.3.9: AST Guard — apps/fazenda/fabrica/src deve ter ZERO violações de literais JSX', () => {
    const fabricaSrcDir = resolve(import.meta.dir, '../../apps/fazenda/fabrica/src');
    const files = findTsxFiles(fabricaSrcDir);
    expect(files.length).toBeGreaterThanOrEqual(6);

    const violations = scanAstLiterals(files);
    if (violations.length > 0) {
      console.error(`[AST GUARD FAIL] ${violations.length} literais detectados em fabrica/src:`, violations);
    }
    expect(violations).toEqual([]);
  });
});
