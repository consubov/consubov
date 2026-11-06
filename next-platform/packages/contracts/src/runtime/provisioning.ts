import { z } from 'zod';
import { moduleExecutionContextSchema } from './module-protocol';
import { attachmentRefSchema } from '../validation/envelope.schema';

/** Server-issued initial state for the selected laboratory account/context only. */
export const moduleProvisioningPayloadSchema = z.object({
  protocolVersion: z.literal(1),
  context: moduleExecutionContextSchema,
  attachment_refs: z.array(attachmentRefSchema).optional(),
  snapshot: z.object({
    aggregateType: z.literal('module-state'),
    aggregateId: z.literal('bootstrap'),
    version: z.number().int().nonnegative(),
    data: z.record(z.unknown()),
    modifiedAt: z.string().datetime()
  }).strict()
}).strict();

export type ModuleProvisioningPayload = z.infer<typeof moduleProvisioningPayloadSchema>;

