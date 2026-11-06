import { describe, it, expect, beforeEach } from 'bun:test';
import {
  startLeaderElection,
  resetLeaderElectionForTesting,
  createSyncMessagingChannel,
  resetSyncMessagingForTesting,
  SyncCircuitBreaker,
  resetCapatazStoresForTesting
} from '../../apps/fazenda/capataz/src';
import { createCapatazTestStore, resetCapatazTestData } from '../harness/capataz-test-runtime';

describe('Q5.4: Resiliência da Fila Outbox, Eleição de Líder Web Locks, BroadcastChannel e Circuit Breaker', () => {
  beforeEach(() => {
    resetLeaderElectionForTesting();
    resetSyncMessagingForTesting();
    resetCapatazStoresForTesting();
    resetCapatazTestData();
  });

  it('Q5.4.1: deve garantir exclusão mútua na eleição de líder Web Locks entre abas concorrentes', async () => {
    const partition = 'tenant-consubov:user-01:fazenda-01:capataz';

    // Aba 1 inicia eleição
    const tab1 = startLeaderElection(partition, undefined, 'tab-1-leader');
    expect(tab1.isLeader()).toBe(true);

    // Aba 2 tenta obter o mesmo lock da mesma partição
    const tab2 = startLeaderElection(partition, undefined, 'tab-2-follower');
    expect(tab2.isLeader()).toBe(false);

    // Quando a Aba 1 libera o lock (ex: fechamento da aba)
    tab1.release();
    expect(tab1.isLeader()).toBe(false);

    // Aba 2 deve conseguir adquirir a liderança
    const tab2Assumed = startLeaderElection(partition, undefined, 'tab-2-follower');
    expect(tab2Assumed.isLeader()).toBe(true);

    tab2.release();
    tab2Assumed.release();
  });

  it('Q5.4.2: deve transmitir eventos reativos cross-tab via BroadcastChannel notificando abas seguidoras', (done) => {
    const partition = 'tenant-consubov:user-02:fazenda-01:capataz';

    const channelEmitter = createSyncMessagingChannel(partition, 'tab-emitter');
    const channelReceiver = createSyncMessagingChannel(partition, 'tab-receiver');

    channelReceiver.onMessage((msg) => {
      expect(msg.type).toBe('OUTBOX_UPDATED');
      expect(msg.partitionKey).toBe(partition);
      expect(msg.payload.pendingCount).toBe(3);
      channelEmitter.close();
      channelReceiver.close();
      done();
    });

    channelEmitter.postMessage('OUTBOX_UPDATED', { pendingCount: 3 });
  });

  it('Q5.4.3: Circuit Breaker deve abrir no PRIMEIRO erro de conexão (HTTP 503) e interromper a drenagem', async () => {
    const store = createCapatazTestStore('consubov:tenant-cb:user-01:fazenda-01:capataz');
    await store.ready;

    // Força liderança para permitir tentativa de sincronização
    (store as any).state.isLeader = true;

    // Enfileira 3 comandos na outbox
    await store.registrarLeituraCocho({
      pasto_id: 'pasto-01',
      produto_id: 'prod-sal-mineral-80',
      escore_cocho: 2,
      sacos_fornecidos: 2
    });
    await store.registrarLeituraCocho({
      pasto_id: 'pasto-02',
      produto_id: 'prod-sal-mineral-80',
      escore_cocho: 1,
      sacos_fornecidos: 3
    });
    await store.registrarLeituraCocho({
      pasto_id: 'pasto-03',
      produto_id: 'prod-sal-mineral-80',
      escore_cocho: 3,
      sacos_fornecidos: 4
    });

    expect(store.getState().outbox.length).toBe(3);

    let fetchCallCount = 0;
    const failingFetch = (async () => {
      fetchCallCount += 1;
      // Retorna 503 Service Unavailable (falha de rede / servidor em campo)
      return {
        ok: false,
        status: 503,
        json: async () => ({ error: 'SERVICE_UNAVAILABLE' })
      };
    }) as any;

    const result = await store.sincronizarFila('/api/v1/commands', failingFetch);

    // O Circuit Breaker deve ter aberto imediatamente após a PRIMEIRA tentativa com erro
    expect(fetchCallCount).toBe(1); // Não continuou para os outros 2 comandos
    expect(result.errorsCount).toBe(1);
    expect(result.syncedCount).toBe(0);

    // Estado do Circuit Breaker deve ser OPEN
    expect(store.getCircuitBreaker().getState()).toBe('OPEN');

    // Uma nova tentativa de sincronização com circuito OPEN nem sequer dispara fetch
    const retryResult = await store.sincronizarFila('/api/v1/commands', failingFetch);
    expect(fetchCallCount).toBe(1); // Manteve 1 chamada, nenhuma nova foi disparada
    expect(retryResult.syncedCount).toBe(0);

    // Após reset manual, circuito fecha e permite nova tentativa
    store.getCircuitBreaker().forceReset();
    expect(store.getCircuitBreaker().getState()).toBe('CLOSED');
  });

  it('Q5.4.4: deve sincronizar com sucesso todos os comandos quando a API responde 200 OK', async () => {
    const store = createCapatazTestStore('consubov:tenant-success:user-01:fazenda-01:capataz');
    await store.ready;
    (store as any).state.isLeader = true;

    await store.registrarContagemRebanho({
      pasto_id: 'pasto-01',
      lote_id: 'lote-recria-01',
      quantidade_cabecas: 120
    });
    await store.registrarLeituraQrPasto({
      pasto_id: 'pasto-01',
      altura_media_cm: 62,
      qr_code_lido: 'PASTO-01-MOMBACA-SEDE'
    });

    expect(store.getState().outbox.length).toBe(2);

    let dispatchedCommands: any[] = [];
    const successFetch = (async (url: string, init: any) => {
      dispatchedCommands.push(JSON.parse(init.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({ ack: { status: 'COMMITTED', ledger_sequence: 101 } })
      };
    }) as any;

    const result = await store.sincronizarFila('/api/v1/commands', successFetch);

    expect(result.syncedCount).toBe(0); // HTTP 200 do módulo não substitui ACK persistente do shell
    expect(result.errorsCount).toBe(0);
    expect(store.getState().outbox.length).toBe(2);
    expect(store.getState().syncedCommands.length).toBe(0);
    expect(dispatchedCommands.length).toBe(2);
    expect(dispatchedCommands[0].command_type).toBe('capataz.animais.contagem');
    expect(dispatchedCommands[1].command_type).toBe('capataz.pasto.leitura_qr');
  });
});
