import { describe, it, expect, beforeEach } from 'bun:test';
import { QuiescenceRegistry } from '@consubov/module-release';
import { UpdateCoordinator } from '../../apps/fazenda/shell/src/pwa/UpdateCoordinator';

// Helper mock para ServiceWorker e Registration em ambiente hermético
function createMockServiceWorker() {
  const sentMessages: any[] = [];
  return {
    state: 'installed' as ServiceWorkerState,
    scriptURL: '/sw.js',
    postMessage: (message: any) => {
      sentMessages.push(message);
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    onerror: null,
    onstatechange: null,
    _sentMessages: sentMessages
  } as unknown as ServiceWorker & { _sentMessages: any[] };
}

function createMockRegistration(waitingWorker?: ServiceWorker | null) {
  return {
    installing: null,
    waiting: waitingWorker ?? null,
    active: null,
    scope: '/',
    update: async () => {},
    unregister: async () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    onupdatefound: null
  } as unknown as ServiceWorkerRegistration;
}

describe('Gate Q7.3: Safe Activation & Update Coordinator with Quiescence (q7-safe-activation)', () => {
  let registry: QuiescenceRegistry;

  beforeEach(() => {
    registry = new QuiescenceRegistry();
  });

  it('Q7.3.1: Se o sistema já estiver quiescente, envia SKIP_WAITING imediatamente ao worker', async () => {
    const mockWorker = createMockServiceWorker();
    const mockReg = createMockRegistration(mockWorker);

    let updateAvailableCalled = false;

    const coordinator = new UpdateCoordinator({
      quiescenceRegistry: registry,
      autoReloadOnQuiescent: false,
      onUpdateAvailable: () => {
        updateAvailableCalled = true;
      }
    });

    coordinator.initialize(mockReg);

    // Aguarda microtask
    await new Promise((r) => setTimeout(r, 10));

    expect(updateAvailableCalled).toBe(true);
    expect(mockWorker._sentMessages).toHaveLength(1);
    expect(mockWorker._sentMessages[0]).toEqual({ type: 'SKIP_WAITING' });
    expect(coordinator.isHoldingForQuiescence()).toBe(false);

    coordinator.destroy();
  });

  it('Q7.3.2: Retém ativação sob trava FORM_DIRTY até que a trava seja liberada', async () => {
    // 1. Adquire trava de formulário sujo antes da detecção
    const releaseForm = registry.acquireLock('form-piquete-99', 'FORM_DIRTY', { loteId: 'lote-99' });

    const mockWorker = createMockServiceWorker();
    const mockReg = createMockRegistration(mockWorker);

    let waitingQuiescenceCalled = false;
    let locksReceived: any[] = [];

    const coordinator = new UpdateCoordinator({
      quiescenceRegistry: registry,
      autoReloadOnQuiescent: false,
      onWaitingForQuiescence: (locks) => {
        waitingQuiescenceCalled = true;
        locksReceived = [...locks];
      }
    });

    coordinator.initialize(mockReg);

    // Dá tempo para processar
    await new Promise((r) => setTimeout(r, 20));

    // Deve estar RETIDA aguardando ponto de quiescência
    expect(coordinator.isHoldingForQuiescence()).toBe(true);
    expect(waitingQuiescenceCalled).toBe(true);
    expect(locksReceived).toHaveLength(1);
    expect(locksReceived[0]?.type).toBe('FORM_DIRTY');

    // Nenhuma mensagem SKIP_WAITING deve ter sido enviada ainda
    expect(mockWorker._sentMessages).toHaveLength(0);

    // 2. Operador salva o formulário: trava é liberada
    releaseForm();

    // Aguarda resolução da quiescência
    await new Promise((r) => setTimeout(r, 30));

    // Agora sim, a atualização deve ter sido liberada e SKIP_WAITING enviado
    expect(coordinator.isHoldingForQuiescence()).toBe(false);
    expect(mockWorker._sentMessages).toHaveLength(1);
    expect(mockWorker._sentMessages[0]).toEqual({ type: 'SKIP_WAITING' });

    coordinator.destroy();
  });

  it('Q7.3.3: Retém ativação sob trava CAMERA_ACTIVE (compressão/captura de fotos de cocho)', async () => {
    const releaseCamera = registry.acquireLock('cam-cocho-03', 'CAMERA_ACTIVE');

    const mockWorker = createMockServiceWorker();
    const mockReg = createMockRegistration(mockWorker);

    const coordinator = new UpdateCoordinator({
      quiescenceRegistry: registry,
      autoReloadOnQuiescent: false
    });

    coordinator.initialize(mockReg);
    await new Promise((r) => setTimeout(r, 20));

    expect(coordinator.isHoldingForQuiescence()).toBe(true);
    expect(mockWorker._sentMessages).toHaveLength(0);

    // Câmera é fechada
    releaseCamera();
    await new Promise((r) => setTimeout(r, 30));

    expect(coordinator.isHoldingForQuiescence()).toBe(false);
    expect(mockWorker._sentMessages).toHaveLength(1);
    expect(mockWorker._sentMessages[0]).toEqual({ type: 'SKIP_WAITING' });

    coordinator.destroy();
  });

  it('Q7.3.4: Retém ativação sob trava OUTBOX_SYNCING (envio de dados para API)', async () => {
    const releaseSync = registry.acquireLock('outbox-sync', 'OUTBOX_SYNCING');

    const mockWorker = createMockServiceWorker();
    const mockReg = createMockRegistration(mockWorker);

    const coordinator = new UpdateCoordinator({
      quiescenceRegistry: registry,
      autoReloadOnQuiescent: false
    });

    coordinator.initialize(mockReg);
    await new Promise((r) => setTimeout(r, 20));

    expect(mockWorker._sentMessages).toHaveLength(0);

    releaseSync();
    await new Promise((r) => setTimeout(r, 30));

    expect(mockWorker._sentMessages).toHaveLength(1);

    coordinator.destroy();
  });

  it('Q7.3.5: Intercepta novo worker no ciclo onupdatefound -> installing -> installed', async () => {
    const mockWorker = createMockServiceWorker();
    // Inicia no estado installing
    (mockWorker as any).state = 'installing';

    const mockReg = createMockRegistration(null);
    (mockReg as any).installing = mockWorker;

    const coordinator = new UpdateCoordinator({
      quiescenceRegistry: registry,
      autoReloadOnQuiescent: false
    });

    coordinator.initialize(mockReg);

    // Dispara evento onupdatefound
    expect(typeof (mockReg as any).onupdatefound).toBe('function');
    (mockReg as any).onupdatefound();

    // Simula conclusão do download em segundo plano
    (mockWorker as any).state = 'installed';
    (mockReg as any).waiting = mockWorker;

    if (typeof (mockWorker as any).onstatechange === 'function') {
      (mockWorker as any).onstatechange();
    }

    await new Promise((r) => setTimeout(r, 20));

    // Como estava quiescente, envia SKIP_WAITING
    expect(mockWorker._sentMessages).toHaveLength(1);
    expect(mockWorker._sentMessages[0]).toEqual({ type: 'SKIP_WAITING' });

    coordinator.destroy();
  });
});
