import { loginApi, authorizedEnvelope } from '../harness/api-auth';
import { isProfileAuthorizedForCommand } from '@consubov/contracts';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createApiServer } from '@consubov/platform-api';
import { allocateAvailablePort } from '../harness/port-allocator';
import { createSyntheticCommandEnvelope } from '../harness/synthetic-data';
import { signSyntheticJwt, SYNTHETIC_USERS } from '@consubov/auth-client';

describe('Gate Q2.2: Matriz RBAC Declarativa (5 perfis x 22 comandos autorizados)', () => {
  let apiInstance: ReturnType<typeof createApiServer>;
  let baseUrl: string;

  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    const port = await allocateAvailablePort(3410);
    apiInstance = createApiServer(port, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${port}`;

    const profiles = [
      { key: 'capataz', email: 'capataz.lab@consubov.local', profile_id: 'capataz' as const },
      { key: 'gerente', email: 'gerente.lab@consubov.local', profile_id: 'gerente' as const },
      { key: 'escritorio', email: 'escritorio.lab@consubov.local', profile_id: 'escritorio' as const },
      { key: 'fabrica', email: 'fabrica.lab@consubov.local', profile_id: 'fabrica' as const },
      { key: 'admin', email: 'admin.lab@consubov.local', profile_id: 'administrador' as const }
    ];

    for (const p of profiles) {
      const user = SYNTHETIC_USERS[p.email]!;
      const mem = user.memberships[0]!;
      tokens[p.key] = (await loginApi(baseUrl, p.profile_id)).tokens.access_token;
    }
  });

  afterAll(() => {
    if (apiInstance) {
      apiInstance.stop();
    }
  });

  it('Q2.2.1: deve barrar com 403 Gerente tentando comando exclusivo de ADM (admin.tenants.criar)', async () => {
    const user = SYNTHETIC_USERS['gerente.lab@consubov.local']!;
    const mem = user.memberships[0]!;

    const envelope = createSyntheticCommandEnvelope({
      user_id: user.user_id,
      tenant_id: mem.tenant_id,
      fazenda_id: mem.fazenda_id,
      profile_id: 'gerente',
      command_type: 'admin.tenants.criar',
      payload: {
        tenant_id: 'tenant-novo-01',
        razao_social: 'Nova Agro S/A',
        nome_fantasia: 'Nova Agro',
        cnpj: '12345678000199',
        plano: 'starter',
        limite_fazendas: 5,
        limite_cabecas: 5000,
        admin_email: 'admin@novaagro.com',
        admin_nome: 'Admin'
      }
    });

    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens['gerente']}`
      },
      body: JSON.stringify(authorizedEnvelope(tokens['gerente']!, envelope))
    });

    expect(res.status).toBe(403);
    const body: any = await res.json();
    expect(body.security.error).toBe('FORBIDDEN_403');
  });

  it('Q2.2.2: deve barrar com 403 Capataz tentando apropriar custos de gestão (gerente.custos.apropriar)', async () => {
    const user = SYNTHETIC_USERS['capataz.lab@consubov.local']!;
    const mem = user.memberships[0]!;

    const envelope = createSyntheticCommandEnvelope({
      user_id: user.user_id,
      tenant_id: mem.tenant_id,
      fazenda_id: mem.fazenda_id,
      profile_id: 'capataz',
      command_type: 'gerente.custos.apropriar',
      payload: {
        lote_id: 'lote-01',
        periodo_mes: 11,
        periodo_ano: 2026,
        valor_total_apropriado: 15000,
        itens_apropriacao: [{ centro_custo: 'Salga', valor: 15000 }],
        data_apropriacao: '2026-11-04T12:00:00.000Z'
      }
    });

    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens['capataz']}`
      },
      body: JSON.stringify(authorizedEnvelope(tokens['capataz']!, envelope))
    });

    expect(res.status).toBe(403);
    const body: any = await res.json();
    expect(body.security.error).toBe('FORBIDDEN_403');
  });

  it('Q2.2.3: deve barrar com 403 Administrador tentando lançar cocho de campo (capataz.cocho.registrar_escore)', async () => {
    const user = SYNTHETIC_USERS['admin.lab@consubov.local']!;
    const mem = user.memberships[0]!;

    const envelope = createSyntheticCommandEnvelope({
      user_id: user.user_id,
      tenant_id: mem.tenant_id,
      fazenda_id: mem.fazenda_id,
      profile_id: 'administrador',
      command_type: 'capataz.cocho.registrar_escore'
    });

    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens['admin']}`
      },
      body: JSON.stringify(authorizedEnvelope(tokens['admin']!, envelope))
    });

    expect(res.status).toBe(403);
    const body: any = await res.json();
    expect(body.security.error).toBe('FORBIDDEN_403');
  });

  it('Q2.2.4: deve barrar com 403 Escritório tentando iniciar batida industrial (fabrica.batidas.iniciar)', async () => {
    const user = SYNTHETIC_USERS['escritorio.lab@consubov.local']!;
    const mem = user.memberships[0]!;

    const envelope = createSyntheticCommandEnvelope({
      user_id: user.user_id,
      tenant_id: mem.tenant_id,
      fazenda_id: mem.fazenda_id,
      profile_id: 'escritorio',
      command_type: 'fabrica.batidas.iniciar',
      payload: {
        batida_id: 'batida-01',
        ordem_producao_id: 'op-01',
        formula_id: 'form-01',
        quantidade_planejada_kg: 1000,
        quantidade_realizada_kg: 1000,
        misturador_id: 'mist-01',
        tempo_mistura_segundos: 120,
        operador_id: 'op-user-01',
        iniciado_em: '2026-11-04T10:00:00.000Z',
        finalizado_em: '2026-11-04T10:10:00.000Z',
        desvio_peso_kg: 0
      }
    });

    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens['escritorio']}`
      },
      body: JSON.stringify(authorizedEnvelope(tokens['escritorio']!, envelope))
    });

    expect(res.status).toBe(403);
    const body: any = await res.json();
    expect(body.security.error).toBe('FORBIDDEN_403');
  });

  it('Q2.2.5: deve aprovar com 200 Capataz executando seu próprio comando (capataz.cocho.registrar_escore)', async () => {
    const user = SYNTHETIC_USERS['capataz.lab@consubov.local']!;
    const mem = user.memberships[0]!;

    const envelope = createSyntheticCommandEnvelope({
      command_id: 'cmd-capataz-legitimo-01',
      idempotency_key: 'idemp-capataz-legitimo-01',
      user_id: user.user_id,
      tenant_id: mem.tenant_id,
      fazenda_id: mem.fazenda_id,
      profile_id: 'capataz',
      command_type: 'capataz.cocho.registrar_escore',
      aggregate_id: 'pasto-01', payload: { pasto_id: 'pasto-01', produto_id: 'prod-01', sacos_fornecidos: 2, escore_cocho: 2 },
      base_version: 1
    });

    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens['capataz']}`
      },
      body: JSON.stringify(authorizedEnvelope(tokens['capataz']!, envelope))
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.ack.status).toBe('COMMITTED');
  });

  it('Q2.2.6: deve aprovar com 200 Gerente executando seu próprio comando (gerente.metas.definir)', async () => {
    const user = SYNTHETIC_USERS['gerente.lab@consubov.local']!;
    const mem = user.memberships[0]!;

    const envelope = createSyntheticCommandEnvelope({
      command_id: 'cmd-gerente-legitimo-01',
      idempotency_key: 'idemp-gerente-legitimo-01',
      user_id: user.user_id,
      tenant_id: mem.tenant_id,
      fazenda_id: mem.fazenda_id,
      profile_id: 'gerente',
      command_type: 'gerente.metas.definir',
      aggregate_type: 'lote', aggregate_id: 'lote-01',
      base_version: 0,
      payload: {
        lote_id: 'lote-01',
        gmd_alvo_kg_dia: 1.25,
        peso_final_alvo_kg: 520,
        data_alvo_abate: '2026-12-20T00:00:00.000Z'
      }
    });

    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens['gerente']}`
      },
      body: JSON.stringify(authorizedEnvelope(tokens['gerente']!, envelope))
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.ack.status).toBe('COMMITTED');
  });

  it('Q2.2.7: deve aprovar com 200 Fábrica executando seu próprio comando (fabrica.batidas.iniciar)', async () => {
    const user = SYNTHETIC_USERS['fabrica.lab@consubov.local']!;
    const mem = user.memberships[0]!;

    const envelope = createSyntheticCommandEnvelope({
      command_id: 'cmd-fabrica-legitimo-01',
      idempotency_key: 'idemp-fabrica-legitimo-01',
      user_id: user.user_id,
      tenant_id: mem.tenant_id,
      fazenda_id: mem.fazenda_id,
      profile_id: 'fabrica',
      command_type: 'fabrica.batidas.iniciar',
      aggregate_type: 'batida', aggregate_id: 'batida-01',
      base_version: 0,
      payload: {
        batida_id: 'batida-01',
        ordem_producao_id: 'op-01',
        formula_id: 'form-01',
        quantidade_planejada_kg: 2000,
        quantidade_realizada_kg: 2005,
        misturador_id: 'misturador-01',
        tempo_mistura_segundos: 180,
        operador_id: user.user_id,
        iniciado_em: '2026-11-04T10:00:00.000Z',
        finalizado_em: '2026-11-04T10:15:00.000Z',
        desvio_peso_kg: 5
      }
    });

    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens['fabrica']}`
      },
      body: JSON.stringify(authorizedEnvelope(tokens['fabrica']!, envelope))
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.ack.status).toBe('COMMITTED');
  });

  it('Q2.2.8: deve aprovar com 200 Escritório executando seu próprio comando (escritorio.notas.registrar_entrada)', async () => {
    const user = SYNTHETIC_USERS['escritorio.lab@consubov.local']!;
    const mem = user.memberships[0]!;

    const envelope = createSyntheticCommandEnvelope({
      command_id: 'cmd-escritorio-legitimo-01',
      idempotency_key: 'idemp-escritorio-legitimo-01',
      user_id: user.user_id,
      tenant_id: mem.tenant_id,
      fazenda_id: mem.fazenda_id,
      profile_id: 'escritorio',
      command_type: 'escritorio.notas.registrar_entrada',
      aggregate_type: 'nota_fiscal', aggregate_id: 'nf-001',
      base_version: 0,
      payload: {
        nota_fiscal_id: 'nf-001',
        numero_nf: '12345',
        serie: '1',
        chave_acesso_nfe: '12345678901234567890123456789012345678901234',
        fornecedor_cnpj_cpf: '12345678000199',
        fornecedor_nome: 'Nutrição Animal Fornecedor Ltda',
        valor_total_brl: 45000,
        data_emissao: '2026-11-04T10:00:00.000Z',
        itens: [
          {
            produto_descricao: 'Milho Moído',
            quantidade: 100,
            unidade_medida: 'sc',
            valor_unitario_brl: 450,
            valor_total_item_brl: 45000
          }
        ]
      }
    });

    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens['escritorio']}`
      },
      body: JSON.stringify(authorizedEnvelope(tokens['escritorio']!, envelope))
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.ack.status).toBe('COMMITTED');
  });

  it('Q2.2.9: allowlist administrativa não concede grant operacional nem ACK de domínio inexistente', async () => {
    const user = SYNTHETIC_USERS['admin.lab@consubov.local']!;
    const mem = user.memberships[0]!;

    const envelope = createSyntheticCommandEnvelope({
      command_id: 'cmd-admin-legitimo-01',
      idempotency_key: 'idemp-admin-legitimo-01',
      user_id: user.user_id,
      tenant_id: mem.tenant_id,
      fazenda_id: mem.fazenda_id,
      profile_id: 'administrador',
      command_type: 'admin.tenants.criar',
      aggregate_id: 'global-saas',
      base_version: 0,
      payload: {
        tenant_id: 'tenant-novo-autorizado-01',
        razao_social: 'Agropecuária Nova Fronteira S/A',
        nome_fantasia: 'Nova Fronteira',
        cnpj: '11222333000199',
        plano: 'enterprise',
        limite_fazendas: 20,
        limite_cabecas: 50000,
        admin_email: 'contato@novafronteira.com',
        admin_nome: 'Gestor da Fronteira'
      }
    });

    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens['admin']}`
      },
      body: JSON.stringify(authorizedEnvelope(tokens['admin']!, envelope))
    });

    expect(isProfileAuthorizedForCommand('administrador', 'admin.tenants.criar')).toBe(true);
    expect(res.status).toBe(403);
    expect(apiInstance.ledger.queryLogs({ command_type: 'admin.tenants.criar' })).toHaveLength(0);
    const body: any = await res.json();
    expect(body.security.error).toBe('FORBIDDEN_403');
  });
});
