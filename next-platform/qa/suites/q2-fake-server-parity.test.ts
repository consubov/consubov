import { describe, it, expect, beforeEach } from 'bun:test';
import { FakeApiServer } from '@consubov/testing';
import { CommandAckResponse, CommandConflictError } from '@consubov/contracts';
import { createSyntheticCommandEnvelope } from '../harness/synthetic-data';

describe('Gate Q2.5: Paridade e Resolução do Finding do Challenger 1 no FakeApiServer', () => {
  let fakeServer: FakeApiServer;

  beforeEach(() => {
    fakeServer = new FakeApiServer();
  });

  it('Q2.5.1: deve permitir mesmo aggregate_id em tenants diferentes sem falso 409 (Finding Challenger 1 Sanado)', async () => {
    const tenant1 = 'tenant-lab-alpha';
    const tenant2 = 'tenant-lab-beta';
    const sharedAggregateId = 'lote-confinamento-01';

    // Tenant 1 envia comando para lote-confinamento-01 na base_version: 0
    const env1 = createSyntheticCommandEnvelope({
      command_id: 'cmd-t1-001',
      idempotency_key: 'idemp-key-t1-001',
      tenant_id: tenant1,
      aggregate_type: 'lote',
      aggregate_id: sharedAggregateId,
      base_version: 0
    });

    const res1 = await fakeServer.handleCommand(env1);
    expect(res1.status).toBe(200);
    if (res1.status === 200) {
      const ack = res1.body as CommandAckResponse;
      expect(ack.aggregate_version).toBe(1);
      expect(ack.status).toBe('COMMITTED');
    }

    // Tenant 2 envia comando para o MESMO aggregate_id 'lote-confinamento-01' na base_version: 0
    // Antes da correção, FakeApiServer indexava apenas por aggregate_id e retornava 409 incorretamente!
    // Com a partição tenant_id::aggregate_type::aggregate_id, deve retornar 200 COMMITTED.
    const env2 = createSyntheticCommandEnvelope({
      command_id: 'cmd-t2-001',
      idempotency_key: 'idemp-key-t2-001',
      tenant_id: tenant2,
      aggregate_type: 'lote',
      aggregate_id: sharedAggregateId,
      base_version: 0
    });

    const res2 = await fakeServer.handleCommand(env2);
    expect(res2.status).toBe(200);
    if (res2.status === 200) {
      const ack = res2.body as CommandAckResponse;
      expect(ack.aggregate_version).toBe(1);
      expect(ack.status).toBe('COMMITTED');
      expect(ack.idempotent_replay).toBe(false);
    }

    // Comprova que as versões foram gravadas isoladamente
    expect(fakeServer.getAggregateVersion(tenant1, 'lote', sharedAggregateId)).toBe(1);
    expect(fakeServer.getAggregateVersion(tenant2, 'lote', sharedAggregateId)).toBe(1);
  });

  it('Q2.5.2: deve isolar idempotência por tenant no FakeApiServer (sem falso replay cross-tenant)', async () => {
    const tenant1 = 'tenant-lab-01';
    const tenant2 = 'tenant-lab-02';
    const sharedIdempotencyKey = 'idemp-chave-coincidente-abc';

    const env1 = createSyntheticCommandEnvelope({
      command_id: 'cmd-t1-idemp',
      idempotency_key: sharedIdempotencyKey,
      tenant_id: tenant1,
      aggregate_id: 'pasto-t1',
      base_version: 0
    });

    const res1 = await fakeServer.handleCommand(env1);
    expect(res1.status).toBe(200);
    if (res1.status === 200) {
      const ack = res1.body as CommandAckResponse;
      expect(ack.idempotent_replay).toBe(false);
    }

    // Tenant 2 envia com a mesma idempotency_key
    const env2 = createSyntheticCommandEnvelope({
      command_id: 'cmd-t2-idemp',
      idempotency_key: sharedIdempotencyKey,
      tenant_id: tenant2,
      aggregate_id: 'pasto-t2',
      base_version: 0
    });

    const res2 = await fakeServer.handleCommand(env2);
    expect(res2.status).toBe(200);
    if (res2.status === 200) {
      const ack = res2.body as CommandAckResponse;
      expect(ack.command_id).toBe('cmd-t2-idemp');
      expect(ack.idempotent_replay).toBe(false);
    }

    // Reenvio no Tenant 1 deve ser detectado como replay
    const res1Replay = await fakeServer.handleCommand(env1);
    expect(res1Replay.status).toBe(200);
    if (res1Replay.status === 200) {
      const ack = res1Replay.body as CommandAckResponse;
      expect(ack.command_id).toBe('cmd-t1-idemp');
      expect(ack.idempotent_replay).toBe(true);
    }
  });

  it('Q2.5.3: deve rejeitar com 409 CONFLICT_409 quando base_version divergir intra-tenant no FakeApiServer', async () => {
    const tenant = 'tenant-lab-01';
    const aggregateId = 'pasto-occ-01';

    // Primeiro comando: base_version 0 -> avança para 1
    const env1 = createSyntheticCommandEnvelope({
      command_id: 'cmd-1',
      idempotency_key: 'idemp-1',
      tenant_id: tenant,
      aggregate_type: 'pasto',
      aggregate_id: aggregateId,
      base_version: 0
    });
    const res1 = await fakeServer.handleCommand(env1);
    expect(res1.status).toBe(200);

    // Segundo comando: tenta base_version 0 novamente no mesmo tenant
    const env2 = createSyntheticCommandEnvelope({
      command_id: 'cmd-2',
      idempotency_key: 'idemp-2',
      tenant_id: tenant,
      aggregate_type: 'pasto',
      aggregate_id: aggregateId,
      base_version: 0
    });
    const res2 = await fakeServer.handleCommand(env2);
    expect(res2.status).toBe(409);
    if (res2.status === 409) {
      const err = res2.body as CommandConflictError;
      expect(err.error).toBe('CONFLICT_409');
      expect(err.current_version).toBe(1);
      expect(err.base_version).toBe(0);
    }
  });
});
