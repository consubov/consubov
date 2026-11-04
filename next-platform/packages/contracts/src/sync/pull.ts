export type DeltaOperation = 'UPSERT' | 'TOMBSTONE';

export interface SyncDeltaItem<T = Record<string, unknown>> {
  delta_id: string;
  aggregate_type: string;
  aggregate_id: string;
  operation: DeltaOperation;
  version: number;
  data: T | null; // Nulo se for TOMBSTONE
  modified_at: string; // ISO 8601
}

export interface SyncPullRequest {
  tenant_id: string;
  fazenda_id: string;
  profile_id: string;
  since_cursor: number;
  limit?: number;
}

export interface SyncPullResponse {
  tenant_id: string;
  fazenda_id: string;
  next_cursor: number;
  has_more: boolean;
  deltas: SyncDeltaItem[];
  server_timestamp: string;
}
