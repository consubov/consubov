import type { AtomicCommandEnvelope, AttachmentRef } from '../envelope';
import type { CommandAckResponse, CommandApiResponse } from '../sync/ack';
import type { SyncDeltaItem } from '../sync/pull';
import type { ModuleAccountPartition, ModuleExecutionContext } from './module-protocol';
import type { OperationIssue } from './operation-issues';

export interface LocalSnapshot<T = Record<string, unknown>> {
  aggregateType: string;
  aggregateId: string;
  version: number;
  data: T;
  modifiedAt: string;
}

export interface LocalMutation<T = Record<string, unknown>> {
  /** Required for whole-module snapshots; atomically compared with the durable module revision. */
  expectedModuleRevision?: number;
  command: AtomicCommandEnvelope<T>;
  snapshot: LocalSnapshot;
  attachments: ReadonlyArray<{ ref: AttachmentRef; blob: Blob }>;
}

export interface LocalMutationResult {
  commandId: string;
  committed: true;
}

export interface LocalPendingCommand {
  command: AtomicCommandEnvelope;
  attachmentRefs: readonly AttachmentRef[];
}

export interface LocalPullCommit {
  nextCursor: string;
  deltas: readonly SyncDeltaItem[];
  /** Trusted shell-only binary dependencies; committed atomically with projection/cursor. */
  attachments?: ReadonlyArray<{ ref: AttachmentRef; blob: Blob }>;
}

export interface LocalDataAPI {
  readSnapshot<T = Record<string, unknown>>(
    context: ModuleExecutionContext,
    aggregateType: string,
    aggregateId: string
  ): Promise<LocalSnapshot<T> | null>;

  /** Enumerates snapshots only from the authenticated context's module/account partition. */
  listSnapshots(
    context: ModuleExecutionContext,
    aggregateType?: string
  ): Promise<readonly LocalSnapshot[]>;

  /**
   * Atomically writes the snapshot, command/outbox row, attachment references and Blob values
   * in one IndexedDB readwrite transaction for the context partition. Resolve only after
   * transaction.oncomplete; reject without a success result on quota, blocked schema,
   * request error or transaction abort. Network calls are forbidden inside this transaction.
   */
  commitMutation<T = Record<string, unknown>>(
    context: ModuleExecutionContext,
    mutation: LocalMutation<T>
  ): Promise<LocalMutationResult>;

  readAttachment(
    context: ModuleExecutionContext,
    attachmentId: string
  ): Promise<{ ref: AttachmentRef; blob: Blob } | null>;

  listPendingCommands(
    context: ModuleExecutionContext,
    limit: number
  ): Promise<readonly LocalPendingCommand[]>;

  /** Read-only sanitized failures still joined to this partition's pending commands. */
  listOperationIssues?(
    context: ModuleExecutionContext,
    limit?: number
  ): Promise<readonly OperationIssue[]>;

  /** Apply ACK or conflict state in a short local transaction; preserve unresolved data and blobs. */
  applyCommandResponse(
    context: ModuleExecutionContext,
    response: CommandApiResponse,
    canCommit?: () => boolean
  ): Promise<void>;

  /** Commit all deltas and the opaque cursor together; a failed transaction must not advance it. */
  commitPull(
    context: ModuleExecutionContext,
    pull: LocalPullCommit,
    canCommit?: () => boolean
  ): Promise<void>;

  getCursor(context: ModuleExecutionContext): Promise<string | null>;
  getSchemaVersion(partition: ModuleAccountPartition): Promise<number>;
}

export type LocalCommandAck = CommandAckResponse;
