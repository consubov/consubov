import { describe, expect, it } from 'bun:test';
import type { AtomicCommandEnvelope, LocalSnapshot, ModuleExecutionContext, ModuleLocalDataAPI } from '@consubov/contracts';
import { applyModuleCommand, DomainProjectionError, getProjectionVersion, SUPPORTED_COMMANDS, toModuleSnapshot, type FarmModuleId } from '../src';
import { INITIAL_MODULE_STATES } from '../../../api/src/fixtures/initial-module-states';
import { GerenteStore } from '../../../apps/fazenda/gerente/src/store/gerenteStore';
import { FabricaStore } from '../../../apps/fazenda/fabrica/src/store/fabricaStore';
import { EscritorioStore } from '../../../apps/fazenda/escritorio/src/store/escritorioStore';
import { CapatazStore } from '../../../apps/fazenda/capataz/src/store/capatazStore';

const now = '2026-11-05T12:00:00.000Z';
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
function envelope(profile: FarmModuleId, commandType: string, aggregateType: string, aggregateId: string, payload: Record<string, unknown>): AtomicCommandEnvelope {
  return {
    command_id: 'test-command', idempotency_key: 'test-idempotency', correlation_id: 'test-correlation',
    user_id: 'user', tenant_id: 'tenant', product_id: 'consubov', fazenda_id: 'farm', retiro_id: null,
    device_id: 'device', profile_id: profile, schema_version: 1, command_type: commandType,
    aggregate_type: aggregateType, aggregate_id: aggregateId, base_version: 0, payload,
    occurred_at_local: now, status: 'PENDENTE', attempts: 0, last_attempt_at: null, error_message: null, attachment_refs: []
  };
}

// This adapter exercises reducers/store transactions, not browser durability.
function runtime(profile: FarmModuleId) {
  const context: ModuleExecutionContext = { userId: 'user', tenantId: 'tenant', farmId: 'farm', retreatId: null, moduleId: profile, profileId: profile, deviceId: 'device', productId: 'consubov' };
  const seed = structuredClone(INITIAL_MODULE_STATES[profile]!);
  let snapshot: LocalSnapshot = { aggregateType: 'module-state', aggregateId: 'bootstrap', version: 0, data: toModuleSnapshot(seed, profile), modifiedAt: now };
  let revision = 0;
  const pending: AtomicCommandEnvelope[] = [];
  const attachments = new Map<string, { ref: AtomicCommandEnvelope['attachment_refs'][number]; blob: Blob }>();
  const api: ModuleLocalDataAPI = {
    readSnapshot: async <T,>() => snapshot as LocalSnapshot<T>, listSnapshots: async <T,>() => [snapshot as LocalSnapshot<T>],
    commitMutation: async mutation => {
      if (mutation.expectedModuleRevision !== revision) throw new Error('Estado local desatualizado');
      revision += 1; snapshot = mutation.snapshot; pending.push(mutation.command as AtomicCommandEnvelope);
      for (const attachment of mutation.attachments) attachments.set(attachment.ref.attachment_id, attachment);
      return { commandId: mutation.command.command_id, committed: true };
    },
    readAttachment: async id => attachments.get(id) ?? null,
    listPendingCommands: async limit => pending.slice(0, limit).map(command => ({ command, attachmentRefs: command.attachment_refs })),
    getCursor: async () => null, getSchemaVersion: async () => 1
  };
  return { context, api };
}
type Store = { ready: Promise<void>; getState(): object; refreshFromLocalData(): Promise<void> };
async function parity(profile: FarmModuleId, store: Store, invoke: () => Promise<AtomicCommandEnvelope | { envelope: AtomicCommandEnvelope }>) {
  const before = structuredClone(store.getState());
  const untouched = structuredClone(before);
  const result = await invoke();
  const command = 'envelope' in result ? result.envelope : result;
  const server = applyModuleCommand(profile, before, command);
  expect(before).toEqual(untouched);
  expect(json(toModuleSnapshot(store.getState(), profile))).toEqual(json(toModuleSnapshot(server, profile)));
  expect(getProjectionVersion(server, profile, command.aggregate_id)).toBe(command.base_version + 1);
  await store.refreshFromLocalData();
  expect(json(toModuleSnapshot(store.getState(), profile))).toEqual(json(toModuleSnapshot(server, profile)));
  return command;
}

describe('shared domain projection parity with browser-store mutation entrypoints', () => {
  it('reuses all five Gerente mutations and preserves costs/audit semantics', async () => {
    const rt = runtime('gerente'); const store = new GerenteStore(rt.context, rt.api); await store.ready;
    await parity('gerente', store, () => store.definirMetas({ lote_id: 'lote-recria-01', gmd_alvo_kg_dia: 1.8, peso_final_alvo_kg: 550, data_alvo_abate: now }));
    expect(store.getState().kpis.gmdMeta).toBe(1.8);
    await parity('gerente', store, () => store.ajustarDieta({ lote_id: 'lote-recria-01', produto_id: 'prod', nova_meta_consumo_g_cab_dia: 800, periodo_inicio: now, motivo_ajuste: 'Ajuste autorizado' }));
    await parity('gerente', store, () => store.transferirPasto({ lote_id: 'lote-recria-01', pasto_origem_id: 'pasto-01', pasto_destino_id: 'pasto-02', quantidade_animais: 5, motivo_movimentacao: 'rotacionamento', data_movimentacao: now, responsavel_nome: 'Operador' }));
    await parity('gerente', store, () => store.apropriarCustos({ lote_id: 'lote-recria-01', periodo_mes: 11, periodo_ano: 2026, valor_total_apropriado: 200, itens_apropriacao: [{ centro_custo: 'Racao', valor: 150 }, { centro_custo: 'Outros', valor: 50 }], data_apropriacao: now }));
    expect(store.getState().custos.map(item => item.percentual)).toEqual([75, 25]);
    await parity('gerente', store, () => store.aprovarLeituraCocho({ leitura_cocho_id: 'leitura-01', pasto_id: 'pasto-01', status_aprovacao: 'aprovado', escore_revisado: 0, novo_fornecimento_sacos: 0, aprovado_em: now }));
  });

  it('reuses all six Fabrica mutations including proportional silo consumption', async () => {
    const rt = runtime('fabrica'); const store = new FabricaStore(rt.context, rt.api); await store.ready;
    await parity('fabrica', store, () => store.salvarFormula({ formula_id: 'formula-parity', nome_formula: 'Formula teste', tipo_raca_destino: 'racao_confinamento', ingredientes: [{ materia_prima_id: 'mp-milho', nome_ingrediente: 'Milho', porcentagem_inclusao: 100 }], tamanho_batida_padrao_kg: 100, ativo: true }));
    await parity('fabrica', store, () => store.iniciarBatida({ batida_id: 'batch-parity', ordem_producao_id: 'ordem', formula_id: 'formula-parity', misturador_id: 'mist-01', quantidade_planejada_kg: 100, operador_id: 'operador', iniciado_em: now }));
    await parity('fabrica', store, () => store.concluirBatida({ batida_id: 'batch-parity', quantidade_realizada_kg: 100, tempo_mistura_segundos: 60, finalizado_em: now, desvio_peso_kg: 0 }));
    expect(store.getState().kpis.producaoHojeKg).toBe(12600);
    await parity('fabrica', store, () => store.ajustarEstoque({ materia_prima_id: 'mp-milho', silo_id: 'silo-01', quantidade_ajustada_kg: 1000, quantidade_anterior_kg: 1500, tipo_ajuste: 'inventario_fisico', justificativa: 'Conferencia inventario', ajustado_em: now }));
    await parity('fabrica', store, () => store.receberMateriaPrima({ recebimento_id: 'rec-parity', materia_prima_id: 'mp-milho', silo_destino_id: 'silo-01', quantidade_kg: 100, lote_fornecedor: 'lote', recebido_em: now }));
    expect(store.getState().silos.find(silo => silo.silo_id === 'silo-01')?.nivel_atual_kg).toBe(1100);
    await parity('fabrica', store, () => store.calibrarBalanca({ balanca_id: 'balanca-misturador-01', equipamento_tipo: 'celula_carga_misturador', peso_padrao_afericao_kg: 100, peso_medido_kg: 100, desvio_percentual: 0, calibrado: true, proxima_calibracao_data: now, data_calibracao: now }));
  });

  it('reuses all six Escritorio operations with stable partition identities and no fabricated report', async () => {
    const rt = runtime('escritorio'); const store = new EscritorioStore(rt.context, rt.api); await store.ready;
    await parity('escritorio', store, () => store.registrarNotaFiscal({ nota_fiscal_id: 'nf-parity', numero_nf: '1', serie: '1', chave_acesso_nfe: '1'.repeat(44), fornecedor_cnpj_cpf: '12345678901', fornecedor_nome: 'Fornecedor', valor_total_brl: 10, data_emissao: now, itens: [{ produto_descricao: 'Produto', quantidade: 1, unidade_medida: 'kg', valor_unitario_brl: 10, valor_total_item_brl: 10 }] }));
    await parity('escritorio', store, () => store.criarPedidoCompra({ pedido_compra_id: 'pedido-parity', fornecedor_id: 'fornecedor', produto_insumo_id: 'produto', quantidade_pedida: 10, unidade: 'kg', preco_unitario_brl: 10, condicao_pagamento: 'a_vista', previsao_entrega: now }));
    await parity('escritorio', store, () => store.cadastrarLote({ lote_id: 'lote-parity', fazenda_id: 'farm', pasto_id: 'pasto-01', nome_lote: 'Lote teste', categoria_animal: 'garrote', quantidade_cabecas: 20, peso_medio_inicial_kg: 300, data_entrada: now }));
    const partition = await parity('escritorio', store, () => store.particionarLote({ lote_origem_id: 'lote-parity', novos_lotes: [{ nome_lote: 'Lote filho', pasto_destino_id: 'pasto-02', quantidade_cabecas: 10, peso_medio_kg: 300 }], data_particao: now }));
    expect(store.getState().lotes.at(-1)?.lote_id).toBe(`lote-part-${partition.command_id}-0`);
    await parity('escritorio', store, () => store.fecharCustoLote({ lote_id: 'lote-parity', periodo_mes: 11, periodo_ano: 2026, custo_nutricao_brl: 10, custo_sanidade_brl: 0, custo_pastagem_brl: 0, custo_operacional_brl: 0, valor_total_apropriado_brl: 10, fechado_em: now }));
    const beforeReport = store.getState().notasFiscais.length;
    await parity('escritorio', store, () => store.emitirRelatorio({ relatorio_id: 'report-parity', tipo_relatorio: 'dre_fazenda', data_inicio: now, data_fim: now, incluir_projecoes: false, formato_exportacao: 'json' }));
    expect(store.getState().notasFiscais.length).toBe(beforeReport);
    expect('relatorios' in store.getState()).toBe(false);
  });

  it('reuses four Capataz mutations including durable QR justification and photo metadata', async () => {
    const rt = runtime('capataz'); const store = new CapatazStore(rt.context, rt.api); await store.ready;
    try {
      const cocho = await parity('capataz', store, () => store.registrarLeituraCocho({ pasto_id: 'pasto-01', produto_id: 'prod-sal-mineral-80', escore_cocho: 4, sacos_fornecidos: 3 }));
      expect(store.getState().leiturasCocho[0]?.leitura_id).toBe(`leit-${cocho.command_id}`);
      expect(store.getState().pastos[0]?.status_cocho).toBe('com_sobra');
      await parity('capataz', store, () => store.registrarLeituraQrPasto({ pasto_id: 'pasto-01', altura_media_cm: 45, qr_code_lido: 'PASTO-01-MOMBACA-SEDE', justificativa_falha_qr: 'Etiqueta desgastada' }));
      expect(store.getState().leiturasQr[0]?.justificativa_falha_qr).toBe('Etiqueta desgastada');
      await parity('capataz', store, () => store.registrarContagemRebanho({ pasto_id: 'pasto-01', lote_id: 'lote-recria-01', quantidade_cabecas: 30 }));
      expect(store.getState().lotes[0]?.quantidade_cabecas).toBe(30);
      await parity('capataz', store, () => store.anexarFotoCocho({ attachment_id: 'photo-parity', blob: new Blob(['synthetic-photo'], { type: 'image/jpeg' }), dataUrl: '', originalSizeBytes: 20, compressedSizeBytes: 15, width: 10, height: 10, compressionRatioPct: 25, mimeType: 'image/jpeg', pastoId: 'pasto-01', createdAt: now }));
      expect(store.getState().fotos['photo-parity']?.width).toBe(10);
    } finally { store.destroy(); }
  });

  it('matches version seeds and explicitly rejects unsupported aliases without mutation', () => {
    const seed = structuredClone(INITIAL_MODULE_STATES.capataz!);
    expect(getProjectionVersion(seed, 'capataz', 'unknown')).toBe(1);
    expect(getProjectionVersion(INITIAL_MODULE_STATES.gerente!, 'gerente', 'unknown')).toBe(0);
    for (const unsupported of ['pesagem_animal', 'movimentacao_lote', 'criar_lote', 'registrar_batida', 'fabrica.ingrediente.dar_baixa']) expect(SUPPORTED_COMMANDS).not.toContain(unsupported);
    expect(() => applyModuleCommand('capataz', seed, { command_type: 'pesagem_animal' } as AtomicCommandEnvelope)).toThrow(DomainProjectionError);
    expect(seed).toEqual(INITIAL_MODULE_STATES.capataz!);
  });

  it('rejects invalid payloads, mismatched aggregates and incomplete photos before mutating a seed', () => {
    const state = structuredClone(INITIAL_MODULE_STATES.gerente!);
    const original = structuredClone(state);
    const command = envelope('gerente', 'gerente.metas.definir', 'lote', 'lote-recria-01', {
      lote_id: 'lote-recria-01', gmd_alvo_kg_dia: -1, peso_final_alvo_kg: 500, data_alvo_abate: now
    });
    expect(() => applyModuleCommand('gerente', state, command)).toThrow('Payload de domínio inválido');
    command.payload.gmd_alvo_kg_dia = 1;
    command.aggregate_id = 'another-lote';
    expect(() => applyModuleCommand('gerente', state, command)).toThrow('O agregado diverge');
    expect(state).toEqual(original);
    const photo = envelope('capataz', 'capataz.cocho.foto_adicionar', 'cocho', 'pasto-01', {
      pasto_id: 'pasto-01', foto_attachment_id: 'photo', tipo_registro: 'auditoria', registrado_em: now
    });
    expect(() => applyModuleCommand('capataz', INITIAL_MODULE_STATES.capataz!, photo)).toThrow('Metadados duráveis da foto ausentes');
  });
});
