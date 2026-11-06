import { createApiTestAccount, authorizedEnvelope } from '../harness/api-auth';
import { moduleSeedSnapshot } from '../harness/module-seed';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createApiServer } from '@consubov/platform-api';
import { allocateAvailablePort } from '../harness/port-allocator';
import { installNetworkGuard } from '../harness/network-guard';
import { signSyntheticJwt, SYNTHETIC_USERS } from '@consubov/auth-client';
import { AtomicCommandEnvelope, type ModuleExecutionContext, type ModuleLocalDataAPI, type LocalSnapshot, type LocalPendingCommand } from '@consubov/contracts';
import { FabricaStore } from '../../apps/fazenda/fabrica/src/store/fabricaStore';
import { InMemoryLedger } from '../../api/src/ledger/in-memory-ledger';

const fabricaTestContext: ModuleExecutionContext = {
  userId: 'user-fabrica-challenge', tenantId: 'tenant-test', farmId: 'farm-test', retreatId: null,
  moduleId: 'fabrica', profileId: 'fabrica', deviceId: 'device-fabrica-challenge', productId: 'consubov'
};
function makeFabricaLocalData(): ModuleLocalDataAPI {
  const snapshots: LocalSnapshot[] = [moduleSeedSnapshot('fabrica')];
  const commands: LocalPendingCommand[] = [];
  return {
    readSnapshot: async () => null,
    listSnapshots: async <T,>() => snapshots as LocalSnapshot<T>[],
    commitMutation: async mutation => {
      snapshots.push(mutation.snapshot);
      commands.push({ command: mutation.command as unknown as LocalPendingCommand['command'], attachmentRefs: mutation.command.attachment_refs });
      return { commandId: mutation.command.command_id, committed: true };
    },
    readAttachment: async () => null,
    listPendingCommands: async limit => commands.slice(0, limit),
    getCursor: async () => null,
    getSchemaVersion: async () => 1
  };
}

describe('Adversarial Challenger Suite: FASE 04 — OCC Concorrência Hostil, Integridade do Ledger e Limites Extremos Zod', () => {
  let restoreNetwork: () => void;
  let apiInstance: ReturnType<typeof createApiServer>;
  let baseUrl: string;

  // Tokens para múltiplos tenants e perfis
  let tokenTenantAlphaGerente: string;
  let tokenTenantAlphaEscritorio: string;
  let tokenTenantAlphaFabrica: string;
  let tokenTenantAlphaCapataz: string;
  let tokenTenantBetaEscritorio: string;
  let tokenTenantBetaFabrica: string;

  beforeAll(async () => {
    // 1. Barreira de isolamento anti-egress de rede
    restoreNetwork = installNetworkGuard();

    // 2. Alocação de porta efêmera e servidor API
    const port = await allocateAvailablePort(3650);
    apiInstance = createApiServer(port, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${port}`;

    // 3. Emissão de tokens para Tenant Alpha
    tokenTenantAlphaGerente = (await createApiTestAccount(baseUrl, 'gerente', { email: 'q4-alpha-gerente@test.local', userId: 'user-alpha-gerente', tenantId: 'tenant-lab-alpha', farmId: 'fazenda-alpha-01' })).tokens.access_token;

    tokenTenantAlphaEscritorio = (await createApiTestAccount(baseUrl, 'escritorio', { email: 'q4-alpha-escritorio@test.local', userId: 'user-alpha-escritorio', tenantId: 'tenant-lab-alpha', farmId: 'fazenda-alpha-01' })).tokens.access_token;

    tokenTenantAlphaFabrica = (await createApiTestAccount(baseUrl, 'fabrica', { email: 'q4-alpha-fabrica@test.local', userId: 'user-alpha-fabrica', tenantId: 'tenant-lab-alpha', farmId: 'fazenda-alpha-01' })).tokens.access_token;

    tokenTenantAlphaCapataz = (await createApiTestAccount(baseUrl, 'capataz', { email: 'q4-alpha-capataz@test.local', userId: 'user-alpha-capataz', tenantId: 'tenant-lab-alpha', farmId: 'fazenda-alpha-01' })).tokens.access_token;

    // 4. Emissão de tokens para Tenant Beta (para testes cross-tenant)
    tokenTenantBetaEscritorio = (await createApiTestAccount(baseUrl, 'escritorio', { email: 'q4-beta-escritorio@test.local', userId: 'user-beta-escritorio', tenantId: 'tenant-lab-beta', farmId: 'fazenda-beta-01' })).tokens.access_token;

    tokenTenantBetaFabrica = (await createApiTestAccount(baseUrl, 'fabrica', { email: 'q4-beta-fabrica@test.local', userId: 'user-beta-fabrica', tenantId: 'tenant-lab-beta', farmId: 'fazenda-beta-01' })).tokens.access_token;
  });

  afterAll(() => {
    for (const email of Object.keys(SYNTHETIC_USERS)) if (email.startsWith('q4-') && email.endsWith('@test.local')) delete SYNTHETIC_USERS[email];
    if (apiInstance) apiInstance.stop();
    if (restoreNetwork) restoreNetwork();
  });

  // ==========================================================================
  // BLOCO 1: RAJADA DE COMANDOS CONCORRENTES & CONCORRÊNCIA OTIMISTA OCC (409)
  // ==========================================================================
  describe('Bloco 1: Estresse Hostil de Concorrência OCC e Integridade do Ledger', () => {
    it('CHALLENGE-1.1: Rajada de 20 comandos simultâneos com base_version=0 para o MESMO agregado -> Exatamente 1 ack 200 e 19 conflitos 409', async () => {
      const aggregateId = 'batida-burst-occ-001';
      const burstSize = 20;

      // Monta 20 envelopes com mesma base_version (0), mas IDs e chaves de idempotência únicos
      const promises = Array.from({ length: burstSize }).map((_, index) => {
        const envelope: AtomicCommandEnvelope = {
          command_id: `cmd-burst-${index}`,
          idempotency_key: `idemp-burst-${index}-${Date.now()}-length-padded`,
          command_type: 'fabrica.batidas.iniciar',
          aggregate_type: 'batida',
          aggregate_id: aggregateId,
          base_version: 0, // Todos tentam vencer a versão 0 concorrentemente!
          user_id: 'user-alpha-fabrica',
          tenant_id: 'tenant-lab-alpha',
          product_id: 'consubov',
          fazenda_id: 'fazenda-alpha-01',
          retiro_id: null,
          profile_id: 'fabrica',
          device_id: `device-client-${index}`,
          schema_version: 1,
          payload: {
            batida_id: aggregateId,
            ordem_producao_id: 'op-burst-777',
            formula_id: 'form-terminacao-22',
            misturador_id: 'misturador-01',
            quantidade_planejada_kg: 2000,
            operador_id: 'user-alpha-fabrica',
            iniciado_em: '2026-11-05T08:00:00.000Z'
          },
          correlation_id: `corr-burst-${index}`,
          attachment_refs: [],
          occurred_at_local: '2026-11-05T08:00:00.000Z',
          status: 'PENDENTE',
          attempts: 0,
          last_attempt_at: null,
          error_message: null
        };

        return fetch(`${baseUrl}/api/v1/commands`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenTenantAlphaFabrica}`
          },
          body: JSON.stringify(authorizedEnvelope(tokenTenantAlphaFabrica, envelope))
        });
      });

      // Dispara a rajada concorrente via Promise.all
      const responses = await Promise.all(promises);

      const status200 = responses.filter(r => r.status === 200);
      const status409 = responses.filter(r => r.status === 409);

      // Asserções empíricas estritas
      expect(status200.length).toBe(1);
      expect(status409.length).toBe(burstSize - 1);

      // Valida o ACK vitorioso
      const winner = status200[0];
      expect(winner).toBeDefined();
      if (!winner) throw new Error('Vencedor da concorrência não encontrado');
      const ackWinner: any = await winner.json();
      expect(ackWinner.ack.status).toBe('COMMITTED');
      expect(ackWinner.ack.aggregate_version).toBe(1);
      expect(ackWinner.success).toBe(true);

      // Valida que TODOS os perdedores receberam CONCURRENCY_CONFLICT
      for (const res409 of status409) {
        const body: any = await res409.json();
        expect(body.conflict.error).toBe('CONFLICT_409');
        expect(body.conflict.current_version).toBe(1);
        expect(body.conflict.base_version).toBe(0);
      }
    });

    it('CHALLENGE-1.2: Comando subsequente com base_version=1 avança versão para 2; reenvio com versão defasada é barrado com 409', async () => {
      const aggregateId = 'batida-burst-occ-001';

      // 1. Comando válido com base_version=1
      const envelopeV1: AtomicCommandEnvelope = {
        command_id: 'cmd-burst-subsequent-001',
        idempotency_key: `idemp-burst-subsequent-${Date.now()}-padded`,
        command_type: 'fabrica.batidas.concluir',
        aggregate_type: 'batida',
        aggregate_id: aggregateId,
        base_version: 1, // Correto, avança de 1 para 2
        user_id: 'user-alpha-fabrica',
        tenant_id: 'tenant-lab-alpha',
        product_id: 'consubov',
        fazenda_id: 'fazenda-alpha-01',
        retiro_id: null,
        profile_id: 'fabrica',
        device_id: 'device-client-1',
        schema_version: 1,
        payload: {
          batida_id: aggregateId,
          quantidade_realizada_kg: 2005,
          tempo_mistura_segundos: 180,
          finalizado_em: '2026-11-05T08:15:00.000Z',
          desvio_peso_kg: 5
        },
        correlation_id: 'corr-burst-subsequent',
        attachment_refs: [],
        occurred_at_local: '2026-11-05T08:15:00.000Z',
        status: 'PENDENTE',
        attempts: 0,
        last_attempt_at: null,
        error_message: null
      };

      const resV1 = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTenantAlphaFabrica}`
        },
        body: JSON.stringify(authorizedEnvelope(tokenTenantAlphaFabrica, envelopeV1))
      });
      expect(resV1.status).toBe(200);
      const ackV1: any = await resV1.json();
      expect(ackV1.ack.aggregate_version).toBe(2);

      // 2. Tentativa hostil com base_version defasada (base_version=0 ou base_version=1)
      const staleEnvelope: AtomicCommandEnvelope = {
        ...envelopeV1,
        command_id: 'cmd-burst-stale-002',
        idempotency_key: `idemp-burst-stale-${Date.now()}-padded`,
        base_version: 1 // Defasado! Atual é 2
      };

      const resStale = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTenantAlphaFabrica}`
        },
        body: JSON.stringify(authorizedEnvelope(tokenTenantAlphaFabrica, staleEnvelope))
      });
      expect(resStale.status).toBe(409);
      const bodyStale: any = await resStale.json();
      expect(bodyStale.conflict.error).toBe('CONFLICT_409');
      expect(bodyStale.conflict.current_version).toBe(2);
      expect(bodyStale.conflict.base_version).toBe(1);
    });

    it('CHALLENGE-1.3: Rajada concorrente com 10 agregados DISTINTOS em paralelo -> TODOS os 10 devem ter sucesso (lock granular por agregado)', async () => {
      const distinctAggregates = Array.from({ length: 10 }).map((_, i) => `batida-granular-${i}-${Date.now()}`);

      const promises = distinctAggregates.map((aggId, idx) => {
        const envelope: AtomicCommandEnvelope = {
          command_id: `cmd-granular-${idx}`,
          idempotency_key: `idemp-granular-${idx}-${Date.now()}-padded`,
          command_type: 'fabrica.batidas.iniciar',
          aggregate_type: 'batida',
          aggregate_id: aggId,
          base_version: 0,
          user_id: 'user-alpha-fabrica',
          tenant_id: 'tenant-lab-alpha',
          product_id: 'consubov',
          fazenda_id: 'fazenda-alpha-01',
          retiro_id: null,
          profile_id: 'fabrica',
          device_id: `device-client-${idx}`,
          schema_version: 1,
          payload: {
            batida_id: aggId,
            ordem_producao_id: `op-granular-${idx}`,
            formula_id: 'form-terminacao-22',
            misturador_id: 'misturador-01',
            quantidade_planejada_kg: 1000,
            operador_id: 'user-alpha-fabrica',
            iniciado_em: '2026-11-05T08:00:00.000Z'
          },
          correlation_id: `corr-granular-${idx}`,
          attachment_refs: [],
          occurred_at_local: '2026-11-05T08:00:00.000Z',
          status: 'PENDENTE',
          attempts: 0,
          last_attempt_at: null,
          error_message: null
        };

        return fetch(`${baseUrl}/api/v1/commands`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenTenantAlphaFabrica}`
          },
          body: JSON.stringify(authorizedEnvelope(tokenTenantAlphaFabrica, envelope))
        });
      });

      const responses = await Promise.all(promises);

      // Nenhum deve sofrer conflito 409 falso-positivo pois são agregados distintos
      for (const res of responses) {
        expect(res.status).toBe(200);
        const data: any = await res.json();
        expect(data.ack.status).toBe('COMMITTED');
        expect(data.ack.aggregate_version).toBe(1);
      }
    });

    it('CHALLENGE-1.4: Integridade pura do InMemoryLedger sob estresse de chamadas diretas', () => {
      const ledger = new InMemoryLedger();
      const tenantId = 'tenant-stress-pure';
      const aggId = 'pure-agg-1';

      // Criar envelope base
      const createTestEnv = (cmdId: string, idempKey: string, baseVer: number): AtomicCommandEnvelope => ({
        command_id: cmdId,
        idempotency_key: idempKey,
        command_type: 'fabrica.batidas.iniciar',
        aggregate_type: 'batida',
        aggregate_id: aggId,
        base_version: baseVer,
        user_id: 'user-1',
        tenant_id: tenantId,
        product_id: 'consubov',
        fazenda_id: 'faz-1',
        retiro_id: null,
        profile_id: 'fabrica',
        device_id: 'dev-1',
        schema_version: 1,
        payload: {
          batida_id: aggId,
          ordem_producao_id: 'op-1',
          formula_id: 'form-1',
          misturador_id: 'm-1',
          quantidade_planejada_kg: 500,
          operador_id: 'op-1',
          iniciado_em: '2026-11-05T08:00:00.000Z'
        },
        correlation_id: cmdId,
        attachment_refs: [],
        occurred_at_local: '2026-11-05T08:00:00.000Z',
        status: 'PENDENTE',
        attempts: 0,
        last_attempt_at: null,
        error_message: null
      });

      ledger.initialize({ ...createTestEnv('seed', 'seed-idempotency-key', 0), session_id: 'unit-seed' }, moduleSeedSnapshot('fabrica').data, '2026-11-05T08:00:00.000Z');
      // Primeiro comando aplica a projeção real e avança a versão.
      const res1 = ledger.processCommand(createTestEnv('c1', 'idemp1-uuid-padded', 0));
      expect(res1.success).toBe(true);
      if (res1.success) {
        expect(res1.ack.aggregate_version).toBe(1);
        expect(res1.ack.status).toBe('COMMITTED');
      }
      expect(ledger.getAggregateVersion(tenantId, 'batida', aggId)).toBe(1);

      // Replay do mesmo comando (mesma idempKey) -> sucesso idempotente
      const res1Replay = ledger.processCommand(createTestEnv('c1', 'idemp1-uuid-padded', 0));
      expect(res1Replay.success).toBe(true);
      if (res1Replay.success) {
        if (res1.success) expect(res1Replay.ack).toEqual(res1.ack);
        expect(res1Replay.ack.aggregate_version).toBe(1);
      }

      // Comando concorrente com nova chave mas base_version defasada (0) -> 409
      const resStale = ledger.processCommand(createTestEnv('c2', 'idemp2-uuid-padded', 0));
      expect(resStale.success).toBe(false);
      if (!resStale.success) {
        expect(resStale.status).toBe(409);
        expect('conflict' in resStale.error && resStale.error.conflict.error).toBe('CONFLICT_409');
      }

      // Comando futuro com base_version saltada (99) -> 409
      const resFuture = ledger.processCommand(createTestEnv('c3', 'idemp3-uuid-padded', 99));
      expect(resFuture.success).toBe(false);
      if (!resFuture.success) {
        expect(resFuture.status).toBe(409);
        expect('conflict' in resFuture.error && resFuture.error.conflict.error).toBe('CONFLICT_409');
      }

      // Comando correto com base_version 1 -> avança para 2
      const res2 = ledger.processCommand(createTestEnv('c4', 'idemp4-uuid-padded', 1));
      expect(res2.success).toBe(true);
      if (res2.success) {
        expect(res2.ack.aggregate_version).toBe(2);
      }
      expect(ledger.getAggregateVersion(tenantId, 'batida', aggId)).toBe(2);
    });
  });

  // ==========================================================================
  // BLOCO 2: LIMITES EXTREMOS DE VALIDAÇÃO ZOD HOSTIS & INJEÇÃO DE BORDAS
  // ==========================================================================
  describe('Bloco 2: Limites Extremos de Validação Zod Hostis (NF-e, Fórmulas, Estoque, Pesagem)', () => {
    // 2.1 Injeção de NF-e
    describe('2.1 Limites de NF-e (Chave de Acesso, Valores e Itens)', () => {
      const baseNfPayload = {
        nota_fiscal_id: 'nf-stress-001',
        numero_nf: '12345',
        serie: '1',
        chave_acesso_nfe: '35261100000000000000550010000445561000000010', // 44 dígitos
        fornecedor_cnpj_cpf: '12.345.678/0001-99',
        fornecedor_nome: 'NutriFornecedor S/A',
        valor_total_brl: 50000,
        data_emissao: '2026-11-05T00:00:00.000Z',
        itens: [
          {
            produto_descricao: 'Milho Moído a Granel',
            quantidade: 25,
            unidade_medida: 'ton' as const,
            valor_unitario_brl: 2000,
            valor_total_item_brl: 50000
          }
        ]
      };

      const sendNf = (payloadOverride: Record<string, unknown>, cmdId = `cmd-nf-${Date.now()}`) => {
        const envelope: AtomicCommandEnvelope = {
          command_id: cmdId,
          idempotency_key: `idemp-nf-${cmdId}-uuid-padded`,
          command_type: 'escritorio.notas.registrar_entrada',
          aggregate_type: 'nota_fiscal',
          aggregate_id: 'nf-stress-001',
          base_version: 0,
          user_id: 'user-alpha-escritorio',
          tenant_id: 'tenant-lab-alpha',
          product_id: 'consubov',
          fazenda_id: 'fazenda-alpha-01',
          retiro_id: null,
          profile_id: 'escritorio',
          device_id: 'dev-1',
          schema_version: 1,
          payload: { ...baseNfPayload, ...payloadOverride },
          correlation_id: cmdId,
          attachment_refs: [],
          occurred_at_local: '2026-11-05T08:00:00.000Z',
          status: 'PENDENTE',
          attempts: 0,
          last_attempt_at: null,
          error_message: null
        };

        return fetch(`${baseUrl}/api/v1/commands`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenTenantAlphaEscritorio}`
          },
          body: JSON.stringify(authorizedEnvelope(tokenTenantAlphaEscritorio, envelope))
        });
      };

      it('CHALLENGE-2.1.1: Chave de NF-e com 43 dígitos numéricos é sumariamente rejeitada com 422', async () => {
        const res = await sendNf({
          chave_acesso_nfe: '3526110000000000000055001000044556100000001' // 43 dígitos
        });
        expect(res.status).toBe(422);
        const body: any = await res.json();
        expect(body.validation.violations[0].code).toBe('INVALID_DOMAIN_PAYLOAD');
        expect(JSON.stringify(body.validation.violations)).toContain('44 dígitos');
      });

      it('CHALLENGE-2.1.2: Chave de NF-e com 45 dígitos numéricos é sumariamente rejeitada com 422', async () => {
        const res = await sendNf({
          chave_acesso_nfe: '352611000000000000005500100004455610000000100' // 45 dígitos
        });
        expect(res.status).toBe(422);
        const body: any = await res.json();
        expect(body.validation.violations[0].code).toBe('INVALID_DOMAIN_PAYLOAD');
      });

      it('CHALLENGE-2.1.3: Chave de NF-e com 44 caracteres contendo letras ou símbolos é rejeitada com 422', async () => {
        // Letra maiúscula no meio
        const resLetter = await sendNf({
          chave_acesso_nfe: '3526110000000000000055001000044556100000001X'
        });
        expect(resLetter.status).toBe(422);

        // Espaço ou hífen
        const resSpecial = await sendNf({
          chave_acesso_nfe: '3526110000000000000055001000044556100000001 '
        });
        expect(resSpecial.status).toBe(422);
      });

      it('CHALLENGE-2.1.4: Valor total da NF-e negativo ou zero é rejeitado com 422', async () => {
        const resNegative = await sendNf({ valor_total_brl: -100 });
        expect(resNegative.status).toBe(422);

        const resZero = await sendNf({ valor_total_brl: 0 });
        expect(resZero.status).toBe(422);
      });

      it('CHALLENGE-2.1.5: NF-e com array de itens vazio é rejeitada com 422', async () => {
        const resEmpty = await sendNf({ itens: [] });
        expect(resEmpty.status).toBe(422);
      });

      it('CHALLENGE-2.1.6: Item da NF-e com quantidade ou valor unitário negativo/zero é rejeitado com 422', async () => {
        const resBadItemQty = await sendNf({
          itens: [
            {
              produto_descricao: 'Sal Mineral',
              quantidade: -5,
              unidade_medida: 'sc' as const,
              valor_unitario_brl: 85,
              valor_total_item_brl: 425
            }
          ]
        });
        expect(resBadItemQty.status).toBe(422);

        const resBadItemPrice = await sendNf({
          itens: [
            {
              produto_descricao: 'Sal Mineral',
              quantidade: 10,
              unidade_medida: 'sc' as const,
              valor_unitario_brl: 0,
              valor_total_item_brl: 0
            }
          ]
        });
        expect(resBadItemPrice.status).toBe(422);
      });
    });

    // 2.2 Fórmulas Nutricionais e Inclusão 100%
    describe('2.2 Limites de Fórmulas e Inclusão Nutricional (Store vs API Zod Schema)', () => {
      it('CHALLENGE-2.2.1: FabricaStore.salvarFormula REJEITA categoricamente fórmula com soma 99.9% de inclusão', () => {
        const store = new FabricaStore(fabricaTestContext, makeFabricaLocalData());

        expect(() => {
          store.salvarFormula({
            formula_id: 'form-sub-99',
            nome_formula: 'Fórmula Incompleta 99.9%',
            tipo_raca_destino: 'racao_confinamento',
            tamanho_batida_padrao_kg: 2000,
            ativo: true,
            ingredientes: [
              { materia_prima_id: 'mp-milho', nome_ingrediente: 'Milho Moído', porcentagem_inclusao: 65 },
              { materia_prima_id: 'mp-soja', nome_ingrediente: 'Farelo Soja', porcentagem_inclusao: 25 },
              { materia_prima_id: 'mp-nucleo', nome_ingrediente: 'Núcleo', porcentagem_inclusao: 7 },
              { materia_prima_id: 'mp-calcario', nome_ingrediente: 'Calcário', porcentagem_inclusao: 2.9 } // Total: 99.9%
            ]
          });
        }).toThrow('Soma das porcentagens de inclusão deve ser exatamente 100%');
      });

      it('CHALLENGE-2.2.2: FabricaStore.salvarFormula REJEITA categoricamente fórmula com soma 100.1% de inclusão', () => {
        const store = new FabricaStore(fabricaTestContext, makeFabricaLocalData());

        expect(() => {
          store.salvarFormula({
            formula_id: 'form-over-1001',
            nome_formula: 'Fórmula Excedente 100.1%',
            tipo_raca_destino: 'racao_confinamento',
            tamanho_batida_padrao_kg: 2000,
            ativo: true,
            ingredientes: [
              { materia_prima_id: 'mp-milho', nome_ingrediente: 'Milho Moído', porcentagem_inclusao: 65 },
              { materia_prima_id: 'mp-soja', nome_ingrediente: 'Farelo Soja', porcentagem_inclusao: 25 },
              { materia_prima_id: 'mp-nucleo', nome_ingrediente: 'Núcleo', porcentagem_inclusao: 7 },
              { materia_prima_id: 'mp-calcario', nome_ingrediente: 'Calcário', porcentagem_inclusao: 3.1 } // Total: 100.1%
            ]
          });
        }).toThrow('Soma das porcentagens de inclusão deve ser exatamente 100%');
      });

      it('CHALLENGE-2.2.3: FabricaStore.salvarFormula ACEITA fórmula com soma exatamente 100.0% e gera envelope atômico', async () => {
        const store = new FabricaStore(fabricaTestContext, makeFabricaLocalData());

        await store.ready;
        const envelope = await store.salvarFormula({
          formula_id: 'form-exact-100',
          nome_formula: 'Fórmula Perfeita 100.0%',
          tipo_raca_destino: 'racao_confinamento',
          tamanho_batida_padrao_kg: 2000,
          ativo: true,
          ingredientes: [
            { materia_prima_id: 'mp-milho', nome_ingrediente: 'Milho Moído', porcentagem_inclusao: 65 },
            { materia_prima_id: 'mp-soja', nome_ingrediente: 'Farelo Soja', porcentagem_inclusao: 25 },
            { materia_prima_id: 'mp-nucleo', nome_ingrediente: 'Núcleo', porcentagem_inclusao: 7 },
            { materia_prima_id: 'mp-calcario', nome_ingrediente: 'Calcário', porcentagem_inclusao: 3.0 } // Total: 100.0%
          ]
        });

        expect(envelope).toBeDefined();
        expect(envelope.command_type).toBe('fabrica.formulas.salvar');
        expect(envelope.aggregate_id).toBe('form-exact-100');
        expect(store.getState().formulas.some(f => f.formula_id === 'form-exact-100')).toBe(true);
      });

      it('CHALLENGE-2.2.4: API rejeita via Zod ingrediente com porcentagem de inclusão negativa ou zero', async () => {
        const envelope: AtomicCommandEnvelope = {
          command_id: 'cmd-formula-negative-pct',
          idempotency_key: `idemp-form-neg-${Date.now()}-padded`,
          command_type: 'fabrica.formulas.salvar',
          aggregate_type: 'formula',
          aggregate_id: 'form-invalid-pct',
          base_version: 0,
          user_id: 'user-alpha-fabrica',
          tenant_id: 'tenant-lab-alpha',
          product_id: 'consubov',
          fazenda_id: 'fazenda-alpha-01',
          retiro_id: null,
          profile_id: 'fabrica',
          device_id: 'dev-1',
          schema_version: 1,
          payload: {
            formula_id: 'form-invalid-pct',
            nome_formula: 'Fórmula Negativa',
            tipo_raca_destino: 'racao_confinamento',
            tamanho_batida_padrao_kg: 2000,
            ativo: true,
            ingredientes: [
              { materia_prima_id: 'mp-milho', nome_ingrediente: 'Milho', porcentagem_inclusao: -10 }
            ]
          },
          correlation_id: 'cmd-formula-negative-pct',
          attachment_refs: [],
          occurred_at_local: '2026-11-05T08:00:00.000Z',
          status: 'PENDENTE',
          attempts: 0,
          last_attempt_at: null,
          error_message: null
        };

        const res = await fetch(`${baseUrl}/api/v1/commands`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenTenantAlphaFabrica}`
          },
          body: JSON.stringify(authorizedEnvelope(tokenTenantAlphaFabrica, envelope))
        });
        expect(res.status).toBe(422);
        const body: any = await res.json();
        expect(body.validation.violations[0].code).toBe('INVALID_DOMAIN_PAYLOAD');
      });

      it('CHALLENGE-2.2.5: API rejeita via Zod ingrediente com porcentagem de inclusão maior que 100%', async () => {
        const envelope: AtomicCommandEnvelope = {
          command_id: 'cmd-formula-over-100',
          idempotency_key: `idemp-form-over-${Date.now()}-padded`,
          command_type: 'fabrica.formulas.salvar',
          aggregate_type: 'formula',
          aggregate_id: 'form-invalid-over',
          base_version: 0,
          user_id: 'user-alpha-fabrica',
          tenant_id: 'tenant-lab-alpha',
          product_id: 'consubov',
          fazenda_id: 'fazenda-alpha-01',
          retiro_id: null,
          profile_id: 'fabrica',
          device_id: 'dev-1',
          schema_version: 1,
          payload: {
            formula_id: 'form-invalid-over',
            nome_formula: 'Fórmula Excedente',
            tipo_raca_destino: 'racao_confinamento',
            tamanho_batida_padrao_kg: 2000,
            ativo: true,
            ingredientes: [
              { materia_prima_id: 'mp-milho', nome_ingrediente: 'Milho', porcentagem_inclusao: 105 }
            ]
          },
          correlation_id: 'cmd-formula-over-100',
          attachment_refs: [],
          occurred_at_local: '2026-11-05T08:00:00.000Z',
          status: 'PENDENTE',
          attempts: 0,
          last_attempt_at: null,
          error_message: null
        };

        const res = await fetch(`${baseUrl}/api/v1/commands`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenTenantAlphaFabrica}`
          },
          body: JSON.stringify(authorizedEnvelope(tokenTenantAlphaFabrica, envelope))
        });
        expect(res.status).toBe(422);
      });

      it('CHALLENGE-2.2.6: API central Zod schema fabrica.formulas.salvar rejeita via .refine() fórmula com soma 99.9%', async () => {
        // Envio direto para a API de um envelope com soma de ingredientes = 99.9%
        const envelope99: AtomicCommandEnvelope = {
          command_id: 'cmd-form-unrefined-99',
          idempotency_key: `idemp-form-unrefined-99-${Date.now()}`,
          command_type: 'fabrica.formulas.salvar',
          aggregate_type: 'formula',
          aggregate_id: 'formula-unrefined-99',
          base_version: 0,
          user_id: 'user-alpha-fabrica',
          tenant_id: 'tenant-lab-alpha',
          product_id: 'consubov',
          fazenda_id: 'fazenda-alpha-01',
          retiro_id: null,
          profile_id: 'fabrica',
          device_id: 'dev-1',
          schema_version: 1,
          payload: {
            formula_id: 'formula-unrefined-99',
            nome_formula: 'Fórmula Incompleta 99.9%',
            tipo_raca_destino: 'racao_confinamento',
            tamanho_batida_padrao_kg: 2000,
            ativo: true,
            ingredientes: [
              { materia_prima_id: 'mp-milho', nome_ingrediente: 'Milho Moído', porcentagem_inclusao: 65 },
              { materia_prima_id: 'mp-soja', nome_ingrediente: 'Farelo Soja', porcentagem_inclusao: 25 },
              { materia_prima_id: 'mp-nucleo', nome_ingrediente: 'Núcleo', porcentagem_inclusao: 7 },
              { materia_prima_id: 'mp-calcario', nome_ingrediente: 'Calcário', porcentagem_inclusao: 2.9 } // Total: 99.9%
            ]
          },
          correlation_id: 'corr-unrefined-99',
          attachment_refs: [],
          occurred_at_local: '2026-11-05T08:00:00.000Z',
          status: 'PENDENTE',
          attempts: 0,
          last_attempt_at: null,
          error_message: null
        };

        const res = await fetch(`${baseUrl}/api/v1/commands`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenTenantAlphaFabrica}`
          },
          body: JSON.stringify(authorizedEnvelope(tokenTenantAlphaFabrica, envelope99))
        });

        // Comprovação da correção:
        // A barreira central Zod da API (packages/contracts/src/validation/commands.schema.ts)
        // agora rejeita com 422 INVALID_DOMAIN_PAYLOAD graças ao .refine() verificando que soma fecha em 100%.
        expect(res.status).toBe(422);
        const body: any = await res.json();
        expect(body.validation.violations[0].code).toBe('INVALID_DOMAIN_PAYLOAD');
      });
    });

    // 2.3 Estoque Negativo e Movimentações
    describe('2.3 Limites de Estoque e Baixa de Insumos', () => {
      it('CHALLENGE-2.3.1: Ajuste de estoque com quantidade negativa é rejeitado via Zod com 422', async () => {
        const envelope: AtomicCommandEnvelope = {
          command_id: 'cmd-stock-negative',
          idempotency_key: `idemp-stock-neg-${Date.now()}-padded`,
          command_type: 'fabrica.estoque.ajustar',
          aggregate_type: 'estoque_materia_prima',
          aggregate_id: 'mp-milho',
          base_version: 0,
          user_id: 'user-alpha-fabrica',
          tenant_id: 'tenant-lab-alpha',
          product_id: 'consubov',
          fazenda_id: 'fazenda-alpha-01',
          retiro_id: null,
          profile_id: 'fabrica',
          device_id: 'dev-1',
          schema_version: 1,
          payload: {
            materia_prima_id: 'mp-milho',
            silo_id: 'silo-01',
            quantidade_anterior_kg: 1000,
            quantidade_ajustada_kg: -50, // Hostil: estoque físico negativo é proibido!
            tipo_ajuste: 'inventario_fisico',
            justificativa: 'Contagem física revelou discrepância no silo',
            ajustado_em: '2026-11-05T08:00:00.000Z'
          },
          correlation_id: 'cmd-stock-negative',
          attachment_refs: [],
          occurred_at_local: '2026-11-05T08:00:00.000Z',
          status: 'PENDENTE',
          attempts: 0,
          last_attempt_at: null,
          error_message: null
        };

        const res = await fetch(`${baseUrl}/api/v1/commands`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenTenantAlphaFabrica}`
          },
          body: JSON.stringify(authorizedEnvelope(tokenTenantAlphaFabrica, envelope))
        });
        expect(res.status).toBe(422);
        const body: any = await res.json();
        expect(body.validation.violations[0].code).toBe('INVALID_DOMAIN_PAYLOAD');
      });

      it('CHALLENGE-2.3.2: Baixa de matéria-prima com quantidade zero ou negativa é rejeitada com 422', async () => {
        const envelope: AtomicCommandEnvelope = {
          command_id: 'cmd-baixa-zero',
          idempotency_key: `idemp-baixa-zero-${Date.now()}-padded`,
          command_type: 'fabrica.ingrediente.dar_baixa',
          aggregate_type: 'baixa_ingrediente',
          aggregate_id: 'baixa-001',
          base_version: 0,
          user_id: 'user-alpha-fabrica',
          tenant_id: 'tenant-lab-alpha',
          product_id: 'consubov',
          fazenda_id: 'fazenda-alpha-01',
          retiro_id: null,
          profile_id: 'fabrica',
          device_id: 'dev-1',
          schema_version: 1,
          payload: {
            baixa_id: 'baixa-001',
            batida_id: 'batida-prod-01',
            materia_prima_id: 'mp-milho',
            quantidade_consumida_kg: 0, // Proibido: baixa deve ser positiva!
            lote_materia_prima: 'LOTE-MILHO-2026',
            silo_origem_id: 'silo-01',
            data_baixa: '2026-11-05T08:00:00.000Z'
          },
          correlation_id: 'cmd-baixa-zero',
          attachment_refs: [],
          occurred_at_local: '2026-11-05T08:00:00.000Z',
          status: 'PENDENTE',
          attempts: 0,
          last_attempt_at: null,
          error_message: null
        };

        const res = await fetch(`${baseUrl}/api/v1/commands`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenTenantAlphaFabrica}`
          },
          body: JSON.stringify(authorizedEnvelope(tokenTenantAlphaFabrica, envelope))
        });
        expect(res.status).toBe(422);
      });
    });

    // 2.4 Desvios de Pesagem, Calibração e Metas de GMD
    describe('2.4 Limites de Pesagem Animal, Calibração de Balanças e Metas de GMD', () => {
      it('CHALLENGE-2.4.1: Calibração com desvio percentual fora de [-10, 10] é rejeitada com 422', async () => {
        const envelope: AtomicCommandEnvelope = {
          command_id: 'cmd-calib-out-of-bounds',
          idempotency_key: `idemp-calib-oob-${Date.now()}-padded`,
          command_type: 'fabrica.balanca.calibrar',
          aggregate_type: 'balanca',
          aggregate_id: 'balanca-01',
          base_version: 0,
          user_id: 'user-alpha-fabrica',
          tenant_id: 'tenant-lab-alpha',
          product_id: 'consubov',
          fazenda_id: 'fazenda-alpha-01',
          retiro_id: null,
          profile_id: 'fabrica',
          device_id: 'dev-1',
          schema_version: 1,
          payload: {
            balanca_id: 'balanca-01',
            equipamento_tipo: 'celula_carga_misturador',
            peso_padrao_afericao_kg: 1000,
            peso_medido_kg: 1200,
            desvio_percentual: 20.0, // Fora do intervalo permitido [-10, 10]
            calibrado: false,
            proxima_calibracao_data: '2026-12-05T00:00:00.000Z',
            data_calibracao: '2026-11-05T07:00:00.000Z'
          },
          correlation_id: 'cmd-calib-out-of-bounds',
          attachment_refs: [],
          occurred_at_local: '2026-11-05T07:00:00.000Z',
          status: 'PENDENTE',
          attempts: 0,
          last_attempt_at: null,
          error_message: null
        };

        const res = await fetch(`${baseUrl}/api/v1/commands`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenTenantAlphaFabrica}`
          },
          body: JSON.stringify(authorizedEnvelope(tokenTenantAlphaFabrica, envelope))
        });
        expect(res.status).toBe(422);
      });

      it('CHALLENGE-2.4.2: Conclusão de batida com tempo de mistura inferior a 30s ou superior a 3600s é rejeitada com 422', async () => {
        const makeBatidaConcluir = (tempo: number) => ({
          command_id: `cmd-bat-tempo-${tempo}`,
          idempotency_key: `idemp-bat-tempo-${tempo}-${Date.now()}-padded`,
          command_type: 'fabrica.batidas.concluir',
          aggregate_type: 'batida',
          aggregate_id: 'batida-tempo-test',
          base_version: 0,
          user_id: 'user-alpha-fabrica',
          tenant_id: 'tenant-lab-alpha',
          product_id: 'consubov',
          fazenda_id: 'fazenda-alpha-01',
          retiro_id: null,
          profile_id: 'fabrica',
          device_id: 'dev-1',
          schema_version: 1,
          payload: {
            batida_id: 'batida-tempo-test',
            quantidade_realizada_kg: 2000,
            tempo_mistura_segundos: tempo,
            finalizado_em: '2026-11-05T08:10:00.000Z',
            desvio_peso_kg: 0
          },
          correlation_id: `corr-${tempo}`,
          attachment_refs: [],
          occurred_at_local: '2026-11-05T08:10:00.000Z',
          status: 'PENDENTE' as const,
          attempts: 0,
          last_attempt_at: null,
          error_message: null
        });

        // 10 segundos (< 30s)
        const resTooShort = await fetch(`${baseUrl}/api/v1/commands`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenTenantAlphaFabrica}`
          },
          body: JSON.stringify(authorizedEnvelope(tokenTenantAlphaFabrica, makeBatidaConcluir(10)))
        });
        expect(resTooShort.status).toBe(422);

        // 5000 segundos (> 3600s)
        const resTooLong = await fetch(`${baseUrl}/api/v1/commands`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenTenantAlphaFabrica}`
          },
          body: JSON.stringify(authorizedEnvelope(tokenTenantAlphaFabrica, makeBatidaConcluir(5000)))
        });
        expect(resTooLong.status).toBe(422);
      });

      it('CHALLENGE-2.4.3: Pesagem de animal com peso negativo, zero ou > 2000kg é rejeitada com 422', async () => {
        const makePesagem = (peso: number) => ({
          command_id: `cmd-pesagem-${peso}`,
          idempotency_key: `idemp-pesagem-${peso}-${Date.now()}-padded`,
          command_type: 'capataz.salga.lancar', // Alias/validador
          aggregate_type: 'animal',
          aggregate_id: 'animal-001',
          base_version: 0,
          user_id: 'user-alpha-capataz',
          tenant_id: 'tenant-lab-alpha',
          product_id: 'consubov',
          fazenda_id: 'fazenda-alpha-01',
          retiro_id: null,
          profile_id: 'capataz',
          device_id: 'dev-1',
          schema_version: 1,
          payload: {
            animal_id: 'boi-001',
            lote_id: 'lote-01',
            peso_kg: peso,
            data_pesagem: '2026-11-05T08:00:00.000Z'
          },
          correlation_id: `corr-peso-${peso}`,
          attachment_refs: [],
          occurred_at_local: '2026-11-05T08:00:00.000Z',
          status: 'PENDENTE' as const,
          attempts: 0,
          last_attempt_at: null,
          error_message: null
        });

        // Testar validador direto do schema
        const { pesagemAnimalPayloadSchema } = await import('@consubov/contracts');
        expect(pesagemAnimalPayloadSchema.safeParse({
          animal_id: 'boi-01',
          lote_id: 'lote-01',
          peso_kg: -5,
          data_pesagem: '2026-11-05T08:00:00.000Z'
        }).success).toBe(false);

        expect(pesagemAnimalPayloadSchema.safeParse({
          animal_id: 'boi-01',
          lote_id: 'lote-01',
          peso_kg: 2500, // Acima de 2000kg
          data_pesagem: '2026-11-05T08:00:00.000Z'
        }).success).toBe(false);
      });

      it('CHALLENGE-2.4.4: Gerente definindo meta com GMD > 3.5 kg/dia é rejeitado com 422', async () => {
        const envelope: AtomicCommandEnvelope = {
          command_id: 'cmd-gmd-excessivo',
          idempotency_key: `idemp-gmd-excessivo-${Date.now()}-padded`,
          command_type: 'gerente.metas.definir',
          aggregate_type: 'lote',
          aggregate_id: 'lote-recria-01',
          base_version: 0,
          user_id: 'user-alpha-gerente',
          tenant_id: 'tenant-lab-alpha',
          product_id: 'consubov',
          fazenda_id: 'fazenda-alpha-01',
          retiro_id: null,
          profile_id: 'gerente',
          device_id: 'dev-1',
          schema_version: 1,
          payload: {
            lote_id: 'lote-recria-01',
            gmd_alvo_kg_dia: 4.5, // Biologicamente absurdo (> 3.5)
            peso_final_alvo_kg: 500,
            data_alvo_abate: '2026-12-15T00:00:00.000Z'
          },
          correlation_id: 'corr-gmd-exc',
          attachment_refs: [],
          occurred_at_local: '2026-11-05T08:00:00.000Z',
          status: 'PENDENTE',
          attempts: 0,
          last_attempt_at: null,
          error_message: null
        };

        const res = await fetch(`${baseUrl}/api/v1/commands`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenTenantAlphaGerente}`
          },
          body: JSON.stringify(authorizedEnvelope(tokenTenantAlphaGerente, envelope))
        });
        expect(res.status).toBe(422);
        const body: any = await res.json();
        expect(body.validation.violations[0].code).toBe('INVALID_DOMAIN_PAYLOAD');
        expect(JSON.stringify(body.validation.violations)).toContain('3.5');
      });
    });
  });

  // ==========================================================================
  // BLOCO 3: COLISÃO DE IDEMPOTÊNCIA CROSS-TENANT & ISOLAMENTO
  // ==========================================================================
  describe('Bloco 3: Colisão de Idempotência Cross-Tenant e Anti-Spoofing', () => {
    it('CHALLENGE-3.1: Dois tenants diferentes usando a MESMA idempotency_key operam em namespaces isolados sem vazamento de replay', async () => {
      const collidingIdempKey = 'idemp-cross-tenant-collision-test-uuid-999-padded';
      const sharedAggId = 'shared-lote-id-01';

      // 1. Tenant Alpha envia comando com a chave colidente
      const envelopeAlpha: AtomicCommandEnvelope = {
        command_id: 'cmd-alpha-cross-001',
        idempotency_key: collidingIdempKey,
        command_type: 'escritorio.custos.fechar',
        aggregate_type: 'lote',
        aggregate_id: sharedAggId,
        base_version: 0,
        user_id: 'user-alpha-escritorio',
        tenant_id: 'tenant-lab-alpha',
        product_id: 'consubov',
        fazenda_id: 'fazenda-alpha-01',
        retiro_id: null,
        profile_id: 'escritorio',
        device_id: 'dev-alpha',
        schema_version: 1,
        payload: {
          lote_id: sharedAggId,
          periodo_mes: 10,
          periodo_ano: 2026,
          custo_nutricao_brl: 30000,
          custo_sanidade_brl: 5000,
          custo_pastagem_brl: 2000,
          custo_operacional_brl: 8000,
          valor_total_apropriado_brl: 45000,
          fechado_em: '2026-11-01T00:00:00.000Z'
        },
        correlation_id: 'corr-alpha-001',
        attachment_refs: [],
        occurred_at_local: '2026-11-05T08:00:00.000Z',
        status: 'PENDENTE',
        attempts: 0,
        last_attempt_at: null,
        error_message: null
      };

      const resAlpha = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTenantAlphaEscritorio}`
        },
        body: JSON.stringify(authorizedEnvelope(tokenTenantAlphaEscritorio, envelopeAlpha))
      });
      expect(resAlpha.status).toBe(200);
      const ackAlpha: any = await resAlpha.json();
      expect(ackAlpha.ack.command_id).toBe('cmd-alpha-cross-001');
      expect(ackAlpha.success).toBe(true);
      expect(ackAlpha.ack.aggregate_version).toBe(1);

      // 2. Tenant Beta envia comando com a EXATA MESMA chave de idempotência e mesmo aggregate_id
      const envelopeBeta: AtomicCommandEnvelope = {
        command_id: 'cmd-beta-cross-002',
        idempotency_key: collidingIdempKey, // Mesma chave!
        command_type: 'escritorio.custos.fechar',
        aggregate_type: 'lote',
        aggregate_id: sharedAggId,
        base_version: 0, // No Tenant Beta, a versão ainda é 0!
        user_id: 'user-beta-escritorio',
        tenant_id: 'tenant-lab-beta', // Tenant diferente!
        product_id: 'consubov',
        fazenda_id: 'fazenda-beta-01',
        retiro_id: null,
        profile_id: 'escritorio',
        device_id: 'dev-beta',
        schema_version: 1,
        payload: {
          lote_id: sharedAggId,
          periodo_mes: 10,
          periodo_ano: 2026,
          custo_nutricao_brl: 60000,
          custo_sanidade_brl: 10000,
          custo_pastagem_brl: 4000,
          custo_operacional_brl: 12000,
          valor_total_apropriado_brl: 86000,
          fechado_em: '2026-11-01T00:00:00.000Z'
        },
        correlation_id: 'corr-beta-002',
        attachment_refs: [],
        occurred_at_local: '2026-11-05T08:00:00.000Z',
        status: 'PENDENTE',
        attempts: 0,
        last_attempt_at: null,
        error_message: null
      };

      const resBeta = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTenantBetaEscritorio}`
        },
        body: JSON.stringify(authorizedEnvelope(tokenTenantBetaEscritorio, envelopeBeta))
      });
      expect(resBeta.status).toBe(200);
      const ackBeta: any = await resBeta.json();

      // Prova empírica: NÃO é replay de Alpha! Possui seu próprio command_id e new_version 1 em Beta!
      expect(ackBeta.ack.command_id).toBe('cmd-beta-cross-002');
      expect(ackBeta.success).toBe(true);
      expect(ackBeta.ack.aggregate_version).toBe(1);

      // 3. Reenvio por Tenant Alpha -> deve retornar replay específico de Alpha
      const resAlphaReplay = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTenantAlphaEscritorio}`
        },
        body: JSON.stringify(authorizedEnvelope(tokenTenantAlphaEscritorio, envelopeAlpha))
      });
      expect(resAlphaReplay.status).toBe(200);
      const ackAlphaReplay: any = await resAlphaReplay.json();
      expect(ackAlphaReplay.ack.command_id).toBe('cmd-alpha-cross-001');
      expect(ackAlphaReplay).toEqual(ackAlpha);

      // 4. Reenvio por Tenant Beta -> deve retornar replay específico de Beta
      const resBetaReplay = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTenantBetaEscritorio}`
        },
        body: JSON.stringify(authorizedEnvelope(tokenTenantBetaEscritorio, envelopeBeta))
      });
      expect(resBetaReplay.status).toBe(200);
      const ackBetaReplay: any = await resBetaReplay.json();
      expect(ackBetaReplay.ack.command_id).toBe('cmd-beta-cross-002');
      expect(ackBetaReplay).toEqual(ackBeta);
    });

    it('CHALLENGE-3.2: Tentativa de Cross-Tenant Spoofing (token Alpha com envelope tenant Beta) é barrada com 403 CONTEXT_MISMATCH', async () => {
      const spoofEnvelope: AtomicCommandEnvelope = {
        command_id: 'cmd-spoof-cross-tenant',
        idempotency_key: `idemp-spoof-${Date.now()}-padded`,
        command_type: 'escritorio.custos.fechar',
        aggregate_type: 'lote',
        aggregate_id: 'lote-victim-01',
        base_version: 0,
        user_id: 'user-alpha-escritorio',
        tenant_id: 'tenant-lab-beta', // Spoofing: token é do tenant-lab-alpha!
        product_id: 'consubov',
        fazenda_id: 'fazenda-alpha-01',
        retiro_id: null,
        profile_id: 'escritorio',
        device_id: 'dev-spoof',
        schema_version: 1,
        payload: {
          lote_id: 'lote-recria-01',
          periodo_mes: 10,
          periodo_ano: 2026,
          custo_nutricao_brl: 10000,
          custo_sanidade_brl: 1000,
          custo_pastagem_brl: 1000,
          custo_operacional_brl: 1000,
          valor_total_apropriado_brl: 13000,
          fechado_em: '2026-11-01T00:00:00.000Z'
        },
        correlation_id: 'corr-spoof',
        attachment_refs: [],
        occurred_at_local: '2026-11-05T08:00:00.000Z',
        status: 'PENDENTE',
        attempts: 0,
        last_attempt_at: null,
        error_message: null
      };

      const res = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTenantAlphaEscritorio}` // Token do Alpha
        },
        body: JSON.stringify({ ...authorizedEnvelope(tokenTenantAlphaEscritorio, spoofEnvelope), tenant_id: 'tenant-lab-beta' })
      });
      expect(res.status).toBe(403);
      const body: any = await res.json();
      expect(body.security.error).toBe('FORBIDDEN_403');
    });
  });

  // ==========================================================================
  // BLOCO 4: ATAQUES DE PAYLOAD, STRICT SCHEMA & INJEÇÃO DE CAMPOS ESTRANHOS
  // ==========================================================================
  describe('Bloco 4: Ataques de Schema Injection (Strict Mode Zod) e Allowlist Fail-Closed', () => {
    it('CHALLENGE-4.1: Injeção de propriedades não declaradas no payload de domínio é rejeitada por strict() Zod com 422', async () => {
      const hostilePayload = {
        nota_fiscal_id: 'nf-injection-001',
        numero_nf: '9988',
        serie: '1',
        chave_acesso_nfe: '35261100000000000000550010000445561000000010',
        fornecedor_cnpj_cpf: '12.345.678/0001-99',
        fornecedor_nome: 'Fornecedor Teste',
        valor_total_brl: 1000,
        data_emissao: '2026-11-05T00:00:00.000Z',
        itens: [
          {
            produto_descricao: 'Milho',
            quantidade: 1,
            unidade_medida: 'ton' as const,
            valor_unitario_brl: 1000,
            valor_total_item_brl: 1000
          }
        ],
        // Propriedades injetadas maliciosas (ataque de poluição / bypass)
        __proto__: { isAdmin: true },
        sql_injection: "'; DROP TABLE atomic_command_log; --",
        unauthorized_flag: true
      };

      const envelope: AtomicCommandEnvelope = {
        command_id: 'cmd-injection-001',
        idempotency_key: `idemp-inj-${Date.now()}-uuid-padded`,
        command_type: 'escritorio.notas.registrar_entrada',
        aggregate_type: 'nota_fiscal',
        aggregate_id: 'nf-injection-001',
        base_version: 0,
        user_id: 'user-alpha-escritorio',
        tenant_id: 'tenant-lab-alpha',
        product_id: 'consubov',
        fazenda_id: 'fazenda-alpha-01',
        retiro_id: null,
        profile_id: 'escritorio',
        device_id: 'dev-inj',
        schema_version: 1,
        payload: hostilePayload,
        correlation_id: 'corr-inj',
        attachment_refs: [],
        occurred_at_local: '2026-11-05T08:00:00.000Z',
        status: 'PENDENTE',
        attempts: 0,
        last_attempt_at: null,
        error_message: null
      };

      const res = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTenantAlphaEscritorio}`
        },
        body: JSON.stringify(authorizedEnvelope(tokenTenantAlphaEscritorio, envelope))
      });
      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body.validation.violations[0].code).toBe('INVALID_DOMAIN_PAYLOAD');
      expect(JSON.stringify(body.validation.violations)).toContain('unrecognized_keys');
    });

    it('CHALLENGE-4.2: Comando arbitrário fora da allowlist é rejeitado com 422 COMMAND_NOT_ALLOWED', async () => {
      const envelope = {
        command_id: 'cmd-unauthorized-type',
        idempotency_key: 'idemp-unauth-001-uuid-padded',
        command_type: 'hacker.arbitrary.bypass_security',
        aggregate_type: 'system',
        aggregate_id: 'root',
        base_version: 0,
        user_id: 'user-alpha-gerente',
        tenant_id: 'tenant-lab-alpha',
        product_id: 'consubov',
        fazenda_id: 'fazenda-alpha-01',
        retiro_id: null,
        profile_id: 'gerente',
        device_id: 'dev-1',
        schema_version: 1,
        payload: { secret: 'pwned' }
      };

      const res = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTenantAlphaGerente}`
        },
        body: JSON.stringify(authorizedEnvelope(tokenTenantAlphaGerente, envelope))
      });
      expect(res.status).toBe(422);
      const body: any = await res.json();
      expect(body.validation.violations[0].code).toBe('INVALID_ENVELOPE');
    });

    it('CHALLENGE-4.3: Perfil cruzado (escritório tentando calibrar balança ou capataz tentando fechar custos) é barrado com 403 FORBIDDEN_COMMAND', async () => {
      // Escritório tentando calibrar balança (exclusivo de fábrica)
      const envelopeEscritorioToFabrica: AtomicCommandEnvelope = {
        command_id: 'cmd-cross-role-001',
        idempotency_key: `idemp-cr-${Date.now()}-uuid-padded`,
        command_type: 'fabrica.balanca.calibrar',
        aggregate_type: 'balanca',
        aggregate_id: 'balanca-01',
        base_version: 0,
        user_id: 'user-alpha-escritorio',
        tenant_id: 'tenant-lab-alpha',
        product_id: 'consubov',
        fazenda_id: 'fazenda-alpha-01',
        retiro_id: null,
        profile_id: 'escritorio',
        device_id: 'dev-1',
        schema_version: 1,
        payload: {
          balanca_id: 'balanca-01',
          equipamento_tipo: 'balanca_ensaque',
          peso_padrao_afericao_kg: 50,
          peso_medido_kg: 50.1,
          desvio_percentual: 0.2,
          calibrado: true,
          proxima_calibracao_data: '2026-12-05T00:00:00.000Z',
          data_calibracao: '2026-11-05T07:00:00.000Z'
        },
        correlation_id: 'corr-cr-1',
        attachment_refs: [],
        occurred_at_local: '2026-11-05T07:00:00.000Z',
        status: 'PENDENTE',
        attempts: 0,
        last_attempt_at: null,
        error_message: null
      };

      const resEscritorio = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTenantAlphaEscritorio}`
        },
        body: JSON.stringify(authorizedEnvelope(tokenTenantAlphaEscritorio, envelopeEscritorioToFabrica))
      });
      expect(resEscritorio.status).toBe(403);
      const bodyEscritorio: any = await resEscritorio.json();
      expect(bodyEscritorio.security.error).toBe('FORBIDDEN_403');

      // Capataz tentando registrar NF (exclusivo de escritório)
      const envelopeCapatazToEscritorio: AtomicCommandEnvelope = {
        command_id: 'cmd-cross-role-002',
        idempotency_key: `idemp-cr-2-${Date.now()}-padded`,
        command_type: 'escritorio.notas.registrar_entrada',
        aggregate_type: 'nota_fiscal',
        aggregate_id: 'nf-cross-01',
        base_version: 0,
        user_id: 'user-alpha-capataz',
        tenant_id: 'tenant-lab-alpha',
        product_id: 'consubov',
        fazenda_id: 'fazenda-alpha-01',
        retiro_id: null,
        profile_id: 'capataz',
        device_id: 'dev-1',
        schema_version: 1,
        payload: {
          nota_fiscal_id: 'nf-cross-01',
          numero_nf: '100',
          serie: '1',
          chave_acesso_nfe: '35261100000000000000550010000445561000000010',
          fornecedor_cnpj_cpf: '12.345.678/0001-99',
          fornecedor_nome: 'Fornecedor Teste',
          valor_total_brl: 1000,
          data_emissao: '2026-11-05T00:00:00.000Z',
          itens: [
            {
              produto_descricao: 'Milho',
              quantidade: 1,
              unidade_medida: 'ton' as const,
              valor_unitario_brl: 1000,
              valor_total_item_brl: 1000
            }
          ]
        },
        correlation_id: 'corr-cr-2',
        attachment_refs: [],
        occurred_at_local: '2026-11-05T07:00:00.000Z',
        status: 'PENDENTE',
        attempts: 0,
        last_attempt_at: null,
        error_message: null
      };

      const resCapataz = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTenantAlphaCapataz}`
        },
        body: JSON.stringify(authorizedEnvelope(tokenTenantAlphaCapataz, envelopeCapatazToEscritorio))
      });
      expect(resCapataz.status).toBe(403);
      const bodyCapataz: any = await resCapataz.json();
      expect(bodyCapataz.security.error).toBe('FORBIDDEN_403');
    });

    it('CHALLENGE-4.4: Envio de JSON corrompido / malformado é rejeitado com 400 INVALID_JSON', async () => {
      const res = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenTenantAlphaGerente}`
        },
        body: '{ "invalid_json": true, ' // Malformado!
      });
      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.error).toBe('INVALID_JSON');
    });
  });
});
