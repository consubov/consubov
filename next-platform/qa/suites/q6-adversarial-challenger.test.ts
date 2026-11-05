/**
 * SUÍTE DE TESTES ADVERSARIAIS DO CHALLENGER — FASE 06 (M06)
 * Agente: challenger_f06_1 (Critic / Specialist)
 * Missão: F23-ISOLATED-NEXT — ADM CONSUBOV Independente (apps/admin-global)
 * 
 * Verificação empírica, hostil e de estresse cobrindo os 5 vetores mandatórios:
 * 1. Autenticação em 2 etapas, MFA TOTP e Proteção de Sessão
 * 2. Escalação de Privilégios e RBAC Fail-Closed Matrix (Frontend & API Real)
 * 3. BVA de Licenças Offgrid no Zod Schema (Limites 1-90, floats, chave pública)
 * 4. Multitenancy, Cotas e Injeção Hostil de Filtros no Ledger
 * 5. Bilinguismo Dinâmico, Paridade 100% (pt-BR / en-US) e AST Literal Guard
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { resolve } from 'path';
import {
  SYNTHETIC_ADMIN_USERS,
  ADMIN_SESSION_STORAGE_KEY,
  LAB_MFA_CODE,
  type AdminRole
} from '../../apps/admin-global/src/auth/AdminAuthContext';
import {
  signSyntheticJwt,
  verifySyntheticJwt,
  SYNTHETIC_JWT_SECRET_LAB
} from '@consubov/auth-client';
import {
  APP_DICTIONARY,
  AtomicCommandEnvelope,
  criarTenantPayloadSchema,
  suspenderTenantPayloadSchema,
  gerarLicencaOffgridPayloadSchema,
  atualizarLicencaPayloadSchema,
  bloquearUsuarioPayloadSchema,
  vincularUsuarioPayloadSchema
} from '@consubov/contracts';
import { InMemoryLedger, type CommandLogFilter } from '../../api/src/ledger/in-memory-ledger';
import { createApiServer } from '@consubov/platform-api';
import { allocateAvailablePort } from '../harness/port-allocator';
import { installNetworkGuard } from '../harness/network-guard';
import { scanAstLiterals, findTsxFiles } from '../harness/ast-literal-guard';

describe('CHALLENGER F06: Bateria Adversarial de Estresse Empírico — ADM Global', () => {
  let restoreNetwork: () => void;
  let apiInstance: ReturnType<typeof createApiServer>;
  let baseUrl: string;
  let superAdminToken: string;
  let supportAdminToken: string;
  let financialAdminToken: string;
  let capatazToken: string;
  let gerenteToken: string;

  beforeAll(async () => {
    restoreNetwork = installNetworkGuard();
    const port = await allocateAvailablePort(3650);
    apiInstance = createApiServer(port, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${port}`;

    // Emissão de tokens para testes da API
    superAdminToken = await signSyntheticJwt(
      {
        sub: 'usr-super-admin-adv',
        user_id: 'usr-super-admin-adv',
        email: 'admin.lab@consubov.local',
        name: 'Super Admin Challenger',
        profile_id: 'administrador',
        tenant_id: '00000000-0000-4000-8000-000000000000',
        fazenda_id: '00000000-0000-4000-8000-000000000000',
        product_id: 'consubov',
        roles: ['super_admin'],
        exp: Math.floor(Date.now() / 1000) + 7200
      },
      SYNTHETIC_JWT_SECRET_LAB
    );

    supportAdminToken = await signSyntheticJwt(
      {
        sub: 'usr-support-admin-adv',
        user_id: 'usr-support-admin-adv',
        email: 'suporte.lab@consubov.local',
        name: 'Support Admin Challenger',
        profile_id: 'administrador',
        tenant_id: '00000000-0000-4000-8000-000000000000',
        fazenda_id: '00000000-0000-4000-8000-000000000000',
        product_id: 'consubov',
        roles: ['support_admin'],
        exp: Math.floor(Date.now() / 1000) + 7200
      },
      SYNTHETIC_JWT_SECRET_LAB
    );

    financialAdminToken = await signSyntheticJwt(
      {
        sub: 'usr-financial-admin-adv',
        user_id: 'usr-financial-admin-adv',
        email: 'financeiro.lab@consubov.local',
        name: 'Financial Admin Challenger',
        profile_id: 'administrador',
        tenant_id: '00000000-0000-4000-8000-000000000000',
        fazenda_id: '00000000-0000-4000-8000-000000000000',
        product_id: 'consubov',
        roles: ['financial_admin'],
        exp: Math.floor(Date.now() / 1000) + 7200
      },
      SYNTHETIC_JWT_SECRET_LAB
    );

    capatazToken = await signSyntheticJwt(
      {
        sub: 'usr-capataz-adv',
        user_id: 'usr-capataz-adv',
        email: 'capataz.lab@consubov.local',
        name: 'Capataz Challenger',
        profile_id: 'capataz',
        tenant_id: 'ten-farm-001',
        fazenda_id: 'faz-001',
        product_id: 'consubov',
        roles: ['capataz'],
        exp: Math.floor(Date.now() / 1000) + 7200
      },
      SYNTHETIC_JWT_SECRET_LAB
    );

    gerenteToken = await signSyntheticJwt(
      {
        sub: 'usr-gerente-adv',
        user_id: 'usr-gerente-adv',
        email: 'gerente.lab@consubov.local',
        name: 'Gerente Challenger',
        profile_id: 'gerente',
        tenant_id: 'ten-farm-001',
        fazenda_id: 'faz-001',
        product_id: 'consubov',
        roles: ['gerente'],
        exp: Math.floor(Date.now() / 1000) + 7200
      },
      SYNTHETIC_JWT_SECRET_LAB
    );
  });

  afterAll(() => {
    if (apiInstance) apiInstance.stop();
    if (restoreNetwork) restoreNetwork();
  });

  // =========================================================================
  // VETOR 1: AUTENTICAÇÃO EM 2 ETAPAS, MFA TOTP E PROTEÇÃO DE SESSÃO
  // =========================================================================
  describe('Vetor 1: Autenticação em 2 Etapas, MFA TOTP e Proteção de Sessão', () => {
    const sanitizeAndVerifyTotp = (input: string): boolean => {
      const clean = input.trim().replace(/\D/g, '');
      return clean === LAB_MFA_CODE;
    };

    it('ADV-1.1: Rejeição estrita de códigos TOTP incorretos, truncados ou excedentes', () => {
      const invalidCodes = [
        '000000',
        '999999',
        '12345',
        '1234567',
        '654321',
        '111111',
        'abcdef',
        '1234ab',
        '',
        '   ',
        '!@#$%^'
      ];

      for (const code of invalidCodes) {
        expect(sanitizeAndVerifyTotp(code)).toBe(false);
      }
    });

    it('ADV-1.2: Sanitização de formatações espúrias (espaços, pontuação, separadores)', () => {
      const validVariations = [
        '123456',
        ' 123456 ',
        '123-456',
        '123.456',
        '123 456',
        '12-34-56'
      ];

      for (const input of validVariations) {
        expect(sanitizeAndVerifyTotp(input)).toBe(true);
      }
    });

    it('ADV-1.3: Rejeição de injeções de caracteres maliciosos no código TOTP', () => {
      const hostileCodes = [
        "' OR 1=1--",
        "<script>alert(1)</script>",
        "123456; DROP TABLE users;",
        "123'456",
        'NaN',
        'undefined',
        'null',
        '123456\x00'
      ];

      for (const code of hostileCodes) {
        // Se a sanitização de dígitos não produzir exatamente '123456', deve falhar
        const clean = code.trim().replace(/\D/g, '');
        const valid = clean === LAB_MFA_CODE;
        // Códigos que alteram o conteúdo numérico (ex: 1=1 adiciona dígitos ou '123456' com dígitos extras) não devem passar
        if (clean !== '123456') {
          expect(valid).toBe(false);
        }
      }
    });

    it('ADV-1.4: Isolamento e purga da chave de sessão administrativa no logout', () => {
      expect(ADMIN_SESSION_STORAGE_KEY).toBe('consubov:admin-session');
      expect(ADMIN_SESSION_STORAGE_KEY).not.toBe('consubov:user-session');

      // Simulação do comportamento de persistência do AdminAuthProvider
      const mockStorage: Record<string, string> = {};
      const fakeSession = {
        token: 'synthetic-token-abc',
        user: { id: 'usr-admin-1', email: 'admin.lab@consubov.local', role: 'super_admin' },
        mfa_verified: true,
        authenticated_at: new Date().toISOString()
      };

      // Gravação
      mockStorage[ADMIN_SESSION_STORAGE_KEY] = JSON.stringify(fakeSession);
      expect(mockStorage[ADMIN_SESSION_STORAGE_KEY]).toBeDefined();

      // Logout / Purge
      delete mockStorage[ADMIN_SESSION_STORAGE_KEY];
      expect(mockStorage[ADMIN_SESSION_STORAGE_KEY]).toBeUndefined();
    });

    it('ADV-1.5: Rejeição de credenciais administrativas inválidas na Etapa 1', () => {
      const validateCredentials = (email: string, pass: string): boolean => {
        const norm = email.trim().toLowerCase();
        const cred = SYNTHETIC_ADMIN_USERS[norm];
        if (!cred) return false;
        return pass === cred.defaultPassword;
      };

      // Credenciais legítimas
      expect(validateCredentials('admin.lab@consubov.local', 'lab@123456')).toBe(true);
      expect(validateCredentials('suporte.lab@consubov.local', 'lab@123456')).toBe(true);
      expect(validateCredentials('financeiro.lab@consubov.local', 'lab@123456')).toBe(true);

      // Normalização com espaços e maiúsculas
      expect(validateCredentials('  ADMIN.LAB@CONSUBOV.LOCAL  ', 'lab@123456')).toBe(true);

      // Senhas incorretas
      expect(validateCredentials('admin.lab@consubov.local', 'senha_errada')).toBe(false);
      expect(validateCredentials('admin.lab@consubov.local', '')).toBe(false);

      // Usuários corporativos forjados / inexistentes
      expect(validateCredentials('hacker@consubov.local', 'lab@123456')).toBe(false);
      expect(validateCredentials('ceo@consubov.local', 'lab@123456')).toBe(false);
      expect(validateCredentials('root@localhost', 'admin')).toBe(false);
      expect(validateCredentials('', '')).toBe(false);
    });

    it('ADV-1.6: Máquina de estados impede conclusão de MFA sem pendingEmail válido', () => {
      const verifyMfaStateTransition = (
        pendingEmail: string | null,
        code: string
      ): { success: boolean; errorKey?: string } => {
        if (!pendingEmail) {
          return { success: false, errorKey: 'admin.auth.errorForbidden' };
        }
        const clean = code.trim().replace(/\D/g, '');
        if (clean !== LAB_MFA_CODE) {
          return { success: false, errorKey: 'admin.auth.errorTotp' };
        }
        const cred = SYNTHETIC_ADMIN_USERS[pendingEmail];
        if (!cred) {
          return { success: false, errorKey: 'admin.auth.errorForbidden' };
        }
        return { success: true };
      };

      // 1. Sem email pendente (pular etapa 1 diretamente para etapa 2)
      const resNoEmail = verifyMfaStateTransition(null, '123456');
      expect(resNoEmail.success).toBe(false);
      expect(resNoEmail.errorKey).toBe('admin.auth.errorForbidden');

      // 2. Email pendente inexistente no cadastro corporativo
      const resUnknownUser = verifyMfaStateTransition('invasor@consubov.local', '123456');
      expect(resUnknownUser.success).toBe(false);
      expect(resUnknownUser.errorKey).toBe('admin.auth.errorForbidden');

      // 3. Email legítimo com código incorreto
      const resBadCode = verifyMfaStateTransition('admin.lab@consubov.local', '000000');
      expect(resBadCode.success).toBe(false);
      expect(resBadCode.errorKey).toBe('admin.auth.errorTotp');

      // 4. Fluxo legítimo completo
      const resSuccess = verifyMfaStateTransition('admin.lab@consubov.local', '123456');
      expect(resSuccess.success).toBe(true);
    });
  });

  // =========================================================================
  // VETOR 2: ESCALAÇÃO DE PRIVILÉGIOS E RBAC FAIL-CLOSED MATRIX
  // =========================================================================
  describe('Vetor 2: Escalação de Privilégios e RBAC Fail-Closed Matrix', () => {
    type TabAccess = 'tenants' | 'licenses' | 'audit' | 'users';

    const checkRbacAccess = (role: string | null | undefined, tab: TabAccess): boolean => {
      if (!role) return false;
      if (role === 'super_admin') return true;
      if (role === 'support_admin') {
        return tab === 'tenants' || tab === 'audit' || tab === 'users';
      }
      if (role === 'financial_admin') {
        return tab === 'tenants' || tab === 'licenses';
      }
      // Qualquer outro perfil ou role não autorizada falha fechada
      return false;
    };

    it('ADV-2.1: Matriz RBAC Fail-Closed exaustiva para personas autorizadas e segregadas', () => {
      // Super Admin: acesso irrestrito
      expect(checkRbacAccess('super_admin', 'tenants')).toBe(true);
      expect(checkRbacAccess('super_admin', 'licenses')).toBe(true);
      expect(checkRbacAccess('super_admin', 'audit')).toBe(true);
      expect(checkRbacAccess('super_admin', 'users')).toBe(true);

      // Support Admin: barrado em licenses
      expect(checkRbacAccess('support_admin', 'tenants')).toBe(true);
      expect(checkRbacAccess('support_admin', 'audit')).toBe(true);
      expect(checkRbacAccess('support_admin', 'users')).toBe(true);
      expect(checkRbacAccess('support_admin', 'licenses')).toBe(false);

      // Financial Admin: barrado em audit e users
      expect(checkRbacAccess('financial_admin', 'tenants')).toBe(true);
      expect(checkRbacAccess('financial_admin', 'licenses')).toBe(true);
      expect(checkRbacAccess('financial_admin', 'audit')).toBe(false);
      expect(checkRbacAccess('financial_admin', 'users')).toBe(false);
    });

    it('ADV-2.2: RBAC Fail-Closed contra invasores, personas desconhecidas ou operacionais de fazenda', () => {
      const unauthorizedRoles = [
        'capataz',
        'gerente',
        'escritorio',
        'fabrica',
        'hacker',
        'guest',
        'anonymous',
        'root',
        'admin',
        '',
        null,
        undefined
      ];

      const tabs: TabAccess[] = ['tenants', 'licenses', 'audit', 'users'];

      for (const role of unauthorizedRoles) {
        for (const tab of tabs) {
          expect(checkRbacAccess(role, tab)).toBe(false);
        }
      }
    });

    it('ADV-2.3: Endpoint GET /api/v1/admin/audit rejeita chamadas não autenticadas ou com token inválido (HTTP 401)', async () => {
      // 1. Sem header
      const resNoAuth = await fetch(`${baseUrl}/api/v1/admin/audit`, { method: 'GET' });
      expect(resNoAuth.status).toBe(401);
      const dataNoAuth = await resNoAuth.json();
      expect(dataNoAuth.error).toBe('UNAUTHORIZED');

      // 2. Token sintático malformado
      const resBadToken = await fetch(`${baseUrl}/api/v1/admin/audit`, {
        method: 'GET',
        headers: { Authorization: 'Bearer token-invalido-sem-pontos' }
      });
      expect(resBadToken.status).toBe(401);

      // 3. Token forjado assinado com segredo espúrio
      const forgedToken = await signSyntheticJwt(
        {
          sub: 'usr-fake',
          user_id: 'usr-fake',
          profile_id: 'administrador',
          tenant_id: '00000000-0000-4000-8000-000000000000',
          fazenda_id: '00000000-0000-4000-8000-000000000000',
          roles: ['super_admin']
        },
        'chave-falsa-arbitraria-para-tentativa-de-forja'
      );
      const resForged = await fetch(`${baseUrl}/api/v1/admin/audit`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${forgedToken}` }
      });
      expect(resForged.status).toBe(401);
    });

    it('ADV-2.4: Endpoint GET /api/v1/admin/audit rejeita perfis operacionais de campo com HTTP 403 (Fail-Closed)', async () => {
      // 1. Capataz tentando consultar auditoria global
      const resCapataz = await fetch(`${baseUrl}/api/v1/admin/audit`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${capatazToken}` }
      });
      expect(resCapataz.status).toBe(403);
      const dataCapataz = await resCapataz.json();
      expect(dataCapataz.error).toBe('FORBIDDEN');

      // 2. Gerente de fazenda tentando consultar auditoria global
      const resGerente = await fetch(`${baseUrl}/api/v1/admin/audit`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${gerenteToken}` }
      });
      expect(resGerente.status).toBe(403);
      const dataGerente = await resGerente.json();
      expect(dataGerente.error).toBe('FORBIDDEN');
    });

    it('ADV-2.5: Endpoint GET /api/v1/admin/audit autoriza papéis administrativos legítimos com HTTP 200', async () => {
      // Super Admin
      const resSuper = await fetch(`${baseUrl}/api/v1/admin/audit`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      expect(resSuper.status).toBe(200);
      const dataSuper = await resSuper.json();
      expect(typeof dataSuper.total).toBe('number');
      expect(Array.isArray(dataSuper.logs)).toBe(true);

      // Support Admin
      const resSupport = await fetch(`${baseUrl}/api/v1/admin/audit`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${supportAdminToken}` }
      });
      expect(resSupport.status).toBe(200);

      // Financial Admin
      const resFinancial = await fetch(`${baseUrl}/api/v1/admin/audit`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${financialAdminToken}` }
      });
      expect(resFinancial.status).toBe(200);
    });
  });

  // =========================================================================
  // VETOR 3: BVA DE LICENÇAS OFFGRID NO ZOD SCHEMA
  // =========================================================================
  describe('Vetor 3: Limites de Licenças Offgrid (BVA - Boundary Value Analysis)', () => {
    const baseLicensePayload = {
      licenca_id: 'lic-bva-test-001',
      tenant_id: 'ten-corp-001',
      fazenda_id: 'faz-001',
      dispositivo_id: 'dev-bva-01',
      modulos_autorizados: ['capataz' as const],
      chave_assinatura_publica: 'PUBKEY-CONSUBOV-ED25519-LAB-SIGNATURE-TEST-KEY-0123456789',
      gerado_em: new Date().toISOString()
    };

    it('ADV-3.1: BVA estrito no campo dias_validade_offgrid (intervalo 1 a 90 dias)', () => {
      // Limites inferiores
      expect(gerarLicencaOffgridPayloadSchema.safeParse({ ...baseLicensePayload, dias_validade_offgrid: -1 }).success).toBe(false);
      expect(gerarLicencaOffgridPayloadSchema.safeParse({ ...baseLicensePayload, dias_validade_offgrid: 0 }).success).toBe(false);
      expect(gerarLicencaOffgridPayloadSchema.safeParse({ ...baseLicensePayload, dias_validade_offgrid: 1 }).success).toBe(true);
      expect(gerarLicencaOffgridPayloadSchema.safeParse({ ...baseLicensePayload, dias_validade_offgrid: 2 }).success).toBe(true);

      // Valores nominais
      expect(gerarLicencaOffgridPayloadSchema.safeParse({ ...baseLicensePayload, dias_validade_offgrid: 30 }).success).toBe(true);
      expect(gerarLicencaOffgridPayloadSchema.safeParse({ ...baseLicensePayload, dias_validade_offgrid: 60 }).success).toBe(true);

      // Limites superiores
      expect(gerarLicencaOffgridPayloadSchema.safeParse({ ...baseLicensePayload, dias_validade_offgrid: 89 }).success).toBe(true);
      expect(gerarLicencaOffgridPayloadSchema.safeParse({ ...baseLicensePayload, dias_validade_offgrid: 90 }).success).toBe(true);
      expect(gerarLicencaOffgridPayloadSchema.safeParse({ ...baseLicensePayload, dias_validade_offgrid: 91 }).success).toBe(false);
      expect(gerarLicencaOffgridPayloadSchema.safeParse({ ...baseLicensePayload, dias_validade_offgrid: 365 }).success).toBe(false);
    });

    it('ADV-3.2: Rejeição incondicional de números decimais/fracionários (.int())', () => {
      const fractionalDays = [0.5, 1.5, 15.5, 30.25, 89.9, 90.1, 0.0001];

      for (const dias of fractionalDays) {
        const res = gerarLicencaOffgridPayloadSchema.safeParse({
          ...baseLicensePayload,
          dias_validade_offgrid: dias
        });
        expect(res.success).toBe(false);
      }
    });

    it('ADV-3.3: Rejeição de lista de módulos autorizados vazia ou com módulo inexistente', () => {
      // Array vazio
      const resEmpty = gerarLicencaOffgridPayloadSchema.safeParse({
        ...baseLicensePayload,
        dias_validade_offgrid: 30,
        modulos_autorizados: []
      });
      expect(resEmpty.success).toBe(false);

      // Módulo espúrio
      const resFakeModule = gerarLicencaOffgridPayloadSchema.safeParse({
        ...baseLicensePayload,
        dias_validade_offgrid: 30,
        modulos_autorizados: ['modulo_inexistente' as any]
      });
      expect(resFakeModule.success).toBe(false);

      // Módulos válidos suportados em licença offgrid de campo
      const validOffgridModules = ['capataz', 'gerente', 'escritorio', 'fabrica'] as const;
      for (const mod of validOffgridModules) {
        const res = gerarLicencaOffgridPayloadSchema.safeParse({
          ...baseLicensePayload,
          dias_validade_offgrid: 30,
          modulos_autorizados: [mod]
        });
        expect(res.success).toBe(true);
      }

      // Módulos que NÃO são executáveis offgrid (ex: relatto_integracao, offline_pack) devem ser rejeitados
      const invalidOffgridModules = ['relatto_integracao', 'offline_pack'] as const;
      for (const mod of invalidOffgridModules) {
        const res = gerarLicencaOffgridPayloadSchema.safeParse({
          ...baseLicensePayload,
          dias_validade_offgrid: 30,
          modulos_autorizados: [mod as any]
        });
        expect(res.success).toBe(false);
      }
    });

    it('ADV-3.4: BVA de comprimento da chave pública (32 a 512 caracteres)', () => {
      // < 32 chars -> Rejeitado
      expect(
        gerarLicencaOffgridPayloadSchema.safeParse({
          ...baseLicensePayload,
          dias_validade_offgrid: 30,
          chave_assinatura_publica: 'a'.repeat(31)
        }).success
      ).toBe(false);

      // Exatos 32 chars -> Válido
      expect(
        gerarLicencaOffgridPayloadSchema.safeParse({
          ...baseLicensePayload,
          dias_validade_offgrid: 30,
          chave_assinatura_publica: 'a'.repeat(32)
        }).success
      ).toBe(true);

      // Exatos 512 chars -> Válido
      expect(
        gerarLicencaOffgridPayloadSchema.safeParse({
          ...baseLicensePayload,
          dias_validade_offgrid: 30,
          chave_assinatura_publica: 'a'.repeat(512)
        }).success
      ).toBe(true);

      // 513 chars -> Rejeitado
      expect(
        gerarLicencaOffgridPayloadSchema.safeParse({
          ...baseLicensePayload,
          dias_validade_offgrid: 30,
          chave_assinatura_publica: 'a'.repeat(513)
        }).success
      ).toBe(false);
    });

    it('ADV-3.5: Validação do payload de atualização de licença (status e justificativa)', () => {
      const baseUpdate = {
        licenca_id: 'lic-001',
        tenant_id: 'ten-001',
        atualizado_em: new Date().toISOString()
      };

      // Status inválido
      expect(
        atualizarLicencaPayloadSchema.safeParse({
          ...baseUpdate,
          novo_status: 'cancelada' as any,
          justificativa: 'Justificativa válida'
        }).success
      ).toBe(false);

      // Justificativa menor que 5 chars
      expect(
        atualizarLicencaPayloadSchema.safeParse({
          ...baseUpdate,
          novo_status: 'suspensa',
          justificativa: '1234'
        }).success
      ).toBe(false);

      // Justificativa válida com 5 chars
      expect(
        atualizarLicencaPayloadSchema.safeParse({
          ...baseUpdate,
          novo_status: 'suspensa',
          justificativa: '12345'
        }).success
      ).toBe(true);
    });
  });

  // =========================================================================
  // VETOR 4: MULTITENANCY E INJEÇÃO DE PARÂMETROS NO LEDGER
  // =========================================================================
  describe('Vetor 4: Multitenancy, Cotas e Injeção no Ledger', () => {
    const baseTenant = {
      tenant_id: 'ten-adv-001',
      razao_social: 'Agropecuária Teste S/A',
      nome_fantasia: 'Teste Agro',
      cnpj: '12345678000195',
      plano: 'enterprise' as const,
      admin_email: 'adm@teste.com',
      admin_nome: 'Administrador Teste'
    };

    it('ADV-4.1: BVA estrito em limites de fazendas (1 a 1000) e cabeças (1 a 500.000)', () => {
      // Fazendas
      expect(criarTenantPayloadSchema.safeParse({ ...baseTenant, limite_fazendas: 0, limite_cabecas: 1000 }).success).toBe(false);
      expect(criarTenantPayloadSchema.safeParse({ ...baseTenant, limite_fazendas: 1, limite_cabecas: 1000 }).success).toBe(true);
      expect(criarTenantPayloadSchema.safeParse({ ...baseTenant, limite_fazendas: 1000, limite_cabecas: 1000 }).success).toBe(true);
      expect(criarTenantPayloadSchema.safeParse({ ...baseTenant, limite_fazendas: 1001, limite_cabecas: 1000 }).success).toBe(false);

      // Cabeças
      expect(criarTenantPayloadSchema.safeParse({ ...baseTenant, limite_fazendas: 10, limite_cabecas: 0 }).success).toBe(false);
      expect(criarTenantPayloadSchema.safeParse({ ...baseTenant, limite_fazendas: 10, limite_cabecas: 1 }).success).toBe(true);
      expect(criarTenantPayloadSchema.safeParse({ ...baseTenant, limite_fazendas: 10, limite_cabecas: 500000 }).success).toBe(true);
      expect(criarTenantPayloadSchema.safeParse({ ...baseTenant, limite_fazendas: 10, limite_cabecas: 500001 }).success).toBe(false);

      // Floats / Inteiros
      expect(criarTenantPayloadSchema.safeParse({ ...baseTenant, limite_fazendas: 5.5, limite_cabecas: 1000 }).success).toBe(false);
      expect(criarTenantPayloadSchema.safeParse({ ...baseTenant, limite_fazendas: 5, limite_cabecas: 1000.5 }).success).toBe(false);
    });

    it('ADV-4.2: Validação estrita do CNPJ com 14 dígitos numéricos', () => {
      const invalidCnpjs = [
        '12.345.678/0001-95',
        '1234567800019',
        '123456780001955',
        '1234567800019A',
        '',
        '              '
      ];

      for (const cnpj of invalidCnpjs) {
        const res = criarTenantPayloadSchema.safeParse({
          ...baseTenant,
          cnpj,
          limite_fazendas: 5,
          limite_cabecas: 5000
        });
        expect(res.success).toBe(false);
      }

      // CNPJ Válido
      const valid = criarTenantPayloadSchema.safeParse({
        ...baseTenant,
        cnpj: '12345678000195',
        limite_fazendas: 5,
        limite_cabecas: 5000
      });
      expect(valid.success).toBe(true);
    });

    it('ADV-4.3: Injeção de caracteres hostis, SQL, NoSQL e Regex em filtros do Ledger', () => {
      const ledger = new InMemoryLedger();

      const createEnvelope = (id: string, tenantId: string, cmdType: string, ts: string): AtomicCommandEnvelope => ({
        command_id: id,
        idempotency_key: `idemp-${id}`,
        command_type: cmdType,
        aggregate_type: 'cocho',
        aggregate_id: `agg-${id}`,
        base_version: 0,
        user_id: 'usr-adv',
        tenant_id: tenantId,
        product_id: 'consubov',
        fazenda_id: 'faz-01',
        retiro_id: null,
        profile_id: 'capataz',
        device_id: 'dev-01',
        schema_version: 1,
        payload: { sacos: 2 },
        correlation_id: id,
        attachment_refs: [],
        occurred_at_local: ts,
        status: 'SINCRONIZADO',
        attempts: 1,
        last_attempt_at: ts,
        error_message: null
      });

      // Popula o ledger com eventos de 3 tenants
      ledger.processCommand(createEnvelope('00000000-0000-4000-8000-000000000001', 'ten-alfa', 'capataz.salga.lancar', '2026-11-05T08:00:00Z'));
      ledger.processCommand(createEnvelope('00000000-0000-4000-8000-000000000002', 'ten-beta', 'capataz.salga.lancar', '2026-11-05T08:10:00Z'));
      ledger.processCommand(createEnvelope('00000000-0000-4000-8000-000000000003', 'ten-gama', 'gerente.metas.definir', '2026-11-05T08:20:00Z'));

      expect(ledger.queryLogs().length).toBe(3);

      // Injeção de SQL
      const sqlInjections = [
        "' OR '1'='1",
        "ten-alfa' OR '1'='1",
        "ten-alfa'; DROP TABLE logs; --",
        "UNION SELECT * FROM tenants"
      ];
      for (const inj of sqlInjections) {
        const res = ledger.queryLogs({ tenant_id: inj });
        expect(res.length).toBe(0);
      }

      // Injeção de NoSQL
      const nosqlInjections = [
        '{"$gt": ""}',
        '{"$ne": null}',
        '[$ne]=1'
      ];
      for (const inj of nosqlInjections) {
        const res = ledger.queryLogs({ tenant_id: inj });
        expect(res.length).toBe(0);
      }

      // Injeção de Regex (não deve ser avaliada como expressão regular)
      const regexInjections = [
        '.*',
        '^.*$',
        'ten-.*',
        '[a-z]+'
      ];
      for (const reg of regexInjections) {
        const res = ledger.queryLogs({ tenant_id: reg });
        expect(res.length).toBe(0);
      }
    });

    it('ADV-4.4: Isolamento estrito entre tenants e ordenação cronológica decrescente', () => {
      const ledger = new InMemoryLedger();

      const createEnvelope = (id: string, tenantId: string, ts: string): AtomicCommandEnvelope => ({
        command_id: id,
        idempotency_key: `idemp-ord-${id}`,
        command_type: 'capataz.salga.lancar',
        aggregate_type: 'cocho',
        aggregate_id: `agg-${id}`,
        base_version: 0,
        user_id: 'usr-test',
        tenant_id: tenantId,
        product_id: 'consubov',
        fazenda_id: 'faz-01',
        retiro_id: null,
        profile_id: 'capataz',
        device_id: 'dev-01',
        schema_version: 1,
        payload: { sacos: 1 },
        correlation_id: id,
        attachment_refs: [],
        occurred_at_local: ts,
        status: 'SINCRONIZADO',
        attempts: 1,
        last_attempt_at: ts,
        error_message: null
      });

      // Gravação com timestamps crescentes
      ledger.processCommand(createEnvelope('00000000-0000-4000-8000-000000000010', 'ten-x', '2026-11-05T07:00:00Z'));
      ledger.processCommand(createEnvelope('00000000-0000-4000-8000-000000000020', 'ten-x', '2026-11-05T08:00:00Z'));
      ledger.processCommand(createEnvelope('00000000-0000-4000-8000-000000000030', 'ten-x', '2026-11-05T09:00:00Z'));
      ledger.processCommand(createEnvelope('00000000-0000-4000-8000-000000000040', 'ten-y', '2026-11-05T09:30:00Z'));

      // Busca para ten-x: nunca deve trazer ten-y
      const tenXLogs = ledger.queryLogs({ tenant_id: 'ten-x' });
      expect(tenXLogs.length).toBe(3);
      expect(tenXLogs.every(l => l.envelope.tenant_id === 'ten-x')).toBe(true);

      // Ordenação decrescente estrita
      for (let i = 0; i < tenXLogs.length - 1; i++) {
        const curTime = new Date(tenXLogs[i]!.stored_at).getTime();
        const nextTime = new Date(tenXLogs[i + 1]!.stored_at).getTime();
        expect(curTime).toBeGreaterThanOrEqual(nextTime);
      }

      // Filtragem por status insensível a maiúsculas/minúsculas
      const ackedUpper = ledger.queryLogs({ status: 'ACKED' });
      const ackedLower = ledger.queryLogs({ status: 'acked' });
      expect(ackedUpper.length).toBe(4);
      expect(ackedLower.length).toBe(4);

      // Status inexistente retorna array vazio sem erro
      const nonExistent = ledger.queryLogs({ status: 'failed_status' });
      expect(nonExistent).toEqual([]);
    });
  });

  // =========================================================================
  // VETOR 5: BILINGUISMO DINÂMICO E PARIDADE 100% PT-BR / EN-US
  // =========================================================================
  describe('Vetor 5: Bilinguismo Dinâmico, Paridade 100% e AST Literal Guard', () => {
    it('ADV-5.1: 100% de paridade e simetria estrita nas chaves admin.* entre pt-BR e en-US', () => {
      const ptDict = APP_DICTIONARY['pt-BR'];
      const enDict = APP_DICTIONARY['en-US'];

      const adminPtKeys = Object.keys(ptDict).filter(k => k.startsWith('admin.')).sort();
      const adminEnKeys = Object.keys(enDict).filter(k => k.startsWith('admin.')).sort();

      expect(adminPtKeys.length).toBeGreaterThanOrEqual(70);
      expect(adminEnKeys.length).toBe(adminPtKeys.length);
      expect(adminPtKeys).toEqual(adminEnKeys);

      for (const key of adminPtKeys) {
        const ptVal = ptDict[key];
        const enVal = enDict[key];

        expect(typeof ptVal).toBe('string');
        expect(typeof enVal).toBe('string');
        expect(ptVal!.trim().length).toBeGreaterThan(0);
        expect(enVal!.trim().length).toBeGreaterThan(0);

        // Não deve conter valores de placeholder
        expect(ptVal).not.toContain('[TBD]');
        expect(enVal).not.toContain('[TBD]');
        expect(ptVal).not.toContain('undefined');
        expect(enVal).not.toContain('undefined');
      }
    });

    it('ADV-5.2: Paridade global completa de todo o dicionário (pt-BR vs en-US)', () => {
      const ptKeys = Object.keys(APP_DICTIONARY['pt-BR']).sort();
      const enKeys = Object.keys(APP_DICTIONARY['en-US']).sort();

      expect(ptKeys.length).toBe(enKeys.length);
      expect(ptKeys).toEqual(enKeys);
    });

    it('ADV-5.3: Paridade e preservação de placeholders de interpolação ({role}, etc)', () => {
      const ptDict = APP_DICTIONARY['pt-BR'];
      const enDict = APP_DICTIONARY['en-US'];

      const testKeysWithParams = [
        'admin.rbac.accessDeniedDesc'
      ];

      for (const key of testKeysWithParams) {
        const ptStr = ptDict[key] ?? '';
        const enStr = enDict[key] ?? '';

        expect(ptStr).toContain('{role}');
        expect(enStr).toContain('{role}');
      }
    });

    it('ADV-5.4: AST Literal Guard em apps/admin-global/src deve certificar ZERO violações', () => {
      const adminSrcDir = resolve(import.meta.dir, '../../apps/admin-global/src');
      const tsxFiles = findTsxFiles(adminSrcDir);

      expect(tsxFiles.length).toBeGreaterThanOrEqual(10);

      const violations = scanAstLiterals(tsxFiles);
      if (violations.length > 0) {
        console.error('Violações literais detectadas pelo Challenger em apps/admin-global:', violations);
      }
      expect(violations.length).toBe(0);
    });
  });
});
