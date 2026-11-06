import { IndexedDbLocalData } from '../../../../../packages/local-data/src';
import { globalQuiescenceRegistry, type QuiescenceRegistry } from '@consubov/module-release';
import type { LocalMutation, ModuleExecutionContext, ModuleAccountPartition } from '@consubov/contracts';

/** Locks the real host operation, including opening/upgrading a database and final transaction completion. */
export class QuiescentLocalData extends IndexedDbLocalData {
  constructor(partition: ModuleAccountPartition, isContextActive?: () => boolean, private readonly registry: QuiescenceRegistry = globalQuiescenceRegistry) {
    super(partition, isContextActive);
  }

  private async guarded<T>(operation: () => Promise<T>): Promise<T> {
    const release = this.registry.acquireLock(crypto.randomUUID(), 'LOCAL_DB_TRANSACTION');
    try { return await operation(); } finally { release(); }
  }

  override readSnapshot<T>(context: ModuleExecutionContext, aggregateType: string, aggregateId: string) {
    return this.guarded(() => super.readSnapshot<T>(context, aggregateType, aggregateId));
  }
  override commitMutation<T>(context: ModuleExecutionContext, mutation: LocalMutation<T>) {
    return this.guarded(() => super.commitMutation<T>(context, mutation));
  }
  override provisionInitialSnapshot(...args: Parameters<IndexedDbLocalData['provisionInitialSnapshot']>) {
    return this.guarded(() => super.provisionInitialSnapshot(...args));
  }
  override listSnapshots(...args: Parameters<IndexedDbLocalData['listSnapshots']>) {
    return this.guarded(() => super.listSnapshots(...args));
  }
  override readAttachment(...args: Parameters<IndexedDbLocalData['readAttachment']>) {
    return this.guarded(() => super.readAttachment(...args));
  }
  override listPendingCommands(...args: Parameters<IndexedDbLocalData['listPendingCommands']>) {
    return this.guarded(() => super.listPendingCommands(...args));
  }
  override listOperationIssues(...args: Parameters<IndexedDbLocalData['listOperationIssues']>) {
    return this.guarded(() => super.listOperationIssues(...args));
  }
  override applyCommandResponse(...args: Parameters<IndexedDbLocalData['applyCommandResponse']>) {
    return this.guarded(() => super.applyCommandResponse(...args));
  }
  override commitPull(...args: Parameters<IndexedDbLocalData['commitPull']>) {
    return this.guarded(() => super.commitPull(...args));
  }
  override getCursor(...args: Parameters<IndexedDbLocalData['getCursor']>) {
    return this.guarded(() => super.getCursor(...args));
  }
  override getSchemaVersion(...args: Parameters<IndexedDbLocalData['getSchemaVersion']>) {
    return this.guarded(() => super.getSchemaVersion(...args));
  }
}
