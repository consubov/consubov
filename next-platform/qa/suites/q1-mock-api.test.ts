import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createApiServer } from '@consubov/platform-api';
import { allocateAvailablePort } from '../harness/port-allocator';
import { createSyntheticCommandEnvelope } from '../harness/synthetic-data';

describe('Suíte Q1.5: Mock Server Bun (/api/v1/health, /commands, ledger in-memory)', () => {
  let apiInstance: ReturnType<typeof createApiServer>;
  let baseUrl: string;

  beforeAll(async () => {
    const port = await allocateAvailablePort(3340);
    apiInstance = createApiServer(port, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(() => {
    if (apiInstance) {
      apiInstance.stop();
    }
  });

  it('GET /api/v1/health deve responder 200 com ambiente local isolado', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health`);
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('consubov-mock-api');
    expect(body.environment).toBe('local_isolated_lab');
    expect(typeof body.uptime_seconds).toBe('number');
  });

  it('POST /api/v1/commands deve processar envelope e emitir ACK com avanço de versão', async () => {
    const envelope = createSyntheticCommandEnvelope({
      command_id: 'cmd-test-001',
      idempotency_key: 'idemp-key-teste-001',
      aggregate_id: 'pasto-teste-01',
      base_version: 0
    });

    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope)
    });

    expect(res.status).toBe(200);
    const ack: any = await res.json();
    expect(ack.status).toBe('acked');
    expect(ack.command_id).toBe('cmd-test-001');
    expect(ack.aggregate_id).toBe('pasto-teste-01');
    expect(ack.new_version).toBe(1);
    expect(ack.idempotent_replay).toBe(false);
  });

  it('POST /api/v1/commands deve deduplicar reenvio do mesmo comando via Idempotency Ledger', async () => {
    const envelope = createSyntheticCommandEnvelope({
      command_id: 'cmd-test-001',
      idempotency_key: 'idemp-key-teste-001',
      aggregate_id: 'pasto-teste-01',
      base_version: 0
    });

    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope)
    });

    expect(res.status).toBe(200);
    const ack: any = await res.json();
    expect(ack.command_id).toBe('cmd-test-001');
    expect(ack.idempotent_replay).toBe(true);
  });

  it('POST /api/v1/commands deve rejeitar com 409 quando base_version divergir (OCC)', async () => {
    const conflictingEnvelope = createSyntheticCommandEnvelope({
      command_id: 'cmd-test-002',
      idempotency_key: 'idemp-key-teste-002',
      aggregate_id: 'pasto-teste-01',
      base_version: 0 // A versão atual já é 1!
    });

    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conflictingEnvelope)
    });

    expect(res.status).toBe(409);
    const err: any = await res.json();
    expect(err.error).toBe('CONCURRENCY_CONFLICT');
    expect(err.expected_base_version).toBe(1);
    expect(err.received_base_version).toBe(0);
  });

  it('POST /api/v1/commands deve rejeitar com 422 comando desconhecido fora da allowlist', async () => {
    const invalidEnvelope = {
      ...createSyntheticCommandEnvelope(),
      command_type: 'comando.estranho.fora.da.allowlist'
    };

    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidEnvelope)
    });

    expect(res.status).toBe(422);
    const err: any = await res.json();
    expect(err.error).toBe('COMMAND_NOT_ALLOWED');
  });
});
