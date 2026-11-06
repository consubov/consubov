import { authorizedEnvelope } from '../harness/api-auth';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createApiServer } from '@consubov/platform-api';
import { allocateAvailablePort } from '../harness/port-allocator';
import { createSyntheticCommandEnvelope } from '../harness/synthetic-data';
import { signSyntheticJwt, SYNTHETIC_USERS } from '@consubov/auth-client';

describe('Gate Q2.4: Isolamento Multi-Tenant, Deduplicação e Concorrência OCC na API', () => {
  let apiInstance: ReturnType<typeof createApiServer>;
  let baseUrl: string;

  const tenantA = '11111111-aaaa-4111-8111-111111111111';
  const tenantB = '22222222-bbbb-4222-8222-222222222222';

  let tokenTenantA: string;
  let tokenTenantB: string;

  beforeAll(async () => {
    const port = await allocateAvailablePort(3430);
    apiInstance = createApiServer(port, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${port}`;

    // Explicit server-side synthetic tenants authenticate through the real selected-context handler.
    for (const [suffix, tenant, farm] of [['a', tenantA, 'fazenda-a-01'], ['b', tenantB, 'fazenda-b-01']]) {
      const template = structuredClone(SYNTHETIC_USERS['capataz.lab@consubov.local']!);
      const email = `tenant-${suffix}.test@consubov.local`;
      template.email = email; template.user_id = `user-tenant-${suffix}-01`;
      template.memberships = [{ ...template.memberships[0]!, membership_id: 'membership-' + suffix, tenant_id: tenant!, fazenda_id: farm! }];
      SYNTHETIC_USERS[email] = template;
      const response = await fetch(baseUrl + '/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password: template.password_hash, device_id: 'tenant-test-device', membership_id: 'membership-' + suffix }) });
      expect(response.status).toBe(200);
      const login = await response.json();
      if (suffix === 'a') tokenTenantA = login.tokens.access_token; else tokenTenantB = login.tokens.access_token;
    }
  });

  afterAll(() => {
    delete SYNTHETIC_USERS['tenant-a.test@consubov.local']; delete SYNTHETIC_USERS['tenant-b.test@consubov.local'];
    if (apiInstance) {
      apiInstance.stop();
    }
  });

  it('Q2.4.1: deve isolar agregados com identificadores idênticos em tenants diferentes (Zero Colisão Cross-Tenant)', async () => {
    const sharedAggregateId = 'pasto-compartilhado-01';

    // Tenant A muta pasto-compartilhado-01 na base_version: 1
    const envA = createSyntheticCommandEnvelope({
      command_id: 'cmd-tenant-a-01',
      idempotency_key: 'idemp-tenant-a-01',
      tenant_id: tenantA,
      fazenda_id: 'fazenda-a-01',
      user_id: 'user-tenant-a-01',
      profile_id: 'capataz',
      command_type: 'capataz.cocho.registrar_escore', aggregate_type: 'cocho',
      aggregate_id: sharedAggregateId,
      base_version: 1,
      payload: {
        pasto_id: sharedAggregateId,
        produto_id: 'prod-01',
        sacos_fornecidos: 2,
        escore_cocho: 2
      }
    });

    const resA = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenTenantA}`
      },
      body: JSON.stringify(authorizedEnvelope(tokenTenantA, envA))
    });

    expect(resA.status).toBe(200);
    const ackA: any = await resA.json();
    expect(ackA.ack.aggregate_version).toBe(2);

    // Tenant B muta o MESMO pasto-compartilhado-01 também na base_version: 1
    // NÃO DEVE DAR 409, pois pertence a outro tenant!
    const envB = createSyntheticCommandEnvelope({
      command_id: 'cmd-tenant-b-01',
      idempotency_key: 'idemp-tenant-b-01',
      tenant_id: tenantB,
      fazenda_id: 'fazenda-b-01',
      user_id: 'user-tenant-b-01',
      profile_id: 'capataz',
      command_type: 'capataz.cocho.registrar_escore', aggregate_type: 'cocho',
      aggregate_id: sharedAggregateId,
      base_version: 1,
      payload: {
        pasto_id: sharedAggregateId,
        produto_id: 'prod-02',
        sacos_fornecidos: 5,
        escore_cocho: 3
      }
    });

    const resB = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenTenantB}`
      },
      body: JSON.stringify(authorizedEnvelope(tokenTenantB, envB))
    });

    expect(resB.status).toBe(200);
    const ackB: any = await resB.json();
    expect(ackB.ack.aggregate_version).toBe(2);
    expect(ackB.success).toBe(true);
  });

  it('Q2.4.2: deve isolar chaves de idempotência idênticas entre tenants distintos', async () => {
    const identicalIdempKey = 'chave-idempotencia-coincidente-123456';

    const envA = createSyntheticCommandEnvelope({
      command_id: 'cmd-idemp-a-01',
      idempotency_key: identicalIdempKey,
      tenant_id: tenantA,
      fazenda_id: 'fazenda-a-01',
      user_id: 'user-tenant-a-01',
      profile_id: 'capataz',
      command_type: 'capataz.cocho.registrar_escore', aggregate_type: 'cocho',
      aggregate_id: 'pasto-idemp-01',
      base_version: 1,
      payload: {
        pasto_id: 'pasto-idemp-01',
        produto_id: 'prod-01',
        sacos_fornecidos: 1,
        escore_cocho: 1
      }
    });

    const resA1 = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenTenantA}`
      },
      body: JSON.stringify(authorizedEnvelope(tokenTenantA, envA))
    });
    expect(resA1.status).toBe(200);
    const ackA1: any = await resA1.json();
    expect(ackA1.success).toBe(true);

    // Tenant B usa a MESMA chave de idempotência
    // NÃO DEVE SER DEDUPLICADO como replay do Tenant A!
    const envB = createSyntheticCommandEnvelope({
      command_id: 'cmd-idemp-b-01',
      idempotency_key: identicalIdempKey,
      tenant_id: tenantB,
      fazenda_id: 'fazenda-b-01',
      user_id: 'user-tenant-b-01',
      profile_id: 'capataz',
      command_type: 'capataz.cocho.registrar_escore', aggregate_type: 'cocho',
      aggregate_id: 'pasto-idemp-02',
      base_version: 1,
      payload: {
        pasto_id: 'pasto-idemp-02',
        produto_id: 'prod-02',
        sacos_fornecidos: 4,
        escore_cocho: 2
      }
    });

    const resB = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenTenantB}`
      },
      body: JSON.stringify(authorizedEnvelope(tokenTenantB, envB))
    });
    expect(resB.status).toBe(200);
    const ackB: any = await resB.json();
    expect(ackB.ack.command_id).toBe('cmd-idemp-b-01');
    expect(ackB.success).toBe(true);

    // Reenvio do Tenant A deve retornar o ACK original do Tenant A
    const resA2 = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenTenantA}`
      },
      body: JSON.stringify(authorizedEnvelope(tokenTenantA, envA))
    });
    expect(resA2.status).toBe(200);
    const ackA2: any = await resA2.json();
    expect(ackA2.ack.command_id).toBe('cmd-idemp-a-01');
    expect(ackA2).toEqual(ackA1);
  });

  it('Q2.4.3: deve validar concorrência OCC intra-tenant sob rajada simultânea de 20 requisições', async () => {
    const targetAggregateId = 'pasto-concorrencia-rajada-01';

    // 20 requisições simultâneas todas com base_version: 1
    const requests = Array.from({ length: 20 }, (_, idx) => {
      const env = createSyntheticCommandEnvelope({
        command_id: `cmd-rajada-${idx}-uuid-123456`,
        idempotency_key: `idemp-rajada-key-${idx}-123456`,
        tenant_id: tenantA,
        fazenda_id: 'fazenda-a-01',
        user_id: 'user-tenant-a-01',
        profile_id: 'capataz',
        command_type: 'capataz.cocho.registrar_escore', aggregate_type: 'cocho',
        aggregate_id: targetAggregateId,
        base_version: 1,
        payload: {
          pasto_id: targetAggregateId,
          produto_id: 'prod-01',
          sacos_fornecidos: 1,
          escore_cocho: 2
        }
      });

      return fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTenantA}`
        },
        body: JSON.stringify(authorizedEnvelope(tokenTenantA, env))
      });
    });

    const responses = await Promise.all(requests);
    const statuses = responses.map(r => r.status);

    const successCount = statuses.filter(s => s === 200).length;
    const conflictCount = statuses.filter(s => s === 409).length;

    // Exatamente UMA requisição deve vencer a corrida e avançar a versão para 1
    // As outras 19 devem receber HTTP 409 Concurrency Conflict
    expect(successCount).toBe(1);
    expect(conflictCount).toBe(19);
  });
});
