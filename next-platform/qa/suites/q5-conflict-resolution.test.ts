import { describe, it, expect, beforeEach } from 'bun:test';
import {
  resolveDomainConflict,
  applyLocalResolution,
  CapatazStore,
  resetCapatazStoresForTesting
} from '../../apps/fazenda/capataz/src';

describe('Q5.5: Resolução de Conflitos Especializada por Domínio SEM Last-Write-Wins (LWW)', () => {
  let store: CapatazStore;

  beforeEach(() => {
    resetCapatazStoresForTesting();
    store = new CapatazStore('consubov:tenant-conflict:user-01:fazenda-01:capataz');
  });

  it('Q5.5.1: Leituras de Cocho devem aplicar Merge Aditivo cronológico sem perda de histórico (Anti-LWW)', () => {
    const { envelope: cmdLeituraLocal } = store.registrarLeituraCocho({
      pasto_id: 'pasto-01',
      produto_id: 'prod-sal-mineral-80',
      escore_cocho: 3,
      sacos_fornecidos: 5
    });

    // Simula que o servidor já possuía uma leitura concorrente registrada mais cedo por outro operador
    const existingServerObservation = {
      pasto_id: 'pasto-01',
      escore_cocho: 1,
      sacos_fornecidos: 2,
      occurred_at_local: '2026-11-05T06:00:00.000Z',
      operador_id: 'user-outro-operador'
    };

    const resolution = resolveDomainConflict(cmdLeituraLocal, {
      statusCode: 409,
      existingObservations: [existingServerObservation]
    });

    // 1. A estratégia DEVE ser ADDITIVE_MERGE
    expect(resolution.strategy).toBe('ADDITIVE_MERGE');
    expect(resolution.resolved).toBe(true);

    // 2. Nenhuma leitura é perdida: ambas coexistem no stream cronológico
    const stream = resolution.mergedPayload.event_stream;
    expect(stream.length).toBe(2);
    expect(stream[0].operador_id).toBe('user-outro-operador');
    expect(stream[0].escore_cocho).toBe(1);
    expect(stream[1].escore_cocho).toBe(3);

    // 3. Trilhas de auditoria comprovam o merge aditivo
    expect(resolution.auditTrail.action).toBe('ADDITIVE_MERGE_APPLIED');
    expect(resolution.auditTrail.details).toContain('Preservadas 2 observações de cocho');
  });

  it('Q5.5.2: Mutações físicas de lotes ou estoque com versão defasada devem retornar OCC 409 e reter para decisão explícita', () => {
    // Simula comando de movimentação/ajuste que exige OCC estrito
    const fakeOccCommand: any = {
      command_id: 'cmd-occ-lote-divergente',
      idempotency_key: 'idemp-occ-lote-divergente-12345',
      command_type: 'gerente.lote.transferir_pasto',
      base_version: 1,
      payload: { lote_id: 'lote-01', pasto_origem_id: 'pasto-01', pasto_destino_id: 'pasto-02' }
    };

    const resolution = resolveDomainConflict(fakeOccCommand, {
      statusCode: 409,
      serverAggregateVersion: 3,
      message: 'Versão do agregado defasada: esperada versão 3, informada 1.'
    });

    // 1. A estratégia DEVE ser OCC_CONFLICT_REVIEW (NÃO pode ser LWW)
    expect(resolution.strategy).toBe('OCC_CONFLICT_REVIEW');
    expect(resolution.resolved).toBe(false);
    expect(resolution.message).toContain('OCC 409');
    expect(resolution.message).toContain('diverge da versão atual do servidor');
    expect(resolution.auditTrail.action).toBe('OCC_CONFLICT_DETECTED');
  });

  it('Q5.5.3: deve permitir resolução explícita pelo operador ("Manter Local" recalculando base_version)', () => {
    (store as any).state.isLeader = true;

    // Simula um conflito inserido na lista de conflitos do store
    const conflictingCommand: any = {
      command_id: 'cmd-lote-conflito-1',
      idempotency_key: 'idemp-lote-conflito-1',
      command_type: 'gerente.lote.transferir_pasto',
      base_version: 1,
      payload: { lote_id: 'lote-01', quantidade: 50 }
    };

    (store as any).state.conflitos.push({
      command: conflictingCommand,
      detectedAt: new Date().toISOString(),
      reason: 'Conflito de concorrência detectado (409)',
      serverVersion: 2
    });

    expect(store.getState().conflitos.length).toBe(1);

    // Operador decide MANTER A VERSÃO LOCAL
    store.resolverConflito('cmd-lote-conflito-1', 'manter_local');

    // O comando é removido da lista de conflitos
    expect(store.getState().conflitos.length).toBe(0);

    // E é re-enfileirado na outbox com base_version recalculada (servidor + 1 = 3)
    const reQueued = store.getState().outbox.find(c => c.command_id === 'cmd-lote-conflito-1');
    expect(reQueued).toBeDefined();
    expect(reQueued!.base_version).toBe(3);
    expect(reQueued!.idempotency_key).toContain('recalc');
  });

  it('Q5.5.4: deve permitir resolução explícita pelo operador ("Aceitar Servidor" descartando a mutação local)', () => {
    (store as any).state.isLeader = true;

    const conflictingCommand: any = {
      command_id: 'cmd-lote-conflito-2',
      idempotency_key: 'idemp-lote-conflito-2',
      command_type: 'gerente.lote.transferir_pasto',
      base_version: 1,
      payload: { lote_id: 'lote-02' }
    };

    (store as any).state.conflitos.push({
      command: conflictingCommand,
      detectedAt: new Date().toISOString(),
      reason: 'Conflito de concorrência detectado (409)',
      serverVersion: 4
    });

    expect(store.getState().conflitos.length).toBe(1);

    // Operador decide ACEITAR O SERVIDOR (descartando a mutação local conflitante)
    store.resolverConflito('cmd-lote-conflito-2', 'aceitar_servidor');

    // O conflito é removido e NÃO é re-adicionado à outbox
    expect(store.getState().conflitos.length).toBe(0);
    const inOutbox = store.getState().outbox.find(c => c.command_id === 'cmd-lote-conflito-2');
    expect(inOutbox).toBeUndefined();
  });
});
