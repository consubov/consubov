import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createApiServer } from '@consubov/platform-api';
import { createSyntheticCommandEnvelope } from '../harness/synthetic-data';
import { loginApi, authorizedEnvelope } from '../harness/api-auth';

describe('Q1.5 real local API: health, domain commit, stable retry, OCC and allowlist', () => {
  let instance: ReturnType<typeof createApiServer>, baseUrl: string, token: string;
  let envelope: ReturnType<typeof createSyntheticCommandEnvelope>, originalAck: unknown;
  beforeAll(async () => {
    instance = createApiServer(0, '127.0.0.1'); baseUrl = `http://127.0.0.1:${instance.port}`;
    token = (await loginApi(baseUrl, 'capataz')).tokens.access_token;
    envelope = authorizedEnvelope(token, createSyntheticCommandEnvelope({ command_id: 'cmd-test-001', idempotency_key: 'idemp-key-teste-001', command_type: 'capataz.cocho.registrar_escore', aggregate_type: 'cocho', aggregate_id: 'pasto-teste-01', base_version: 1, payload: { pasto_id: 'pasto-teste-01', produto_id: 'prod-01', escore_cocho: 2, sacos_fornecidos: 2 } }));
  });
  afterAll(() => instance?.stop());
  const send = (body: unknown) => fetch(baseUrl + '/api/v1/commands', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  it('returns isolated local health', async () => {
    const res = await fetch(baseUrl + '/api/v1/health'); expect(res.status).toBe(200);
    const body = await res.json(); expect(body.status).toBe('ok'); expect(body.service).toBe('consubov-mock-api'); expect(body.environment).toBe('local_isolated_lab'); expect(typeof body.uptime_seconds).toBe('number');
  });
  it('commits actual projection and wrapped COMMITTED ACK', async () => {
    const response = await send(envelope); expect(response.status).toBe(200); const body = await response.json();
    expect(body.success).toBe(true); expect(body.ack.status).toBe('COMMITTED'); expect(body.ack.command_id).toBe(envelope.command_id); expect(body.ack.aggregate_id).toBe(envelope.aggregate_id); expect(body.ack.aggregate_version).toBe(2); originalAck = body;
  });
  it('returns identical immutable ACK without applying twice', async () => {
    const response = await send(envelope); expect(response.status).toBe(200); expect(await response.json()).toEqual(originalAck); expect(instance.ledger.queryLogs()).toHaveLength(1);
    const changed = await send({ ...envelope, command_id: 'different-command' }); expect(changed.status).toBe(409);
  });
  it('rejects stale aggregate base version without mutation', async () => {
    const response = await send({ ...envelope, command_id: 'cmd-test-002', idempotency_key: 'idemp-key-teste-002' }); expect(response.status).toBe(409);
    const body = await response.json(); expect(body.conflict.error).toBe('CONFLICT_409'); expect(body.conflict.current_version).toBe(2); expect(body.conflict.base_version).toBe(1); expect(instance.ledger.queryLogs()).toHaveLength(1);
  });
  it('rejects a command outside the allowlist', async () => {
    const response = await send({ ...envelope, command_type: 'comando.estranho.fora.da.allowlist' }); expect(response.status).toBe(422); const body = await response.json(); expect(body.validation.error).toBe('UNPROCESSABLE_ENTITY_422'); expect(body.validation.violations[0].code).toBe('INVALID_ENVELOPE');
  });
});
