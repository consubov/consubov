import { z } from 'zod';
import { ALLOWED_COMMAND_TYPES } from '../commands';

export const attachmentRefSchema = z.object({
  attachment_id: z.string().min(1),
  mime_type: z.string().min(1),
  size_bytes: z.number().int().positive(),
  hash_sha256: z.string().length(64),
  local_blob_ref: z.string().min(1)
});

export const atomicCommandEnvelopeSchema = z.object({
  command_id: z.string().min(1),
  idempotency_key: z.string().min(16),
  command_type: z.enum(ALLOWED_COMMAND_TYPES),
  aggregate_type: z.string().min(1),
  aggregate_id: z.string().min(1),
  base_version: z.number().int().nonnegative(),
  user_id: z.string().min(1),
  tenant_id: z.string().min(1),
  product_id: z.enum(['consubov', 'relatto', 'syncvet', 'mais_arrobas']),
  fazenda_id: z.string().min(1),
  retiro_id: z.string().nullable().optional().default(null),
  profile_id: z.enum(['gerente', 'capataz', 'escritorio', 'fabrica', 'administrador']),
  device_id: z.string().min(1),
  schema_version: z.number().int().positive(),
  payload: z.record(z.unknown()),
  correlation_id: z.string().min(1),
  attachment_refs: z.array(attachmentRefSchema).default([]),
  occurred_at_local: z.string().datetime(),
  status: z.enum(['PENDENTE', 'ENVIANDO', 'SINCRONIZADO', 'CONFLITO', 'ERRO_FATAL']),
  attempts: z.number().int().nonnegative(),
  last_attempt_at: z.string().datetime().nullable().optional().default(null),
  error_message: z.string().nullable().optional().default(null)
});

export type AtomicCommandEnvelopeSchema = z.infer<typeof atomicCommandEnvelopeSchema>;
