import { validateCommandPayload } from '@consubov/contracts';
import { loginApi, authorizedEnvelope } from '../harness/api-auth';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createApiServer } from '@consubov/platform-api';
import { allocateAvailablePort } from '../harness/port-allocator';
import { createSyntheticCommandEnvelope } from '../harness/synthetic-data';
import { signSyntheticJwt, SYNTHETIC_USERS } from '@consubov/auth-client';

describe('Gate Q2.3: Validação Estrita de Schemas Zod de Domínio na API Bun', () => {
  let apiInstance: ReturnType<typeof createApiServer>;
  let baseUrl: string;
  let tokenCapataz: string;
  let tokenGerente: string;
  let tokenEscritorio: string;
  let tokenAdmin: string;

  beforeAll(async () => {
    const port = await allocateAvailablePort(3420);
    apiInstance = createApiServer(port, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${port}`;

    const cap = SYNTHETIC_USERS['capataz.lab@consubov.local']!;
    tokenCapataz = (await loginApi(baseUrl, 'capataz')).tokens.access_token;

    const ger = SYNTHETIC_USERS['gerente.lab@consubov.local']!;
    tokenGerente = (await loginApi(baseUrl, 'gerente')).tokens.access_token;

    const esc = SYNTHETIC_USERS['escritorio.lab@consubov.local']!;
    tokenEscritorio = (await loginApi(baseUrl, 'escritorio')).tokens.access_token;

    const adm = SYNTHETIC_USERS['admin.lab@consubov.local']!;
    tokenAdmin = (await loginApi(baseUrl, 'administrador')).tokens.access_token;
  });

  afterAll(() => {
    if (apiInstance) {
      apiInstance.stop();
    }
  });

  it('Q2.3.1: deve rejeitar com 422 INVALID_DOMAIN_PAYLOAD quando sacos_fornecidos for negativo', async () => {
    const cap = SYNTHETIC_USERS['capataz.lab@consubov.local']!;
    const envelope = createSyntheticCommandEnvelope({
      user_id: cap.user_id,
      tenant_id: cap.memberships[0]!.tenant_id,
      fazenda_id: cap.memberships[0]!.fazenda_id,
      profile_id: 'capataz',
      command_type: 'capataz.cocho.registrar_escore',
      payload: {
        pasto_id: 'pasto-01',
        produto_id: 'prod-01',
        sacos_fornecidos: -5, // INVÁLIDO: negativo
        escore_cocho: 2
      }
    });

    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCapataz}`
      },
      body: JSON.stringify(authorizedEnvelope(tokenCapataz, envelope))
    });

    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.validation.violations[0].code).toBe('INVALID_DOMAIN_PAYLOAD');
  });

  it('Q2.3.2: deve rejeitar com 422 INVALID_DOMAIN_PAYLOAD quando escore_cocho estiver fora de 0..4', async () => {
    const cap = SYNTHETIC_USERS['capataz.lab@consubov.local']!;
    const envelope = createSyntheticCommandEnvelope({
      user_id: cap.user_id,
      tenant_id: cap.memberships[0]!.tenant_id,
      fazenda_id: cap.memberships[0]!.fazenda_id,
      profile_id: 'capataz',
      command_type: 'capataz.cocho.registrar_escore',
      payload: {
        pasto_id: 'pasto-01',
        produto_id: 'prod-01',
        sacos_fornecidos: 2,
        escore_cocho: 5 // INVÁLIDO: fora de 0..4
      }
    });

    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCapataz}`
      },
      body: JSON.stringify(authorizedEnvelope(tokenCapataz, envelope))
    });

    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.validation.violations[0].code).toBe('INVALID_DOMAIN_PAYLOAD');
  });

  it('Q2.3.3: deve rejeitar com 422 INVALID_DOMAIN_PAYLOAD quando gmd_alvo for negativo ou zero', async () => {
    const ger = SYNTHETIC_USERS['gerente.lab@consubov.local']!;
    const envelope = createSyntheticCommandEnvelope({
      user_id: ger.user_id,
      tenant_id: ger.memberships[0]!.tenant_id,
      fazenda_id: ger.memberships[0]!.fazenda_id,
      profile_id: 'gerente',
      command_type: 'gerente.metas.definir',
      payload: {
        lote_id: 'lote-01',
        gmd_alvo_kg_dia: -0.2, // INVÁLIDO: negativo
        peso_final_alvo_kg: 500,
        data_alvo_abate: '2026-12-01T00:00:00.000Z'
      }
    });

    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenGerente}`
      },
      body: JSON.stringify(authorizedEnvelope(tokenGerente, envelope))
    });

    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.validation.violations[0].code).toBe('INVALID_DOMAIN_PAYLOAD');
  });

  it('Q2.3.4: deve rejeitar com 422 INVALID_DOMAIN_PAYLOAD quando chave NF-e não possuir 44 dígitos', async () => {
    const esc = SYNTHETIC_USERS['escritorio.lab@consubov.local']!;
    const envelope = createSyntheticCommandEnvelope({
      user_id: esc.user_id,
      tenant_id: esc.memberships[0]!.tenant_id,
      fazenda_id: esc.memberships[0]!.fazenda_id,
      profile_id: 'escritorio',
      command_type: 'escritorio.notas.registrar_entrada',
      payload: {
        nota_fiscal_id: 'nf-002',
        numero_nf: '100',
        serie: '1',
        chave_acesso_nfe: '1234567890123456789012345678901234567890123', // INVÁLIDO: 43 dígitos
        fornecedor_cnpj_cpf: '12345678000199',
        fornecedor_nome: 'Fornecedor',
        valor_total_brl: 1000,
        data_emissao: '2026-11-04T00:00:00.000Z',
        itens: [
          {
            produto_descricao: 'Sal',
            quantidade: 10,
            unidade_medida: 'sc',
            valor_unitario_brl: 100,
            valor_total_item_brl: 1000
          }
        ]
      }
    });

    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenEscritorio}`
      },
      body: JSON.stringify(authorizedEnvelope(tokenEscritorio, envelope))
    });

    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.validation.violations[0].code).toBe('INVALID_DOMAIN_PAYLOAD');
  });

  it('Q2.3.5: deve rejeitar com 403 sem grant operacional; CNPJ inválido continua rejeitado pelo domínio', async () => {
    const adm = SYNTHETIC_USERS['admin.lab@consubov.local']!;
    const envelope = createSyntheticCommandEnvelope({
      user_id: adm.user_id,
      tenant_id: adm.memberships[0]!.tenant_id,
      fazenda_id: adm.memberships[0]!.fazenda_id,
      profile_id: 'administrador',
      command_type: 'admin.tenants.criar',
      payload: {
        tenant_id: 'tenant-novo-02',
        razao_social: 'Nova Agro S/A',
        nome_fantasia: 'Nova Agro',
        cnpj: '12345678901', // INVÁLIDO: 11 dígitos (CPF)
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
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify(authorizedEnvelope(tokenAdmin, envelope))
    });

    expect(res.status).toBe(403);
    expect(validateCommandPayload(envelope.command_type, envelope.payload).success).toBe(false);
    const body: any = await res.json();
    expect(body.security.error).toBe('FORBIDDEN_403');
  });

  it('Q2.3.6: deve rejeitar com 422 INVALID_DOMAIN_PAYLOAD injeção de propriedades extras (.strict)', async () => {
    const cap = SYNTHETIC_USERS['capataz.lab@consubov.local']!;
    const envelope = createSyntheticCommandEnvelope({
      user_id: cap.user_id,
      tenant_id: cap.memberships[0]!.tenant_id,
      fazenda_id: cap.memberships[0]!.fazenda_id,
      profile_id: 'capataz',
      command_type: 'capataz.cocho.registrar_escore',
      payload: {
        pasto_id: 'pasto-01',
        produto_id: 'prod-01',
        sacos_fornecidos: 2,
        escore_cocho: 2,
        campo_malicioso_injetado: 'DROP TABLE lotes;' // INVÁLIDO: violação de .strict()
      }
    });

    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCapataz}`
      },
      body: JSON.stringify(authorizedEnvelope(tokenCapataz, envelope))
    });

    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.validation.violations[0].code).toBe('INVALID_DOMAIN_PAYLOAD');
  });

  it('Q2.3.7: deve aprovar com 200 payload válido e estritamente conforme o contrato', async () => {
    const cap = SYNTHETIC_USERS['capataz.lab@consubov.local']!;
    const envelope = createSyntheticCommandEnvelope({
      command_id: 'cmd-valid-payload-01',
      idempotency_key: 'idemp-valid-payload-01',
      user_id: cap.user_id,
      tenant_id: cap.memberships[0]!.tenant_id,
      fazenda_id: cap.memberships[0]!.fazenda_id,
      profile_id: 'capataz',
      command_type: 'capataz.cocho.registrar_escore',
      aggregate_type: 'cocho', aggregate_id: 'pasto-conforme-01',
      base_version: 1,
      payload: {
        pasto_id: 'pasto-conforme-01',
        produto_id: 'prod-mineral-01',
        sacos_fornecidos: 3,
        escore_cocho: 2,
        observacao: 'Cocho em perfeitas condições.'
      }
    });

    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCapataz}`
      },
      body: JSON.stringify(authorizedEnvelope(tokenCapataz, envelope))
    });

    expect(res.status).toBe(200);
    const ack: any = await res.json();
    expect(ack.ack.status).toBe('COMMITTED');
    expect(ack.ack.aggregate_version).toBe(2);
  });
});
