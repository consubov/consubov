import { loginApi, authorizedEnvelope } from '../harness/api-auth';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createApiServer } from '@consubov/platform-api';
import { allocateAvailablePort } from '../harness/port-allocator';
import { installNetworkGuard } from '../harness/network-guard';
import { createSyntheticCommandEnvelope, SYNTHETIC_FIXTURES } from '../harness/synthetic-data';
import {
  LocalAuthService,
  SessionManager,
  InMemorySessionStorage,
  LocalStorageSessionStorage,
  SYNTHETIC_USERS,
  LAB_DEFAULT_PASSWORD,
  resolveActiveContext,
  ContextSelectionRequiredError,
  UnauthorizedContextError,
  signSyntheticJwt,
  verifySyntheticJwt,
  base64UrlEncode,
  base64UrlDecode,
  SYNTHETIC_JWT_SECRET_LAB,
  canAccessModule,
  buildPartitionKey,
  parsePartitionKey
} from '@consubov/auth-client';
import { UserProfileId } from '@consubov/contracts';

describe('Adversarial Security Suite: FASE 03 — Exploração de RBAC, ISO-004 e Tampering', () => {
  let restoreNetwork: () => void;
  let apiInstance: ReturnType<typeof createApiServer>;
  let baseUrl: string;
  let storage: InMemorySessionStorage;
  let authService: LocalAuthService;

  beforeAll(async () => {
    restoreNetwork = installNetworkGuard();
    const port = await allocateAvailablePort(3600);
    apiInstance = createApiServer(port, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(() => {
    if (apiInstance) apiInstance.stop();
    if (restoreNetwork) restoreNetwork();
  });

  beforeEach(() => {
    storage = new InMemorySessionStorage();
    authService = new LocalAuthService({ storage });
  });

  // ==========================================================================
  // ATAQUE 2: BYPASS DO MANDATO ISO-004 (SELEÇÃO DE CONTEXTO)
  // ==========================================================================
  describe('Ataque 2: Bypass do Mandato ISO-004 e Invocação Maliciosa de selectContext', () => {
    it('ADV-2.1: Deve rejeitar sumariamente membershipId arbitrário inexistente mantendo contexto nulo', async () => {
      const loginRes = await authService.login({
        email: 'gerente.lab@consubov.local',
        password: LAB_DEFAULT_PASSWORD
      });
      expect(loginRes.success).toBe(true);

      // Tentativa de invasão: passar membershipId inventado pelo atacante
      const exploitRes = await authService.selectContext('membership-hacker-arbitrary-uuid-999');

      expect(exploitRes.success).toBe(false);
      expect(exploitRes.error).toBe('Vínculo incompatível com o perfil único desta conta.');

      // Comprovação defensiva: nenhum contexto foi ativado e nenhum token foi emitido
      expect(authService.getSessionManager().getActiveContext()).toBeNull();
      expect(authService.getSessionManager().getTokens()).toBeNull();
      expect(storage.getItem('current')?.session.active_context).toBeNull();
    });

    it('ADV-2.2: Deve rejeitar tentativa de capataz selecionar vínculo pertencente a outro usuário (Cross-User)', async () => {
      // 1. Capataz loga
      const capatazLogin = await authService.login({
        email: 'capataz.lab@consubov.local',
        password: LAB_DEFAULT_PASSWORD
      });
      expect(capatazLogin.success).toBe(true);

      // 2. Capataz tenta usar membershipId do Gerente obtido por vazamento
      const gerenteUser = SYNTHETIC_USERS['gerente.lab@consubov.local']!;
      const gerenteMemId = gerenteUser.memberships[0]!.membership_id;

      const crossUserRes = await authService.selectContext(gerenteMemId);

      expect(crossUserRes.success).toBe(false);
      expect(crossUserRes.error).toBe('Vínculo incompatível com o perfil único desta conta.');
      expect(authService.getSessionManager().getActiveContext()).toBeNull();
      expect(authService.getSessionManager().getTokens()).toBeNull();
    });

    it('ADV-2.3: Deve rejeitar seleção de vínculo com status desativado/revogado (is_active: false)', async () => {
      // Simula usuário com vínculo inativo
      const sessionManager = authService.getSessionManager();
      sessionManager.setSession({
        session_id: 'sess-test-revoked',
        user_id: 'usr-revoked',
        user_name: 'Usuário Revogado',
        user_email: 'revogado@consubov.local',
        profile_id: 'capataz' as UserProfileId,
        memberships: [
          {
            membership_id: 'mem-revoked-001',
            tenant_id: 'tenant-lab-01',
            tenant_nome: 'Fazenda Modelo',
            fazenda_id: 'fazenda-01',
            fazenda_nome: 'Fazenda Modelo',
            retiro_id: null,
            retiro_nome: null,
            profile_id: 'capataz',
            is_active: false // REVOGADO!
          }
        ],
        active_context: null,
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        device_id: 'dev-001'
      });

      const selectRes = await authService.selectContext('mem-revoked-001');

      expect(selectRes.success).toBe(false);
      expect(selectRes.error).toContain('ACESSO_NEGADO_403');
      expect(sessionManager.getActiveContext()).toBeNull();
    });

    it('ADV-2.4: Invocação de selectContext sem nenhuma sessão ativa deve retornar erro gracioso', async () => {
      // Sem realizar login prévio
      const selectRes = await authService.selectContext('qualquer-id');

      expect(selectRes.success).toBe(false);
      expect(selectRes.error).toBe('Nenhuma sessão autenticada para selecionar contexto.');
    });

    it('ADV-2.5: Fuzzing de membershipId com payloads maliciosos deve aplicar Fail-Closed sem exceção não tratada', async () => {
      await authService.login({
        email: 'gerente.lab@consubov.local',
        password: LAB_DEFAULT_PASSWORD
      });

      const maliciousPayloads = [
        '',
        '   ',
        'null',
        'undefined',
        '__proto__',
        'constructor',
        '../../etc/passwd',
        '<script>alert(1)</script>',
        '${7*7}',
        '{"$gt":""}',
        '\\x00\\x00'
      ];

      for (const payload of maliciousPayloads) {
        const res = await authService.selectContext(payload);
        expect(res.success).toBe(false);
        expect(authService.getSessionManager().getActiveContext()).toBeNull();
      }
    });
  });

  // ==========================================================================
  // ATAQUE 3: TAMPERING DE SESSÃO E STORAGE POISONING
  // ==========================================================================
  describe('Ataque 3: Tampering de Sessão, JWT Adulterado e Storage Poisoning', () => {
    it('ADV-3.1: Token JWT com claims adulteradas (capataz -> gerente) deve ser rejeitado com INVALID_SIGNATURE', async () => {
      // 1. Gera token legítimo para capataz
      const claims = {
        user_id: 'usr-capataz-001',
        tenant_id: 'tenant-lab-01',
        fazenda_id: 'fazenda-01',
        profile_id: 'capataz' as UserProfileId,
        roles: ['capataz'],
        permissions: ['capataz.operar_offline']
      };
      const legitimateToken = await signSyntheticJwt(claims, SYNTHETIC_JWT_SECRET_LAB);

      // 2. Ataque de Tampering: decodifica payload, altera para 'gerente' e recombina mantendo a assinatura original
      const parts = legitimateToken.split('.');
      const originalPayload = JSON.parse(base64UrlDecode(parts[1]!));
      originalPayload.profile_id = 'gerente';
      originalPayload.roles = ['gerente'];
      originalPayload.permissions = ['gerente.metas.definir'];

      const tamperedPayloadB64 = base64UrlEncode(JSON.stringify(originalPayload));
      const tamperedToken = `${parts[0]}.${tamperedPayloadB64}.${parts[2]}`;

      // 3. Verificação com verifySyntheticJwt
      const verifyRes = await verifySyntheticJwt(tamperedToken, SYNTHETIC_JWT_SECRET_LAB);
      expect(verifyRes.valid).toBe(false);
      if (!verifyRes.valid) {
        expect(verifyRes.error).toBe('INVALID_SIGNATURE');
      }

      // 4. Submissão do token adulterado à API Bun Central
      const apiRes = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tamperedToken}`
        },
        body: JSON.stringify({
          command_id: 'cmd-adv-001',
          command_type: 'gerente.metas.definir',
          tenant_id: 'tenant-lab-01',
          user_id: 'usr-capataz-001',
          device_id: 'dev-001',
          profile_id: 'gerente',
          aggregate_type: 'meta',
          aggregate_id: 'meta-001',
          base_version: 0,
          idempotency_key: 'idem-adv-001',
          created_at: new Date().toISOString(),
          payload: { meta_gmd: 1.5 }
        })
      });

      // API deve rejeitar sumariamente com 401 INVALID_TOKEN
      expect(apiRes.status).toBe(401);
      const apiData: any = await apiRes.json();
      expect(apiData.error).toBe('INVALID_TOKEN');
    });

    it('ADV-3.2: Token assinado com chave secreta de invasor deve ser sumariamente rejeitado', async () => {
      const forgedToken = await signSyntheticJwt(
        {
          user_id: 'usr-admin-forged',
          tenant_id: 'tenant-lab-01',
          fazenda_id: 'fazenda-01',
          profile_id: 'administrador' as UserProfileId
        },
        'chave-falsa-do-atacante-1234567890'
      );

      const verifyRes = await verifySyntheticJwt(forgedToken, SYNTHETIC_JWT_SECRET_LAB);
      expect(verifyRes.valid).toBe(false);
      if (!verifyRes.valid) {
        expect(verifyRes.error).toBe('INVALID_SIGNATURE');
      }

      // API central
      const apiRes = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${forgedToken}`
        },
        body: JSON.stringify({})
      });
      expect(apiRes.status).toBe(401);
    });

    it('ADV-3.3: Token expirado deve ser rejeitado com TOKEN_EXPIRED', async () => {
      const expiredToken = await signSyntheticJwt(
        {
          user_id: 'usr-capataz-001',
          tenant_id: 'tenant-lab-01',
          fazenda_id: 'fazenda-01',
          profile_id: 'capataz' as UserProfileId,
          exp: Math.floor(Date.now() / 1000) - 3600 // Expirado há 1 hora
        },
        SYNTHETIC_JWT_SECRET_LAB
      );

      const verifyRes = await verifySyntheticJwt(expiredToken, SYNTHETIC_JWT_SECRET_LAB);
      expect(verifyRes.valid).toBe(false);
      if (!verifyRes.valid) {
        expect(verifyRes.error).toBe('TOKEN_EXPIRED');
      }

      const apiRes = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${expiredToken}`
        },
        body: JSON.stringify({})
      });
      expect(apiRes.status).toBe(401);
      const data: any = await apiRes.json();
      expect(data.error).toBe('TOKEN_EXPIRED');
      expect(data.expired).toBe(true);
    });

    it('ADV-3.4: Injeção de JSON corrompido no LocalStorage (Storage Poisoning) deve aplicar Fail-Closed sem crash', () => {
      const localStorage = new LocalStorageSessionStorage();

      // Injeta lixo corrompido simulando ataque ou corrupção de disco
      const corruptedItem = localStorage.getItem('chave_inexistente_ou_corrompida');
      expect(corruptedItem).toBeNull();

      const sessionManager = new SessionManager({ storage: localStorage });
      const restored = sessionManager.restoreFromStorage('chave_inexistente');
      expect(restored).toBe(false);
      expect(sessionManager.getSession()).toBeNull();
      expect(sessionManager.getActiveContext()).toBeNull();
    });

    it('ADV-3.5: Barreira Central da API: perfil divergente do token Bearer deve ser barrado com 403 PROFILE_MISMATCH', async () => {
      // Emite token legítimo de capataz
      const capatazClaims = {
        user_id: SYNTHETIC_FIXTURES.users.capataz.id,
        tenant_id: SYNTHETIC_FIXTURES.tenant.id,
        fazenda_id: SYNTHETIC_FIXTURES.fazenda.id,
        profile_id: 'capataz' as UserProfileId,
        roles: ['capataz'],
        permissions: []
      };
      const capatazToken = (await loginApi(baseUrl, 'capataz')).tokens.access_token;

      // Atacante envia envelope válido no schema Zod, mas alterando profile_id para 'gerente'
      const envelopeSpoof = createSyntheticCommandEnvelope({
        tenant_id: SYNTHETIC_FIXTURES.tenant.id,
        user_id: SYNTHETIC_FIXTURES.users.capataz.id,
        profile_id: 'gerente' as any, // TENTATIVA DE SPOOFING DE PERFIL NO ENVELOPE
        command_type: 'gerente.metas.definir',
        payload: {
          safra_id: 'safra-2026-2027',
          meta_gmd_global: 1.45,
          data_inicio: '2026-01-01T00:00:00.000Z',
          data_fim: '2026-12-31T23:59:59.000Z'
        }
      });

      const apiRes = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${capatazToken}`
        },
        body: JSON.stringify({ ...authorizedEnvelope(capatazToken, envelopeSpoof), profile_id: 'gerente' })
      });

      // API deve barrar com HTTP 403 FORBIDDEN / PROFILE_MISMATCH
      expect(apiRes.status).toBe(403);
      const data: any = await apiRes.json();
      expect(data.security.error).toBe('FORBIDDEN_403');
      expect(apiInstance.ledger.queryLogs()).toHaveLength(0);
    });
  });

  // ==========================================================================
  // ATAQUE 4: ANTI-FIRST-MATCH AUTOMÁTICO (ISO-004)
  // ==========================================================================
  describe('Ataque 4: Anti-First-Match Automático (ISO-004)', () => {
    it('ADV-4.1: Login de gerente multi-papel JAMAIS assume active_context nem emite tokens automaticamente', async () => {
      const res = await authService.login({
        email: 'gerente.lab@consubov.local',
        password: LAB_DEFAULT_PASSWORD
      });

      expect(res.success).toBe(true);
      // ISO-004: active_context DEVE SER NULO
      expect(res.session!.active_context).toBeNull();
      expect(res.requires_context_selection).toBe(true);

      const sm = authService.getSessionManager();
      expect(sm.getActiveContext()).toBeNull();
      expect(sm.getTokens()).toBeNull();
      expect(sm.getPartitionKey()).toBe('unauthenticated');
    });

    it('ADV-4.2: Login de usuário com apenas UM ÚNICO papel ativo também exige seleção explícita', async () => {
      const res = await authService.login({
        email: 'capataz.lab@consubov.local',
        password: LAB_DEFAULT_PASSWORD
      });

      expect(res.success).toBe(true);
      // Mesmo com 1 papel, o ISO-004 proíbe auto-atribuição de índice [0]
      expect(res.session!.active_context).toBeNull();
      expect(res.requires_context_selection).toBe(true);
      expect(authService.getSessionManager().getActiveContext()).toBeNull();
    });

    it('ADV-4.3: resolveActiveContext deve lançar ContextSelectionRequiredError se nenhum vínculo for especificado', () => {
      const fakeSession = {
        session_id: 's-1',
        user_id: 'u-1',
        user_name: 'U',
        user_email: 'u@c.l',
        profile_id: 'capataz' as UserProfileId,
        memberships: [
          {
            membership_id: 'mem-1',
            tenant_id: 't-1',
            tenant_nome: 'T',
            fazenda_id: 'f-1',
            fazenda_nome: 'F',
            retiro_id: null,
            retiro_nome: null,
            profile_id: 'capataz' as UserProfileId,
            is_active: true
          }
        ],
        active_context: null,
        issued_at: new Date().toISOString(),
        expires_at: new Date().toISOString(),
        device_id: 'd-1'
      };

      // Invocação com undefined
      expect(() => resolveActiveContext(fakeSession, undefined)).toThrow(ContextSelectionRequiredError);
      // Invocação com string vazia
      expect(() => resolveActiveContext(fakeSession, '')).toThrow(ContextSelectionRequiredError);
    });
  });

  // ==========================================================================
  // ATAQUE 5: ISOLAMENTO MULTITENANT E HIGIENE DE SESSÃO
  // ==========================================================================
  describe('Ataque 5: Higiene de Sessão no Logout e Particionamento Isolado', () => {
    it('ADV-5.1: Logout deve limpar storage atual e resetar partição para unauthenticated', async () => {
      // 1. Gerente loga e seleciona contexto
      const login = await authService.login({
        email: 'gerente.lab@consubov.local',
        password: LAB_DEFAULT_PASSWORD
      });
      await authService.selectContext(login.available_memberships![0]!.membership_id);

      expect(storage.getItem('current')).not.toBeNull();
      expect(authService.getSessionManager().getPartitionKey()).not.toBe('unauthenticated');

      // 2. Operador efetua logout
      authService.logout();

      // 3. Comprova que 'current' foi expurgado e partição resetada
      expect(storage.getItem('current')).toBeNull();
      expect(authService.getSessionManager().getSession()).toBeNull();
      expect(authService.getSessionManager().getActiveContext()).toBeNull();
      expect(authService.getSessionManager().getTokens()).toBeNull();
      expect(authService.getSessionManager().getPartitionKey()).toBe('unauthenticated');
    });
  });
});
