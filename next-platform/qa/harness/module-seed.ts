import type { FazendaModuleId, LocalSnapshot } from '@consubov/contracts';
import { INITIAL_MODULE_STATES } from '../../api/src/fixtures/initial-module-states';

/** Test-only stand-in for the account-authorized API provisioning response. */
export function moduleSeedSnapshot(moduleId: FazendaModuleId): LocalSnapshot {
  const state = structuredClone(INITIAL_MODULE_STATES[moduleId]!);
  return {
    aggregateType: 'module-state', aggregateId: 'bootstrap', version: 0,
    data: moduleId === 'escritorio' ? { schema: 'escritorio-state-v1', revision: 0, state } : state,
    modifiedAt: new Date().toISOString()
  };
}
