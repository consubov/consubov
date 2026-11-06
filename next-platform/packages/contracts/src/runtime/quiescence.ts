import { z } from 'zod';

export const CRITICAL_OPERATION_TYPES = ['FORM_DIRTY', 'CAMERA_ACTIVE', 'WEIGHING_ACTIVE', 'OUTBOX_SYNCING', 'QR_SCANNING', 'LOCAL_DB_TRANSACTION'] as const;
export const criticalOperationTypeSchema = z.enum(CRITICAL_OPERATION_TYPES);
export type CriticalWorkCounts = Record<typeof CRITICAL_OPERATION_TYPES[number], number>;
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const counts = z.object({ FORM_DIRTY: count, CAMERA_ACTIVE: count, WEIGHING_ACTIVE: count, OUTBOX_SYNCING: count, QR_SCANNING: count, LOCAL_DB_TRANSACTION: count }).strict();
const identity = { protocolVersion: z.literal(1), moduleId: z.enum(['capataz', 'gerente', 'escritorio', 'fabrica']), nonce: z.string().uuid() };
const requestId = z.string().uuid();
const leaseId = z.string().uuid();
export const shellQuiescenceControlSchema = z.discriminatedUnion('kind', [
  z.object({ ...identity, kind: z.literal('shell:prepare-activation'), requestId }).strict(),
  z.object({ ...identity, kind: z.literal('shell:verify-activation'), requestId, leaseId }).strict(),
  z.object({ ...identity, kind: z.literal('shell:release-activation'), leaseId }).strict()
]);
export const moduleQuiescenceMessageSchema = z.discriminatedUnion('kind', [
  z.object({ ...identity, kind: z.literal('module:quiescence'), quiescent: z.boolean(), frozen: z.boolean(), counts }).strict(),
  z.object({ ...identity, kind: z.literal('module:activation-prepared'), requestId, prepared: z.boolean(), leaseId: leaseId.nullable(), expiresAt: z.number().int().positive().nullable() }).strict(),
  z.object({ ...identity, kind: z.literal('module:activation-verified'), requestId, leaseId, valid: z.boolean() }).strict()
]);
export type ShellQuiescenceControl = z.infer<typeof shellQuiescenceControlSchema>;
export type ModuleQuiescenceMessage = z.infer<typeof moduleQuiescenceMessageSchema>;
