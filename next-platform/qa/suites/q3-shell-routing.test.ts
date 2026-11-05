import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import { createApiServer } from '@consubov/platform-api';
import { allocateAvailablePort } from '../harness/port-allocator';
import { installNetworkGuard } from '../harness/network-guard';
import { scanAstLiterals, findTsxFiles } from '../harness/ast-literal-guard';
import {
  LocalAuthService,
  SYNTHETIC_USERS,
  LAB_DEFAULT_PASSWORD,
  InMemorySessionStorage,
  canAccessModule,
  buildPartitionKey,
  parsePartitionKey
} from '@consubov/auth-client';
import {
  APP_DICTIONARY,
  translateKey,
  SupportedLanguage,
  normalizeLanguage
} from '@consubov/contracts';

describe('Gate Q3: Shell Fazendas, Login, Roteamento por Perfil, i18n & PWA', () => {
  let restoreNetwork: () => void;
  let apiInstance: ReturnType<typeof createApiServer>;
  let baseUrl: string;
  let storage: InMemorySessionStorage;
  let authService: LocalAuthService;

  beforeAll(async () => {
    // 1. Barreira anti-egress de rede estrita
    restoreNetwork = installNetworkGuard();

    // 2. Mock API local em porta dinâmica
    const port = await allocateAvailablePort(3500);
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
  // CENÁRIO 1: AUTENTICAÇÃO DE CREDENCIAIS SINTÉTICAS LOCAIS
  // ==========================================================================
  describe('Cenário 1: Autenticação de credenciais sintéticas locais (Gerente & Capataz)', () => {
    it('Q3.1.1: deve autenticar gerente.lab@consubov.local via API local com sucesso', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'gerente.lab@consubov.local',
          password: LAB_DEFAULT_PASSWORD
        })
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.token).toBeDefined();
      expect(data.token_type).toBe('Bearer');
      expect(data.user.email).toBe('gerente.lab@consubov.local');
      expect(data.user.primary_profile).toBe('gerente');
      expect(data.context.profile_id).toBe('gerente');
    });

    it('Q3.1.2: deve autenticar capataz.lab@consubov.local via API local com sucesso', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'capataz.lab@consubov.local',
          password: LAB_DEFAULT_PASSWORD
        })
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.token).toBeDefined();
      expect(data.user.email).toBe('capataz.lab@consubov.local');
      expect(data.user.primary_profile).toBe('capataz');
      expect(data.context.profile_id).toBe('capataz');
    });

    it('Q3.1.3: deve autenticar via LocalAuthService aplicando ISO-004 (Anti-First-Match)', async () => {
      const loginRes = await authService.login({
        email: 'gerente.lab@consubov.local',
        password: LAB_DEFAULT_PASSWORD
      });

      expect(loginRes.success).toBe(true);
      expect(loginRes.session).toBeDefined();
      expect(loginRes.requires_context_selection).toBe(true);
      // ISO-004: Contexto ativo deve ser nulo até escolha consciente
      expect(loginRes.session!.active_context).toBeNull();
      expect(loginRes.available_memberships!.length).toBeGreaterThan(0);

      // Operador escolhe o vínculo conscientemente
      const membershipId = loginRes.available_memberships![0]!.membership_id;
      const contextRes = await authService.selectContext(membershipId);

      expect(contextRes.success).toBe(true);
      expect(contextRes.tokens).toBeDefined();
      expect(contextRes.session!.active_context).not.toBeNull();
      expect(contextRes.session!.active_context!.profile_id).toBe('gerente');
    });
  });

  // ==========================================================================
  // CENÁRIO 2: REJEIÇÃO DE LOGIN COM CREDENCIAIS INVÁLIDAS OU CONTA DESATIVADA
  // ==========================================================================
  describe('Cenário 2: Rejeição de login com credenciais inválidas ou conta desativada (Fail-Closed)', () => {
    it('Q3.2.1: deve rejeitar login com senha incorreta com HTTP 401 UNAUTHORIZED', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'gerente.lab@consubov.local',
          password: 'senha_incorreta_total'
        })
      });

      expect(res.status).toBe(401);
      const data: any = await res.json();
      expect(data.error).toBe('UNAUTHORIZED');
    });

    it('Q3.2.2: deve rejeitar login de usuário inexistente com HTTP 401 UNAUTHORIZED', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'fantasma@consubov.local',
          password: LAB_DEFAULT_PASSWORD
        })
      });

      expect(res.status).toBe(401);
      const data: any = await res.json();
      expect(data.error).toBe('UNAUTHORIZED');
    });

    it('Q3.2.3: deve barrar login de conta desativada/revogada com HTTP 403 FORBIDDEN', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'inativo.lab@consubov.local',
          password: LAB_DEFAULT_PASSWORD
        })
      });

      expect(res.status).toBe(403);
      const data: any = await res.json();
      expect(data.error).toBe('FORBIDDEN');
    });

    it('Q3.2.4: deve garantir que LocalAuthService não armazene sessão em caso de rejeição', async () => {
      const failRes = await authService.login({
        email: 'inativo.lab@consubov.local',
        password: LAB_DEFAULT_PASSWORD
      });

      expect(failRes.success).toBe(false);
      expect(authService.getSessionManager().getSession()).toBeNull();
      expect(storage.getItem('current')).toBeNull();
    });
  });

  // ==========================================================================
  // CENÁRIO 3: RESOLUÇÃO DE ROTAS POR PERFIL & FAIL-CLOSED
  // ==========================================================================
  describe('Cenário 3: Resolução de rotas por perfil e guarda de acesso (Fail-Closed)', () => {
    it('Q3.3.1: usuário capataz não pode acessar rota de gerente (canAccessModule === false)', async () => {
      const loginRes = await authService.login({
        email: 'capataz.lab@consubov.local',
        password: LAB_DEFAULT_PASSWORD
      });
      const memId = loginRes.available_memberships![0]!.membership_id;
      await authService.selectContext(memId);

      const activeCtx = authService.getSessionManager().getActiveContext();
      expect(activeCtx).not.toBeNull();
      expect(activeCtx!.profile_id).toBe('capataz');

      // Tentativa de rota de Gerente
      const canAccessGerente = canAccessModule(activeCtx, 'gerente');
      expect(canAccessGerente).toBe(false);

      // Acesso à própria rota do Capataz é permitido
      const canAccessCapataz = canAccessModule(activeCtx, 'capataz');
      expect(canAccessCapataz).toBe(true);
    });

    it('Q3.3.2: usuário gerente pode acessar rota de gerente mas não de fábrica ou escritório', async () => {
      const loginRes = await authService.login({
        email: 'gerente.lab@consubov.local',
        password: LAB_DEFAULT_PASSWORD
      });
      const memId = loginRes.available_memberships![0]!.membership_id;
      await authService.selectContext(memId);

      const activeCtx = authService.getSessionManager().getActiveContext();
      expect(canAccessModule(activeCtx, 'gerente')).toBe(true);
      expect(canAccessModule(activeCtx, 'fabrica')).toBe(false);
      expect(canAccessModule(activeCtx, 'escritorio')).toBe(false);
    });

    it('Q3.3.3: administrador global possui permissão universal para todos os submódulos', async () => {
      const loginRes = await authService.login({
        email: 'admin.lab@consubov.local',
        password: LAB_DEFAULT_PASSWORD
      });
      const memId = loginRes.available_memberships![0]!.membership_id;
      await authService.selectContext(memId);

      const activeCtx = authService.getSessionManager().getActiveContext();
      expect(canAccessModule(activeCtx, 'gerente')).toBe(true);
      expect(canAccessModule(activeCtx, 'capataz')).toBe(true);
      expect(canAccessModule(activeCtx, 'escritorio')).toBe(true);
      expect(canAccessModule(activeCtx, 'fabrica')).toBe(true);
    });

    it('Q3.3.4: contexto nulo resulta em bloqueio incondicional (Fail-Closed)', () => {
      expect(canAccessModule(null, 'gerente')).toBe(false);
      expect(canAccessModule(null, 'capataz')).toBe(false);
    });
  });

  // ==========================================================================
  // CENÁRIO 4: ALTERNÂNCIA DINÂMICA DE IDIOMA (pt-BR <-> en-US)
  // ==========================================================================
  describe('Cenário 4: Alternância dinâmica de idioma e paridade total de dicionário', () => {
    it('Q3.4.1: deve comprovar paridade exata de 100% das chaves entre pt-BR e en-US', () => {
      const ptKeys = Object.keys(APP_DICTIONARY['pt-BR']).sort();
      const enKeys = Object.keys(APP_DICTIONARY['en-US']).sort();

      expect(ptKeys).toEqual(enKeys);
      expect(ptKeys.length).toBeGreaterThan(25);
    });

    it('Q3.4.2: nenhuma tradução pode conter string vazia ou apenas espaços em branco', () => {
      for (const lang of ['pt-BR', 'en-US'] as SupportedLanguage[]) {
        const dict = APP_DICTIONARY[lang]!;
        for (const [key, value] of Object.entries(dict)) {
          expect(typeof value).toBe('string');
          expect(value.trim()).not.toBe('');
          expect(value).not.toContain('undefined');
          expect(value).not.toContain('null');
          expect(value).not.toContain('[object Object]');
        }
      }
    });

    it('Q3.4.3: deve traduzir termos centrais de perfil e ações nos dois idiomas', () => {
      // Português
      expect(translateKey('pt-BR', 'role.gerente')).toBe('Gerente');
      expect(translateKey('pt-BR', 'role.capataz')).toBe('Capataz');
      expect(translateKey('pt-BR', 'action.login')).toBe('Entrar');
      expect(translateKey('pt-BR', 'domain.fazenda')).toBe('Fazenda');

      // Inglês
      expect(translateKey('en-US', 'role.gerente')).toBe('Manager');
      expect(translateKey('en-US', 'role.capataz')).toBe('Ranch Supervisor');
      expect(translateKey('en-US', 'action.login')).toBe('Sign In');
      expect(translateKey('en-US', 'domain.fazenda')).toBe('Ranch');
    });

    it('Q3.4.4: deve aplicar fallback gracioso para chave inexistente sem lançar exceção', () => {
      const missing = 'chave.inexistente.de.teste';
      const res = translateKey('en-US', missing);
      expect(res).toBe(missing);

      const customFallback = translateKey('pt-BR', missing, 'Fallback Customizado');
      expect(customFallback).toBe('Fallback Customizado');
    });

    it('Q3.4.5: deve normalizar idiomas desconhecidos para pt-BR de forma segura', () => {
      expect(normalizeLanguage('fr-FR')).toBe('pt-BR');
      expect(normalizeLanguage(null)).toBe('pt-BR');
      expect(normalizeLanguage('en-US')).toBe('en-US');
    });
  });

  // ==========================================================================
  // CENÁRIO 5: PERSISTÊNCIA DE SESSÃO E IDIOMA EM STORAGE LOCAL
  // ==========================================================================
  describe('Cenário 5: Persistência de sessão, partição e idioma em storage local', () => {
    it('Q3.5.1: deve construir e interpretar a chave canônica de partição multitenant', () => {
      const partKey = buildPartitionKey(
        'tenant-lab-01',
        'user-001',
        'fazenda-01',
        'gerente'
      );
      expect(partKey).toBe('tenant-lab-01:user-001:fazenda-01:gerente');

      const parsed = parsePartitionKey(partKey);
      expect(parsed).toEqual({
        tenantId: 'tenant-lab-01',
        userId: 'user-001',
        fazendaId: 'fazenda-01',
        profileId: 'gerente'
      });
    });

    it('Q3.5.2: deve salvar e recarregar dados de sessão via SessionStorage', async () => {
      const loginRes = await authService.login({
        email: 'gerente.lab@consubov.local',
        password: LAB_DEFAULT_PASSWORD
      });
      const memId = loginRes.available_memberships![0]!.membership_id;
      await authService.selectContext(memId);

      const stored = storage.getItem('current');
      expect(stored).not.toBeNull();
      expect(stored!.session.user_email).toBe('gerente.lab@consubov.local');
      expect(stored!.session.active_context!.profile_id).toBe('gerente');
      expect(stored!.tokens).not.toBeNull();
      expect(stored!.partitionKey).toContain('gerente');
    });

    it('Q3.5.3: logout deve expurgar a sessão do storage local de forma atômica', async () => {
      const loginRes = await authService.login({
        email: 'capataz.lab@consubov.local',
        password: LAB_DEFAULT_PASSWORD
      });
      const memId = loginRes.available_memberships![0]!.membership_id;
      await authService.selectContext(memId);

      expect(storage.getItem('current')).not.toBeNull();

      authService.logout();

      expect(storage.getItem('current')).toBeNull();
      expect(authService.getSessionManager().getSession()).toBeNull();
    });
  });

  // ==========================================================================
  // CENÁRIO 6: VALIDAÇÃO DO PWA MANIFEST & INTEGRIDADE DO SHELL
  // ==========================================================================
  describe('Cenário 6: Validação de PWA manifest e integridade estrutural do Shell', () => {
    it('Q3.6.1: manifest.webmanifest deve existir e atender às especificações W3C PWA', () => {
      const manifestPath = resolve(
        import.meta.dir,
        '../../apps/fazenda/shell/public/manifest.webmanifest'
      );
      const manifestJsonPath = resolve(
        import.meta.dir,
        '../../apps/fazenda/shell/public/manifest.json'
      );

      const path = existsSync(manifestPath) ? manifestPath : manifestJsonPath;
      expect(existsSync(path)).toBe(true);

      const raw = readFileSync(path, 'utf-8');
      const manifest = JSON.parse(raw);

      // Verificações W3C Web App Manifest
      expect(manifest.name).toBeDefined();
      expect(manifest.short_name).toBeDefined();
      expect(manifest.start_url).toBeDefined();
      expect(manifest.display).toBe('standalone');
      expect(manifest.theme_color).toMatch(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
      expect(manifest.background_color).toMatch(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
      expect(Array.isArray(manifest.icons)).toBe(true);
      expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

      const has192 = manifest.icons.some((i: any) => i.sizes === '192x192');
      const has512 = manifest.icons.some((i: any) => i.sizes === '512x512');
      expect(has192).toBe(true);
      expect(has512).toBe(true);
    });

    it('Q3.6.2: Shell package.json deve declarar dependências de @consubov/ui e @consubov/auth-client', () => {
      const pkgPath = resolve(
        import.meta.dir,
        '../../apps/fazenda/shell/package.json'
      );
      expect(existsSync(pkgPath)).toBe(true);
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

      expect(pkg.dependencies['@consubov/auth-client']).toBeDefined();
      expect(pkg.dependencies['@consubov/contracts']).toBeDefined();
      expect(pkg.dependencies['@consubov/ui']).toBeDefined();
    });
  });

  // ==========================================================================
  // CENÁRIO 7: AST GUARD — VARREDURA ESTRITA DE LITERAIS EM UI (i18n AUTOMATION)
  // ==========================================================================
  describe('Cenário 7: AST Guard — Varredura Estrita contra Literais Hardcoded em Telas e Componentes TSX', () => {
    it('Q3.7.1: todos os componentes de UI em apps/fazenda/shell/src/components devem possuir zero literais fora de t(...)', () => {
      const componentsDir = resolve(
        import.meta.dir,
        '../../apps/fazenda/shell/src/components'
      );
      const files = findTsxFiles(componentsDir);
      expect(files.length).toBeGreaterThanOrEqual(7);

      const violations = scanAstLiterals(files);
      if (violations.length > 0) {
        console.error(`\n❌ [AST GUARD] ${violations.length} literais hardcoded detectados em componentes do Shell:`);
        for (const v of violations) {
          console.error(`  - [${v.kind}${v.attributeName ? ` ${v.attributeName}` : ''}] ${v.file}:${v.line} -> "${v.text}"`);
        }
      }
      expect(violations).toEqual([]);
    });

    it('Q3.7.2: todas as telas e rotas de apps/fazenda/shell/src devem possuir zero literais hardcoded', () => {
      const shellSrcDir = resolve(
        import.meta.dir,
        '../../apps/fazenda/shell/src'
      );
      const files = findTsxFiles(shellSrcDir);
      expect(files.length).toBeGreaterThanOrEqual(10);

      const violations = scanAstLiterals(files);
      if (violations.length > 0) {
        console.error(`\n❌ [AST GUARD] ${violations.length} literais hardcoded detectados em src do Shell:`);
        for (const v of violations) {
          console.error(`  - [${v.kind}${v.attributeName ? ` ${v.attributeName}` : ''}] ${v.file}:${v.line} -> "${v.text}"`);
        }
      }
      expect(violations).toEqual([]);
    });
  });
});
