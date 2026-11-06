import { useState, useLayoutEffect, useCallback } from 'react';
import {
  QuiescenceRegistry,
  CriticalOperationType,
  QuiescenceLockInfo,
  globalQuiescenceRegistry
} from './registry';

export interface UseQuiescenceResult {
  isQuiescent: boolean;
  activeLocks: ReadonlyArray<QuiescenceLockInfo>;
  hasFormDirty: boolean;
  hasCameraActive: boolean;
  hasWeighingActive: boolean;
  hasSyncing: boolean;
  hasLockType: (type: CriticalOperationType) => boolean;
  acquireLock: (id: string, type: CriticalOperationType, metadata?: Record<string, unknown>) => () => void;
  releaseLock: (id: string) => void;
  whenQuiescent: (timeoutMs?: number) => Promise<boolean>;
}

export function useQuiescence(
  registry: QuiescenceRegistry = globalQuiescenceRegistry
): UseQuiescenceResult {
  const [isQuiescent, setIsQuiescent] = useState<boolean>(() => registry.isQuiescent());
  const [activeLocks, setActiveLocks] = useState<ReadonlyArray<QuiescenceLockInfo>>(() =>
    registry.getActiveLocks()
  );

  useLayoutEffect(() => {
    setIsQuiescent(registry.isQuiescent());
    setActiveLocks(registry.getActiveLocks());

    const unsubscribe = registry.subscribe((quiescent) => {
      setIsQuiescent(quiescent);
      setActiveLocks(registry.getActiveLocks());
    });

    return unsubscribe;
  }, [registry]);

  const acquireLock = useCallback(
    (id: string, type: CriticalOperationType, metadata?: Record<string, unknown>) => {
      return registry.acquireLock(id, type, metadata);
    },
    [registry]
  );

  const releaseLock = useCallback(
    (id: string) => {
      registry.releaseLock(id);
    },
    [registry]
  );

  const hasLockType = useCallback(
    (type: CriticalOperationType) => {
      return registry.hasLockType(type);
    },
    [registry]
  );

  const whenQuiescent = useCallback(
    (timeoutMs?: number) => {
      return registry.whenQuiescent(timeoutMs);
    },
    [registry]
  );

  return {
    isQuiescent,
    activeLocks,
    hasFormDirty: registry.hasLockType('FORM_DIRTY'),
    hasCameraActive: registry.hasLockType('CAMERA_ACTIVE'),
    hasWeighingActive: registry.hasLockType('WEIGHING_ACTIVE'),
    hasSyncing: registry.hasLockType('OUTBOX_SYNCING'),
    hasLockType,
    acquireLock,
    releaseLock,
    whenQuiescent
  };
}

export function useQuiescenceLock(
  id: string,
  type: CriticalOperationType,
  isActive: boolean,
  metadata?: Record<string, unknown>,
  registry: QuiescenceRegistry = globalQuiescenceRegistry
): void {
  useLayoutEffect(() => {
    if (!isActive) return;

    const release = registry.acquireLock(id, type, metadata);
    return () => {
      release();
    };
  }, [id, type, isActive, metadata, registry]);
}
