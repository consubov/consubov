export interface CommandAckResponse {
  command_id: string;
  status: 'COMMITTED';
  aggregate_id: string;
  aggregate_version: number;
  committed_at: string; // ISO 8601
  correlation_id: string;
  idempotent_replay?: boolean;
}

export interface CommandConflictError {
  error: 'CONFLICT_409';
  command_id: string;
  aggregate_id: string;
  base_version: number;
  current_version: number;
  conflict_reason: string;
  resolution_strategy: 'MANUAL_RESOLUTION_REQUIRED' | 'RETRY_WITH_NEW_BASE_VERSION';
  details?: Record<string, unknown>;
}

export interface CommandValidationError {
  error: 'UNPROCESSABLE_ENTITY_422';
  command_id: string;
  violations: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

export interface CommandSecurityError {
  error: 'UNAUTHORIZED_401' | 'FORBIDDEN_403';
  command_id: string;
  reason: string;
  required_capability?: string;
}

export type CommandApiResponse =
  | { success: true; ack: CommandAckResponse }
  | { success: false; conflict: CommandConflictError }
  | { success: false; validation: CommandValidationError }
  | { success: false; security: CommandSecurityError };
