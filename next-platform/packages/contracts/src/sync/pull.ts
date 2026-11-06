import { z } from 'zod';
import { attachmentRefSchema } from '../validation/envelope.schema';
import type { AttachmentRef } from '../envelope';

export type DeltaOperation = 'UPSERT' | 'TOMBSTONE';

export interface SyncDeltaItem<T = Record<string, unknown>> {
  delta_id: string;
  aggregate_type: string;
  aggregate_id: string;
  operation: DeltaOperation;
  version: number;
  data: T | null;
  modified_at: string;
}

/** Opaque cursors are issued by the server and must not be parsed or incremented by clients. */
export interface SyncPullRequest {
  tenant_id: string;
  fazenda_id: string;
  profile_id: string;
  since_cursor: string | null;
  limit?: number;
}

export interface SyncPullResponse {
  tenant_id: string;
  fazenda_id: string;
  next_cursor: string;
  has_more: boolean;
  deltas: SyncDeltaItem[];
  server_timestamp: string;
  attachment_refs?: AttachmentRef[];
}

const identifier = z.string().trim().min(1).max(128);
const cursor = z.string().trim().min(1).max(512);

export const syncDeltaItemSchema = z.object({
  delta_id: identifier,
  aggregate_type: identifier,
  aggregate_id: identifier,
  operation: z.enum(['UPSERT', 'TOMBSTONE']),
  version: z.number().int().nonnegative(),
  data: z.record(z.unknown()).nullable(),
  modified_at: z.string().datetime()
}).strict().superRefine((delta, context) => {
  if (delta.operation === 'UPSERT' && delta.data === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['data'], message: 'UPSERT precisa conter dados.' });
  }
  if (delta.operation === 'TOMBSTONE' && delta.data !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['data'], message: 'TOMBSTONE não pode conter dados.' });
  }
});

export const syncPullRequestSchema = z.object({
  tenant_id: identifier,
  fazenda_id: identifier,
  profile_id: z.enum(['capataz', 'gerente', 'escritorio', 'fabrica']),
  since_cursor: cursor.nullable(),
  limit: z.number().int().min(1).max(500).optional()
}).strict();

export const syncPullResponseSchema = z.object({
  tenant_id: identifier,
  fazenda_id: identifier,
  next_cursor: cursor,
  has_more: z.boolean(),
  deltas: z.array(syncDeltaItemSchema).max(500),
  server_timestamp: z.string().datetime(),
  attachment_refs: z.array(attachmentRefSchema).optional()
}).strict();
