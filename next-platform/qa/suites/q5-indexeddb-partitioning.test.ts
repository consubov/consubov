import { describe, it, expect, beforeEach } from 'bun:test';
import {
  CapatazStore,
  StorageQuotaExceededError,
  getCapatazStore,
  resetCapatazStoresForTesting
} from '../../apps/fazenda/capataz/src';

describe('Q5.2: Particionamento Estrito de Armazenamento Local por Contexto e Falha de Quota (LF-003)', () => {
  beforeEach(() => {
    resetCapatazStoresForTesting();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('Q5.2.1: deve isolar estritamente outbox e leituras entre dois usuários diferentes no mesmo tenant e fazenda', () => {
    const key1 = 'tenant-alfa:user-joao:fazenda-01:capataz';
    const key2 = 'tenant-alfa:user-maria:fazenda-01:capataz';

    const storeJoao = new CapatazStore(key1);
    const storeMaria = new CapatazStore(key2);

    // João registra leitura no pasto-01
    storeJoao.registrarLeituraCocho({
      pasto_id: 'pasto-01',
      produto_id: 'prod-sal-mineral-80',
      escore_cocho: 1,
      sacos_fornecidos: 3
    });

    // Maria registra leitura no pasto-02
    storeMaria.registrarLeituraCocho({
      pasto_id: 'pasto-02',
      produto_id: 'prod-proteinado-aguas',
      escore_cocho: 3,
      sacos_fornecidos: 5
    });

    const stateJoao = storeJoao.getState();
    const stateMaria = storeMaria.getState();

    // Verificação de isolamento na outbox
    expect(stateJoao.outbox.length).toBe(1);
    expect(stateMaria.outbox.length).toBe(1);

    expect(stateJoao.outbox[0]!.user_id).toBe('user-joao');
    expect(stateJoao.outbox[0]!.payload.pasto_id).toBe('pasto-01');
    expect(stateJoao.outbox[0]!.payload.escore_cocho).toBe(1);

    expect(stateMaria.outbox[0]!.user_id).toBe('user-maria');
    expect(stateMaria.outbox[0]!.payload.pasto_id).toBe('pasto-02');
    expect(stateMaria.outbox[0]!.payload.escore_cocho).toBe(3);

    // Verificação de isolamento no histórico local
    expect(stateJoao.leiturasCocho.length).toBe(1);
    expect(stateJoao.leiturasCocho[0]!.pasto_id).toBe('pasto-01');

    expect(stateMaria.leiturasCocho.length).toBe(1);
    expect(stateMaria.leiturasCocho[0]!.pasto_id).toBe('pasto-02');
  });

  it('Q5.2.2: deve isolar estritamente dados entre tenants distintos (Multi-Tenant Isolation)', () => {
    const keyTenantA = 'tenant-agro-norte:user-pedro:fazenda-01:capataz';
    const keyTenantB = 'tenant-boi-gordo:user-pedro:fazenda-01:capataz';

    const storeTenantA = new CapatazStore(keyTenantA);
    const storeTenantB = new CapatazStore(keyTenantB);

    storeTenantA.registrarContagemRebanho({
      pasto_id: 'pasto-01',
      lote_id: 'lote-recria-01',
      quantidade_cabecas: 150
    });

    expect(storeTenantA.getState().outbox.length).toBe(1);
    expect(storeTenantA.getState().outbox[0]!.tenant_id).toBe('tenant-agro-norte');

    // Tenant B deve permanecer intocado com outbox vazia
    expect(storeTenantB.getState().outbox.length).toBe(0);
    expect(storeTenantB.getState().contagens.length).toBe(0);
  });

  it('Q5.2.3: deve tratar StorageQuotaExceededError sem falso ACK e com erro explícito (LF-003)', () => {
    const key = 'tenant-alfa:user-carlos:fazenda-01:capataz';
    const store = new CapatazStore(key);

    // Injeta falha de quota de disco
    store.injectQuotaFailure(true);

    let errorThrown = false;
    try {
      store.registrarLeituraCocho({
        pasto_id: 'pasto-01',
        produto_id: 'prod-sal-mineral-80',
        escore_cocho: 2,
        sacos_fornecidos: 2
      });
    } catch (err: any) {
      errorThrown = true;
      expect(err).toBeInstanceOf(StorageQuotaExceededError);
      expect(err.message).toContain('quota');
    }

    expect(errorThrown).toBe(true);

    // Comprova que o estado do store registra explicitamente a condição de erro de quota
    const state = store.getState();
    expect(state.quotaExceededError).toBeDefined();
    expect(state.quotaExceededError).toContain('StorageQuotaExceededError');
  });

  it('Q5.2.4: deve persistir e recuperar estado particionado via singleton getCapatazStore', () => {
    const key = 'tenant-omega:user-marcos:fazenda-sul:capataz';
    const storeInst1 = getCapatazStore(key);

    storeInst1.registrarLeituraQrPasto({
      pasto_id: 'pasto-03',
      altura_media_cm: 58,
      qr_code_lido: 'PASTO-03-PIATA-SUL'
    });

    // Reobter a mesma partição retorna o mesmo store com os dados íntegros
    const storeInst2 = getCapatazStore(key);
    expect(storeInst2.getState().outbox.length).toBe(1);
    expect(storeInst2.getState().leiturasQr.length).toBe(1);
    expect(storeInst2.getState().leiturasQr[0]!.altura_media_cm).toBe(58);
  });
});
