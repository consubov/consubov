import { describe, it, expect, beforeEach } from 'bun:test';
import {
  QuiescenceRegistry,
  CriticalOperationType,
  globalQuiescenceRegistry
} from '@consubov/module-release';

describe('Gate Q7.2: Quiescence Detection with 4 Mandatory Locks (q7-quiescence-detection)', () => {
  let registry: QuiescenceRegistry;

  beforeEach(() => {
    registry = new QuiescenceRegistry();
  });

  it('Q7.2.1: Estado inicial do QuiescenceRegistry deve ser 100% quiescente (isQuiescent === true)', () => {
    expect(registry.isQuiescent()).toBe(true);
    expect(registry.getActiveLocks()).toHaveLength(0);
  });

  it('Q7.2.2: Deve reter quiescência sob a trava mandatória FORM_DIRTY', () => {
    const release = registry.acquireLock('form-lote-123', 'FORM_DIRTY', { formName: 'Edição de Lote 123' });

    expect(registry.isQuiescent()).toBe(false);
    expect(registry.hasLockType('FORM_DIRTY')).toBe(true);
    expect(registry.hasLockType('CAMERA_ACTIVE')).toBe(false);

    const locks = registry.getActiveLocks();
    expect(locks).toHaveLength(1);
    expect(locks[0]?.id).toBe('form-lote-123');
    expect(locks[0]?.type).toBe('FORM_DIRTY');

    release();
    expect(registry.isQuiescent()).toBe(true);
    expect(registry.hasLockType('FORM_DIRTY')).toBe(false);
  });

  it('Q7.2.3: Deve reter quiescência sob a trava mandatória CAMERA_ACTIVE', () => {
    const release = registry.acquireLock('camera-cocho-01', 'CAMERA_ACTIVE', { pastoId: 'pasto-01' });

    expect(registry.isQuiescent()).toBe(false);
    expect(registry.hasLockType('CAMERA_ACTIVE')).toBe(true);

    release();
    expect(registry.isQuiescent()).toBe(true);
  });

  it('Q7.2.4: Deve reter quiescência sob a trava mandatória WEIGHING_ACTIVE', () => {
    const release = registry.acquireLock('pesagem-curral-02', 'WEIGHING_ACTIVE', { brinco: 'BR-98421' });

    expect(registry.isQuiescent()).toBe(false);
    expect(registry.hasLockType('WEIGHING_ACTIVE')).toBe(true);

    release();
    expect(registry.isQuiescent()).toBe(true);
  });

  it('Q7.2.5: Deve reter quiescência sob a trava mandatória OUTBOX_SYNCING', () => {
    const release = registry.acquireLock('sync-outbox-leader', 'OUTBOX_SYNCING', { pendingCount: 42 });

    expect(registry.isQuiescent()).toBe(false);
    expect(registry.hasLockType('OUTBOX_SYNCING')).toBe(true);

    release();
    expect(registry.isQuiescent()).toBe(true);
  });

  it('Q7.2.6: Suporte a travas adicionais QR_SCANNING e LOCAL_DB_TRANSACTION', () => {
    const releaseQr = registry.acquireLock('qr-piquete', 'QR_SCANNING');
    const releaseDb = registry.acquireLock('db-tx-batch', 'LOCAL_DB_TRANSACTION');

    expect(registry.isQuiescent()).toBe(false);
    expect(registry.getActiveLocks()).toHaveLength(2);

    releaseQr();
    expect(registry.isQuiescent()).toBe(false);

    releaseDb();
    expect(registry.isQuiescent()).toBe(true);
  });

  it('Q7.2.7: Múltiplas travas simultâneas exigem liberação total para restabelecer quiescência', () => {
    const r1 = registry.acquireLock('form-1', 'FORM_DIRTY');
    const r2 = registry.acquireLock('cam-1', 'CAMERA_ACTIVE');
    const r3 = registry.acquireLock('weigh-1', 'WEIGHING_ACTIVE');
    const r4 = registry.acquireLock('sync-1', 'OUTBOX_SYNCING');

    expect(registry.isQuiescent()).toBe(false);
    expect(registry.getActiveLocks()).toHaveLength(4);

    r1();
    expect(registry.isQuiescent()).toBe(false);
    r2();
    expect(registry.isQuiescent()).toBe(false);
    r3();
    expect(registry.isQuiescent()).toBe(false);
    r4();
    expect(registry.isQuiescent()).toBe(true);
    expect(registry.getActiveLocks()).toHaveLength(0);
  });

  it('Q7.2.8: subscribe deve notificar listeners nas transições de estado', () => {
    const transitions: boolean[] = [];
    const unsubscribe = registry.subscribe((quiescent) => {
      transitions.push(quiescent);
    });

    const release = registry.acquireLock('lock-a', 'FORM_DIRTY'); // -> false
    release(); // -> true

    expect(transitions).toEqual([false, true]);
    unsubscribe();

    // Não deve notificar após unsubscribe
    registry.acquireLock('lock-b', 'CAMERA_ACTIVE');
    expect(transitions).toEqual([false, true]);
  });

  it('Q7.2.9: whenQuiescent deve aguardar liberação assíncrona', async () => {
    const release = registry.acquireLock('lock-async', 'OUTBOX_SYNCING');

    let resolved = false;
    const quiescencePromise = registry.whenQuiescent(5000).then((res) => {
      resolved = true;
      return res;
    });

    expect(resolved).toBe(false);

    // Libera a trava após 50ms
    setTimeout(() => {
      release();
    }, 50);

    const result = await quiescencePromise;
    expect(result).toBe(true);
    expect(resolved).toBe(true);
    expect(registry.isQuiescent()).toBe(true);
  });

  it('Q7.2.10: whenQuiescent retorna false se estourar o timeout configurado', async () => {
    registry.acquireLock('never-released', 'FORM_DIRTY');

    const result = await registry.whenQuiescent(50);
    expect(result).toBe(false);
  });

  it('Q7.2.11: clearAllLocks deve expurgar todas as travas e restabelecer quiescência', () => {
    registry.acquireLock('l1', 'CAMERA_ACTIVE');
    registry.acquireLock('l2', 'FORM_DIRTY');
    expect(registry.isQuiescent()).toBe(false);

    registry.clearAllLocks();
    expect(registry.isQuiescent()).toBe(true);
    expect(registry.getActiveLocks()).toHaveLength(0);
  });

  it('Q7.2.12: Instância singleton globalQuiescenceRegistry deve estar disponível', () => {
    expect(globalQuiescenceRegistry).toBeDefined();
    expect(typeof globalQuiescenceRegistry.isQuiescent).toBe('function');
  });
});
