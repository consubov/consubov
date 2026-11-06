import { z } from 'zod';

const identifier = z.string().trim().min(1).max(128);
const version = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

/** Read-only operational failures from the current authorized account/module. */
export const operationIssueSchema = z.object({
  commandId: identifier,
  commandType: identifier,
  aggregateType: identifier,
  aggregateId: identifier,
  occurredAt: z.string().datetime(),
  recordedAt: z.string().datetime(),
  kind: z.enum(['conflict', 'validation', 'security']),
  currentVersion: version.optional(),
  baseVersion: version.optional(),
  violations: z.array(z.object({
    field: z.string().trim().min(1).max(128),
    code: identifier,
    message: z.string().trim().min(1).max(500)
  }).strict()).max(100).optional()
}).strict();

export const operationIssuesSchema = z.array(operationIssueSchema).max(500);
export type OperationIssue = z.infer<typeof operationIssueSchema>;
export type OperationIssueKind = OperationIssue['kind'];
