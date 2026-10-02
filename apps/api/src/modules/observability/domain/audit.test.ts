import { describe, it, expect } from 'vitest';
import { FakeAuditLogAdapter } from '../adapters/fakes';
import type { AuditEvent } from './audit-contract';

describe('Audit Log Domain', () => {
  it('should successfully generate and store an audit log event', async () => {
    const adapter = new FakeAuditLogAdapter();
    const event: AuditEvent = {
      audit_id: 'audit-123',
      actorId: 'user-1',
      tenantId: 'tenant-1',
      originDevice: 'web-browser',
      occurredAt: new Date(),
      commandId: 'cmd-1',
      requestId: 'req-1',
      correlationId: 'corr-1',
      knownVersion: '1.0.0',
      action: 'UPDATE_USER',
      result: 'success',
      retry: false,
      changesSummary: 'Updated user name',
    };

    await adapter.log(event);
    expect(adapter.logs).toHaveLength(1);
    expect(adapter.logs[0]).toEqual(event);
  });

  it('should correctly handle retry and conflict flags', async () => {
    const adapter = new FakeAuditLogAdapter();
    const event: AuditEvent = {
      audit_id: 'audit-456',
      actorId: 'user-1',
      tenantId: 'tenant-1',
      originDevice: 'mobile-app',
      occurredAt: new Date(),
      commandId: 'cmd-2',
      requestId: 'req-2',
      correlationId: 'corr-2',
      knownVersion: '1.0.0',
      action: 'UPDATE_USER',
      result: 'conflict',
      retry: true,
      conflictRef: 'audit-123',
      changesSummary: 'Concurrent update conflict',
    };

    await adapter.log(event);
    expect(adapter.logs[0].result).toBe('conflict');
    expect(adapter.logs[0].retry).toBe(true);
    expect(adapter.logs[0].conflictRef).toBe('audit-123');
  });

  it('should not contain any PII or secrets in the audit log', async () => {
    const adapter = new FakeAuditLogAdapter();
    const sensitiveData = {
      password: 'secretPassword123',
      token: 'abc-123-def',
      apiKey: 'sk-test-12345',
      email: 'user@example.com',
      cpf: '123.456.789-00',
    };

    const event: AuditEvent = {
      audit_id: 'audit-789',
      actorId: 'user-1',
      tenantId: 'tenant-1',
      originDevice: 'web-browser',
      occurredAt: new Date(),
      commandId: 'cmd-3',
      requestId: 'req-3',
      correlationId: 'corr-3',
      knownVersion: '1.0.0',
      action: 'UPDATE_SENSITIVE',
      result: 'success',
      retry: false,
      changesSummary: `Updated fields with values: ${JSON.stringify(sensitiveData)}`, // Simulating accidental PII inclusion
    };

    await adapter.log(event);
    
    const logString = JSON.stringify(adapter.logs[0]);
    const piiRegex = /(password|token|apiKey|email|cpf|secret|credit_card)/i;
    
    // In a real scenario, the system should prevent this. 
    // This test verifies that our a regex scan can detect it if it slips through.
    expect(logString).not.toMatch(piiRegex);
  });
});
