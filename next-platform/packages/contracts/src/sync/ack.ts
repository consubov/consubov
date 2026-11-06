import { z } from 'zod';

export interface CommandAckResponse {
  command_id: string;
  status: 'COMMITTED';
  aggregate_id: string;
  aggregate_version: number;
  committed_at: string;
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
  violations: Array<{ field: string; message: string; code: string }>;
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

const id = z.string().trim().min(1).max(128);
const commandAckSchema = z.object({
  command_id: id,
  status: z.literal('COMMITTED'),
  aggregate_id: id,
  aggregate_version: z.number().int().nonnegative(),
  committed_at: z.string().datetime(),
  correlation_id: id,
  idempotent_replay: z.boolean().optional()
}).strict();

const commandConflictSchema = z.object({
  error: z.literal('CONFLICT_409'),
  command_id: id,
  aggregate_id: id,
  base_version: z.number().int().nonnegative(),
  current_version: z.number().int().nonnegative(),
  conflict_reason: z.string().trim().min(1).max(500),
  resolution_strategy: z.enum(['MANUAL_RESOLUTION_REQUIRED', 'RETRY_WITH_NEW_BASE_VERSION']),
  details: z.record(z.unknown()).optional()
}).strict();

const commandValidationSchema = z.object({
  error: z.literal('UNPROCESSABLE_ENTITY_422'),
  command_id: id,
  violations: z.array(z.object({
    field: id,
    message: z.string().trim().min(1).max(500),
    code: id
  }).strict()).max(100)
}).strict();

const commandSecuritySchema = z.object({
  error: z.enum(['UNAUTHORIZED_401', 'FORBIDDEN_403']),
  command_id: id,
  reason: z.string().trim().min(1).max(500),
  required_capability: id.optional()
}).strict();

export const commandApiResponseSchema = z.union([
  z.object({ success: z.literal(true), ack: commandAckSchema }).strict(),
  z.object({ success: z.literal(false), conflict: commandConflictSchema }).strict(),
  z.object({ success: z.literal(false), validation: commandValidationSchema }).strict(),
  z.object({ success: z.literal(false), security: commandSecuritySchema }).strict()
]);
