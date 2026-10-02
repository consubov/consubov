export type AuditEvent = {
  audit_id: string;
  actorId: string;
  tenantId: string;
  farmId?: string;
  originDevice: string;
  occurredAt: Date;
  commandId: string;
  requestId: string;
  correlationId: string;
  knownVersion: string;
  action: string;
  result: 'success' | 'denied' | 'failed' | 'conflict';
  retry: boolean;
  conflictRef?: string;
  // Summary of persisted changes (no payload)
  // We avoid including any PII, passwords, tokens, or API keys in the audit log.
  // Instead, we can have a summary of what changed (e.g., field names) without the actual values.
  changesSummary: string;
};