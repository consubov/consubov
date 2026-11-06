import { loginApi, authorizedEnvelope } from '../harness/api-auth';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createApiServer } from '@consubov/platform-api';
import { allocateAvailablePort } from '../harness/port-allocator';
import { installNetworkGuard } from '../harness/network-guard';
import { signSyntheticJwt } from '@consubov/auth-client';
import { AtomicCommandEnvelope } from '@consubov/contracts';

describe('Q4.5: Barreira da API Local — Despacho Atômico Multidomínio, Zod, RBAC e OCC', () => {
  let restoreNetwork: () => void;
  let apiInstance: ReturnType<typeof createApiServer>;
  let baseUrl: string;

  let tokenGerente: string;
  let tokenEscritorio: string;
  let tokenFabrica: string;
  let tokenCapataz: string;

  beforeAll(async () => {
    // 1. Instala barreira anti-egress de rede estrita
    restoreNetwork = installNetworkGuard();

    // 2. Aloca porta efêmera e inicia API local
    const port = await allocateAvailablePort(3600);
    apiInstance = createApiServer(port, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${port}`;

    // 3. Emite tokens sintéticos para cada perfil de domínio
    tokenGerente = (await loginApi(baseUrl, 'gerente')).tokens.access_token;

    tokenEscritorio = (await loginApi(baseUrl, 'escritorio')).tokens.access_token;

    tokenFabrica = (await loginApi(baseUrl, 'fabrica')).tokens.access_token;

    tokenCapataz = (await loginApi(baseUrl, 'capataz')).tokens.access_token;
  });

  afterAll(() => {
    if (apiInstance) apiInstance.stop();
    if (restoreNetwork) restoreNetwork();
  });

  // ==========================================================================
  // CENÁRIO 1: DESPACHO DE COMANDOS DO MÓDULO GERENTE
  // ==========================================================================
  describe('Cenário 1: Comandos de Gerente (Metas, Curvas de GMD e Aprovação de Cocho)', () => {
    it('Q4.5.1: deve processar gerente.metas.definir e deduplicar idempotência com sucesso', async () => {
      const envelope: AtomicCommandEnvelope = {
        command_id: 'cmd-gerente-001',
        idempotency_key: 'idemp-gerente-001',
        command_type: 'gerente.metas.definir',
        aggregate_type: 'lote',
        aggregate_id: 'lote-recria-01',
        base_version: 0,
        user_id: 'user-gerente-synthetic',
        tenant_id: 'tenant-lab-001',
        product_id: 'consubov',
        fazenda_id: 'fazenda-guarani-01',
        retiro_id: null,
        profile_id: 'gerente',
        device_id: 'device-pwa-01',
        schema_version: 1,
        payload: {
          lote_id: 'lote-recria-01',
          gmd_alvo_kg_dia: 1.45,
          peso_final_alvo_kg: 510,
          data_alvo_abate: '2026-12-15T00:00:00.000Z',
          estrategia_nutricional: 'pasto_aguas',
          consumo_esperado_g_cab_dia: 1350
        },
        correlation_id: 'cmd-gerente-001',
        attachment_refs: [],
        occurred_at_local: '2026-11-05T08:00:00.000Z',
        status: 'PENDENTE',
        attempts: 0,
        last_attempt_at: null,
        error_message: null
      };

      // Primeiro envio -> ack 200, new_version 1
      const res1 = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenGerente}` },
        body: JSON.stringify(authorizedEnvelope(tokenGerente, envelope))
      });
      expect(res1.status).toBe(200);
      const ack1: any = await res1.json();
      expect(ack1.ack.status).toBe('COMMITTED');
      expect(ack1.ack.aggregate_version).toBe(1);
      expect(ack1.success).toBe(true);

      // Reenvio com a mesma chave -> replay idempotente 200
      const res2 = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenGerente}` },
        body: JSON.stringify(authorizedEnvelope(tokenGerente, envelope))
      });
      expect(res2.status).toBe(200);
      const ack2: any = await res2.json();
      expect(ack2).toEqual(ack1);
    });

    it('Q4.5.2: deve processar gerente.leitura_cocho.aprovar com sucesso', async () => {
      const envelope: AtomicCommandEnvelope = {
        command_id: 'cmd-gerente-cocho-001',
        idempotency_key: 'idemp-gerente-cocho-001',
        command_type: 'gerente.leitura_cocho.aprovar',
        aggregate_type: 'leitura_cocho',
        aggregate_id: 'leitura-001',
        base_version: 0,
        user_id: 'user-gerente-synthetic',
        tenant_id: 'tenant-lab-001',
        product_id: 'consubov',
        fazenda_id: 'fazenda-guarani-01',
        retiro_id: null,
        profile_id: 'gerente',
        device_id: 'device-pwa-01',
        schema_version: 1,
        payload: {
          leitura_cocho_id: 'leitura-001',
          pasto_id: 'pasto-04',
          status_aprovacao: 'aprovado',
          escore_revisado: 3,
          novo_fornecimento_sacos: 8,
          aprovado_em: '2026-11-05T09:00:00.000Z'
        },
        correlation_id: 'cmd-gerente-cocho-001',
        attachment_refs: [],
        occurred_at_local: '2026-11-05T09:00:00.000Z',
        status: 'PENDENTE',
        attempts: 0,
        last_attempt_at: null,
        error_message: null
      };

      const res = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenGerente}` },
        body: JSON.stringify(authorizedEnvelope(tokenGerente, envelope))
      });
      expect(res.status).toBe(200);
      const ack: any = await res.json();
      expect(ack.ack.status).toBe('COMMITTED');
    });
  });

  // ==========================================================================
  // CENÁRIO 2: DESPACHO DE COMANDOS DO MÓDULO ESCRITÓRIO
  // ==========================================================================
  describe('Cenário 2: Comandos de Escritório (Entrada de NF-e e Fechamento de Custos)', () => {
    it('Q4.5.3: deve validar chave 44 dígitos na entrada de NF-e (válida -> 200, inválida -> 422)', async () => {
      // NF com chave válida (44 dígitos)
      const validEnvelope: AtomicCommandEnvelope = {
        command_id: 'cmd-escritorio-nf-001',
        idempotency_key: 'idemp-escritorio-nf-001',
        command_type: 'escritorio.notas.registrar_entrada',
        aggregate_type: 'nota_fiscal',
        aggregate_id: 'nf-2026-888',
        base_version: 0,
        user_id: 'user-escritorio-synthetic',
        tenant_id: 'tenant-lab-001',
        product_id: 'consubov',
        fazenda_id: 'fazenda-guarani-01',
        retiro_id: null,
        profile_id: 'escritorio',
        device_id: 'device-pwa-01',
        schema_version: 1,
        payload: {
          nota_fiscal_id: 'nf-2026-888',
          numero_nf: '44556',
          serie: '1',
          chave_acesso_nfe: '35261100000000000000550010000445561000000010', // 44 dígitos
          fornecedor_cnpj_cpf: '12.345.678/0001-99',
          fornecedor_nome: 'NutriSoja Agrícola S/A',
          valor_total_brl: 85000,
          data_emissao: '2026-11-05T00:00:00.000Z',
          itens: [
            {
              produto_descricao: 'Farelo de Soja 46%',
              quantidade: 40,
              unidade_medida: 'ton',
              valor_unitario_brl: 2125,
              valor_total_item_brl: 85000
            }
          ]
        },
        correlation_id: 'cmd-escritorio-nf-001',
        attachment_refs: [],
        occurred_at_local: '2026-11-05T10:00:00.000Z',
        status: 'PENDENTE',
        attempts: 0,
        last_attempt_at: null,
        error_message: null
      };

      const resValid = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenEscritorio}` },
        body: JSON.stringify(authorizedEnvelope(tokenEscritorio, validEnvelope))
      });
      expect(resValid.status).toBe(200);

      // NF com chave inválida (42 dígitos) -> Fail-Closed 422 INVALID_DOMAIN_PAYLOAD
      const invalidEnvelope = {
        ...validEnvelope,
        command_id: 'cmd-escritorio-nf-invalid',
        idempotency_key: 'idemp-escritorio-nf-invalid',
        payload: {
          ...validEnvelope.payload,
          chave_acesso_nfe: '352611000000000000005500100004455610000000' // 42 dígitos
        }
      };

      const resInvalid = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenEscritorio}` },
        body: JSON.stringify(authorizedEnvelope(tokenEscritorio, invalidEnvelope))
      });
      expect(resInvalid.status).toBe(422);
      const err: any = await resInvalid.json();
      expect(err.validation.violations[0].code).toBe('INVALID_DOMAIN_PAYLOAD');
    });

    it('Q4.5.4: deve processar escritorio.custos.fechar com sucesso', async () => {
      const envelope: AtomicCommandEnvelope = {
        command_id: 'cmd-escritorio-custos-001',
        idempotency_key: 'idemp-escritorio-custos-001',
        command_type: 'escritorio.custos.fechar',
        aggregate_type: 'lote',
        aggregate_id: 'lote-recria-01',
        base_version: 0,
        user_id: 'user-escritorio-synthetic',
        tenant_id: 'tenant-lab-001',
        product_id: 'consubov',
        fazenda_id: 'fazenda-guarani-01',
        retiro_id: null,
        profile_id: 'escritorio',
        device_id: 'device-pwa-01',
        schema_version: 1,
        payload: {
          lote_id: 'lote-recria-01',
          periodo_mes: 10,
          periodo_ano: 2026,
          custo_nutricao_brl: 50000,
          custo_sanidade_brl: 12000,
          custo_pastagem_brl: 6000,
          custo_operacional_brl: 15000,
          valor_total_apropriado_brl: 83000,
          fechado_em: '2026-11-01T00:00:00.000Z'
        },
        correlation_id: 'cmd-escritorio-custos-001',
        attachment_refs: [],
        occurred_at_local: '2026-11-05T10:00:00.000Z',
        status: 'PENDENTE',
        attempts: 0,
        last_attempt_at: null,
        error_message: null
      };

      const res = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenEscritorio}` },
        body: JSON.stringify(authorizedEnvelope(tokenEscritorio, envelope))
      });
      expect(res.status).toBe(200);
      const ack: any = await res.json();
      expect(ack.ack.status).toBe('COMMITTED');
    });
  });

  // ==========================================================================
  // CENÁRIO 3: DESPACHO DE COMANDOS DO MÓDULO FÁBRICA
  // ==========================================================================
  describe('Cenário 3: Comandos de Fábrica (Iniciar/Concluir Batida e Calibração)', () => {
    it('Q4.5.5: deve processar ciclo de vida de batida (iniciar e concluir batida)', async () => {
      // 1. Iniciar Batida
      const envelopeIniciar: AtomicCommandEnvelope = {
        command_id: 'cmd-fabrica-bat-iniciar',
        idempotency_key: 'idemp-fabrica-bat-iniciar',
        command_type: 'fabrica.batidas.iniciar',
        aggregate_type: 'batida',
        aggregate_id: 'batida-prod-77',
        base_version: 0,
        user_id: 'user-fabrica-synthetic',
        tenant_id: 'tenant-lab-001',
        product_id: 'consubov',
        fazenda_id: 'fazenda-guarani-01',
        retiro_id: null,
        profile_id: 'fabrica',
        device_id: 'device-pwa-01',
        schema_version: 1,
        payload: {
          batida_id: 'batida-prod-77',
          ordem_producao_id: 'op-2026-777',
          formula_id: 'form-terminacao-22',
          misturador_id: 'misturador-01',
          quantidade_planejada_kg: 2000,
          operador_id: 'user-fabrica-synthetic',
          iniciado_em: '2026-11-05T08:00:00.000Z'
        },
        correlation_id: 'cmd-fabrica-bat-iniciar',
        attachment_refs: [],
        occurred_at_local: '2026-11-05T08:00:00.000Z',
        status: 'PENDENTE',
        attempts: 0,
        last_attempt_at: null,
        error_message: null
      };

      const resIniciar = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFabrica}` },
        body: JSON.stringify(authorizedEnvelope(tokenFabrica, envelopeIniciar))
      });
      expect(resIniciar.status).toBe(200);

      // 2. Concluir Batida (avança versão no agregado batida-prod-77)
      const envelopeConcluir: AtomicCommandEnvelope = {
        command_id: 'cmd-fabrica-bat-concluir',
        idempotency_key: 'idemp-fabrica-bat-concluir',
        command_type: 'fabrica.batidas.concluir',
        aggregate_type: 'batida',
        aggregate_id: 'batida-prod-77',
        base_version: 1, // OCC: avanço após início
        user_id: 'user-fabrica-synthetic',
        tenant_id: 'tenant-lab-001',
        product_id: 'consubov',
        fazenda_id: 'fazenda-guarani-01',
        retiro_id: null,
        profile_id: 'fabrica',
        device_id: 'device-pwa-01',
        schema_version: 1,
        payload: {
          batida_id: 'batida-prod-77',
          quantidade_realizada_kg: 2010,
          tempo_mistura_segundos: 240,
          finalizado_em: '2026-11-05T08:10:00.000Z',
          desvio_peso_kg: 10
        },
        correlation_id: 'cmd-fabrica-bat-concluir',
        attachment_refs: [],
        occurred_at_local: '2026-11-05T08:10:00.000Z',
        status: 'PENDENTE',
        attempts: 0,
        last_attempt_at: null,
        error_message: null
      };

      const resConcluir = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFabrica}` },
        body: JSON.stringify(authorizedEnvelope(tokenFabrica, envelopeConcluir))
      });
      expect(resConcluir.status).toBe(200);
      const ackConcluir: any = await resConcluir.json();
      expect(ackConcluir.ack.aggregate_version).toBe(2);
    });

    it('Q4.5.6: deve processar fabrica.balanca.calibrar com sucesso', async () => {
      const envelope: AtomicCommandEnvelope = {
        command_id: 'cmd-fabrica-calib-001',
        idempotency_key: 'idemp-fabrica-calib-001',
        command_type: 'fabrica.balanca.calibrar',
        aggregate_type: 'balanca',
        aggregate_id: 'balanca-01',
        base_version: 0,
        user_id: 'user-fabrica-synthetic',
        tenant_id: 'tenant-lab-001',
        product_id: 'consubov',
        fazenda_id: 'fazenda-guarani-01',
        retiro_id: null,
        profile_id: 'fabrica',
        device_id: 'device-pwa-01',
        schema_version: 1,
        payload: {
          balanca_id: 'balanca-01',
          equipamento_tipo: 'celula_carga_misturador',
          peso_padrao_afericao_kg: 1000,
          peso_medido_kg: 1002,
          desvio_percentual: 0.2,
          calibrado: true,
          proxima_calibracao_data: '2026-12-05T00:00:00.000Z',
          data_calibracao: '2026-11-05T07:00:00.000Z'
        },
        correlation_id: 'cmd-fabrica-calib-001',
        attachment_refs: [],
        occurred_at_local: '2026-11-05T07:00:00.000Z',
        status: 'PENDENTE',
        attempts: 0,
        last_attempt_at: null,
        error_message: null
      };

      const res = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFabrica}` },
        body: JSON.stringify(authorizedEnvelope(tokenFabrica, envelope))
      });
      expect(res.status).toBe(200);
    });
  });

  // ==========================================================================
  // CENÁRIO 4: SEGURANÇA RBAC FAIL-CLOSED & CONCORRÊNCIA OTIMISTA (OCC)
  // ==========================================================================
  describe('Cenário 4: Segurança RBAC Cruzada e Concorrência Otimista (OCC 409)', () => {
    it('Q4.5.7: deve rejeitar com 403 FORBIDDEN_COMMAND quando capataz tentar comando de gerente ou escritorio', async () => {
      const forbiddenEnvelope: AtomicCommandEnvelope = {
        command_id: 'cmd-spoof-001',
        idempotency_key: 'idemp-spoof-000001',
        command_type: 'gerente.metas.definir', // Proibido para capataz!
        aggregate_type: 'lote',
        aggregate_id: 'lote-recria-01',
        base_version: 0,
        user_id: 'user-capataz-synthetic',
        tenant_id: 'tenant-lab-001',
        product_id: 'consubov',
        fazenda_id: 'fazenda-guarani-01',
        retiro_id: null,
        profile_id: 'capataz',
        device_id: 'device-pwa-01',
        schema_version: 1,
        payload: {
          lote_id: 'lote-recria-01',
          gmd_alvo_kg_dia: 1.5,
          peso_final_alvo_kg: 500,
          data_alvo_abate: '2026-12-15T00:00:00.000Z',
          estrategia_nutricional: 'pasto_aguas',
          consumo_esperado_g_cab_dia: 1400
        },
        correlation_id: 'cmd-spoof-001',
        attachment_refs: [],
        occurred_at_local: '2026-11-05T08:00:00.000Z',
        status: 'PENDENTE',
        attempts: 0,
        last_attempt_at: null,
        error_message: null
      };

      const res = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCapataz}` },
        body: JSON.stringify(authorizedEnvelope(tokenCapataz, forbiddenEnvelope))
      });
      expect(res.status).toBe(403);
      const body: any = await res.json();
      expect(body.security.error).toBe('FORBIDDEN_403');
    });

    it('Q4.5.8: deve rejeitar com 409 CONCURRENCY_CONFLICT quando base_version divergir da versão do ledger', async () => {
      // O agregado 'batida-prod-77' já está na versão 2 (pós Q4.5.5)
      // Enviar com base_version: 0 deve gerar conflito 409 imediato
      const conflictingEnvelope: AtomicCommandEnvelope = {
        command_id: 'cmd-occ-conflict-001',
        idempotency_key: 'idemp-occ-conflict-001',
        command_type: 'fabrica.batidas.concluir',
        aggregate_type: 'batida',
        aggregate_id: 'batida-prod-77',
        base_version: 0, // Incorreto! Versão atual é 2
        user_id: 'user-fabrica-synthetic',
        tenant_id: 'tenant-lab-001',
        product_id: 'consubov',
        fazenda_id: 'fazenda-guarani-01',
        retiro_id: null,
        profile_id: 'fabrica',
        device_id: 'device-pwa-01',
        schema_version: 1,
        payload: {
          batida_id: 'batida-prod-77',
          quantidade_realizada_kg: 2000,
          tempo_mistura_segundos: 200,
          finalizado_em: '2026-11-05T08:15:00.000Z',
          desvio_peso_kg: 0
        },
        correlation_id: 'cmd-occ-conflict-001',
        attachment_refs: [],
        occurred_at_local: '2026-11-05T08:15:00.000Z',
        status: 'PENDENTE',
        attempts: 0,
        last_attempt_at: null,
        error_message: null
      };

      const res = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFabrica}` },
        body: JSON.stringify(authorizedEnvelope(tokenFabrica, conflictingEnvelope))
      });

      expect(res.status).toBe(409);
      const err: any = await res.json();
      expect(err.conflict.error).toBe('CONFLICT_409');
      expect(err.conflict.current_version).toBe(2);
      expect(err.conflict.base_version).toBe(0);
    });
  });
});
