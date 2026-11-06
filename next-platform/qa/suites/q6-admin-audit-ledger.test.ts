import { loginApi, authorizedEnvelope } from '../harness/api-auth';
import { moduleSeedSnapshot } from '../harness/module-seed';
import { decodeSyntheticJwt } from '@consubov/auth-client';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createApiServer } from '@consubov/platform-api';
import { InMemoryLedger } from '../../api/src/ledger/in-memory-ledger';
import { allocateAvailablePort } from '../harness/port-allocator';
import { installNetworkGuard } from '../harness/network-guard';
import {
  signSyntheticJwt,
  SYNTHETIC_JWT_SECRET_LAB
} from '@consubov/auth-client';
import { AtomicCommandEnvelope } from '@consubov/contracts';

describe('Gate Q6: Auditoria Global do Ledger de Comandos & Endpoint Administrativo (q6-admin-audit-ledger)', () => {
  let restoreNetwork: () => void;
  let apiInstance: ReturnType<typeof createApiServer>;
  let baseUrl: string;
  let adminToken: string;
  let capatazToken: string;

  const sampleEnvelope1: AtomicCommandEnvelope = {
    command_id: '00000000-0000-4000-8000-000000000011',
    idempotency_key: 'idemp-audit-ledger-test-00001',
    command_type: 'capataz.salga.lancar',
    aggregate_type: 'cocho',
    aggregate_id: 'pasto-01',
    base_version: 1,
    user_id: 'usr-capataz',
    tenant_id: 'ten-audit-001',
    product_id: 'consubov',
    fazenda_id: 'faz-audit-001',
    retiro_id: null,
    profile_id: 'capataz',
    device_id: 'dev-01',
    schema_version: 1,
    payload: {
      pasto_id: 'pasto-01',
      produto_id: 'prod-sal-01',
      escore_cocho: 2,
      sacos_fornecidos: 5
    },
    correlation_id: '00000000-0000-4000-8000-000000000011',
    attachment_refs: [],
    occurred_at_local: '2026-11-05T08:00:00Z',
    status: 'SINCRONIZADO',
    attempts: 1,
    last_attempt_at: '2026-11-05T08:00:00Z',
    error_message: null
  };

  const sampleEnvelope2: AtomicCommandEnvelope = {
    ...sampleEnvelope1,
    command_id: '00000000-0000-4000-8000-000000000012',
    idempotency_key: 'idemp-audit-ledger-test-00002',
    command_type: 'gerente.metas.definir',
    aggregate_type: 'lote',
    aggregate_id: '00000000-0000-4000-8000-000000000098',
    base_version: 0,
    user_id: '10000000-0000-4000-8000-000000000001',
    tenant_id: 'ten-audit-002',
    profile_id: 'gerente',
    payload: { lote_id: '00000000-0000-4000-8000-000000000098', gmd_alvo_kg_dia: 1.5, peso_final_alvo_kg: 500, data_alvo_abate: '2026-12-01T00:00:00.000Z' },
    occurred_at_local: '2026-11-05T09:00:00Z'
  };

  beforeAll(async () => {
    restoreNetwork = installNetworkGuard();
    const port = await allocateAvailablePort(3600);
    apiInstance = createApiServer(port, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${port}`;

    adminToken = (await loginApi(baseUrl, 'administrador')).tokens.access_token;
    capatazToken = (await loginApi(baseUrl, 'capataz')).tokens.access_token;
  });

  afterAll(() => {
    if (apiInstance) apiInstance.stop();
    if (restoreNetwork) restoreNetwork();
  });

  it('Q6.3.1: InMemoryLedger deve registrar comandos e permitir consulta filtrada via queryLogs()', () => {
    const ledger = new InMemoryLedger();

    ledger.initialize({ ...sampleEnvelope1, session_id: 'direct-unit' }, moduleSeedSnapshot('capataz').data, sampleEnvelope1.occurred_at_local);
    ledger.initialize({ ...sampleEnvelope2, session_id: 'direct-unit' }, moduleSeedSnapshot('gerente').data, sampleEnvelope2.occurred_at_local);
    expect(ledger.processCommand(sampleEnvelope1).success).toBe(true);
    expect(ledger.processCommand(sampleEnvelope2).success).toBe(true);

    // Consulta sem filtro -> retorna todos
    const all = ledger.queryLogs();
    expect(all.length).toBe(2);

    // Filtro por tenant_id
    const ten1 = ledger.queryLogs({ tenant_id: 'ten-audit-001' });
    expect(ten1.length).toBe(1);
    expect(ten1[0]?.envelope.command_type).toBe('capataz.salga.lancar');

    // Filtro por profile_id
    const ger = ledger.queryLogs({ profile_id: 'gerente' });
    expect(ger.length).toBe(1);
    expect(ger[0]?.envelope.command_type).toBe('gerente.metas.definir');

    // Filtro por command_type
    const salga = ledger.queryLogs({ command_type: 'capataz.salga.lancar' });
    expect(salga.length).toBe(1);

    // Filtro por status
    const acked = ledger.queryLogs({ status: 'COMMITTED' });
    expect(acked.length).toBe(2);
  });

  it('Q6.3.2: endpoint GET /api/v1/admin/audit deve rejeitar requisição não autenticada com HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/audit`, {
      method: 'GET'
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('Q6.3.3: endpoint GET /api/v1/admin/audit deve rejeitar token de perfil não-administrativo com HTTP 403 (Fail-Closed)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/admin/audit`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${capatazToken}`
      }
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('FORBIDDEN');
  });

  it('Q6.3.4: endpoint GET /api/v1/admin/audit deve permitir consulta com token administrativo com HTTP 200', async () => {
    // Primeiro envia um comando via POST /api/v1/commands com token do capataz
    await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${capatazToken}`
      },
      body: JSON.stringify(authorizedEnvelope(capatazToken, sampleEnvelope1))
    });

    // Agora consulta o ledger como administrador
    const res = await fetch(`${baseUrl}/api/v1/admin/audit`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(data.logs)).toBe(true);

    const match = data.logs.find((l: any) => l.envelope?.command_id === sampleEnvelope1.command_id);
    expect(match).toBeDefined();
    expect(match.envelope.command_type).toBe('capataz.salga.lancar');
  });

  it('Q6.3.5: endpoint GET /api/v1/admin/audit deve filtrar corretamente por command_type e tenant_id via query params', async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/admin/audit?command_type=capataz.salga.lancar&tenant_id=${decodeSyntheticJwt(capatazToken)!.tenant_id}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBeGreaterThanOrEqual(1);
    expect(data.logs.every((l: any) => l.envelope?.command_type === 'capataz.salga.lancar')).toBe(true);
  });
});
