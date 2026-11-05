/**
 * Catálogo e Inventário Estruturado de Portabilidade de Melhorias (PORT-001 a PORT-005)
 * Rastreia a migração controlada do monorepo legado para a nova arquitetura isolada next-platform.
 */

export interface PortabilityItem {
  id: string;
  legacy_ref: string;
  origin_branch: string;
  source_sha: string;
  pr_number?: number;
  owner: string;
  feature_name: string;
  target_module: string;
  zod_schema_ref: string;
  test_suite_ref: string;
  status: 'HOMOLOGADO' | 'IMPLEMENTADO_TESTADO' | 'PENDENTE' | 'BLOQUEADO';
  governance_reason?: string;
}

export const PORTABILITY_INVENTORY: readonly PortabilityItem[] = [
  {
    id: 'PORT-PR76',
    legacy_ref: 'PR #76 - Testes e Harness Sintético',
    origin_branch: 'fix/audit-independent-qa',
    source_sha: '6ebaa4b0',
    pr_number: 76,
    owner: 'Auditoria QA',
    feature_name: 'Laboratório Hermético e Fixtures Sintéticas',
    target_module: 'packages/testing',
    zod_schema_ref: 'atomicCommandEnvelopeSchema',
    test_suite_ref: 'qa/suites/q1-isolation.test.ts',
    status: 'HOMOLOGADO'
  },
  {
    id: 'PORT-PR135',
    legacy_ref: 'PR #135 - RLS Tenancy F12',
    origin_branch: 'feat/f12-rls-tenancy-guard',
    source_sha: '16b93499',
    pr_number: 135,
    owner: 'Security Architect',
    feature_name: 'Isolamento Multi-Tenant e Anti-Spoofing na API',
    target_module: 'packages/contracts',
    zod_schema_ref: 'TenantMembershipSchema',
    test_suite_ref: 'qa/suites/q2-multitenant-isolation.test.ts',
    status: 'HOMOLOGADO'
  },
  {
    id: 'PORT-GERENTE-GMD',
    legacy_ref: 'apps/web/src/pages/GmdPage.tsx',
    origin_branch: 'main',
    source_sha: '16b93499',
    owner: 'Squad Zootecnia',
    feature_name: 'Curvas de Ganho Médio Diário e Metas Ponderais',
    target_module: 'apps/fazenda/gerente',
    zod_schema_ref: 'gerente.gmd.ajustar_curva',
    test_suite_ref: 'qa/suites/q4-gerente-module.test.ts',
    status: 'IMPLEMENTADO_TESTADO'
  },
  {
    id: 'PORT-CAPATAZ-COCHO',
    legacy_ref: 'apps/web/src/pages/CochoPage.tsx',
    origin_branch: 'main',
    source_sha: '16b93499',
    owner: 'Squad Campo',
    feature_name: 'Registro de Escore de Cocho 0..4 e Salga Offline',
    target_module: 'apps/fazenda/capataz',
    zod_schema_ref: 'capataz.cocho.registrar_escore',
    test_suite_ref: 'qa/suites/q5-capataz-module.test.ts',
    status: 'IMPLEMENTADO_TESTADO'
  },
  {
    id: 'PORT-FABRICA-BATIDAS',
    legacy_ref: 'apps/web/src/pages/FabricaPage.tsx',
    origin_branch: 'main',
    source_sha: '16b93499',
    owner: 'Squad Nutrição',
    feature_name: 'Formulações Percentuais e Ordens de Batida',
    target_module: 'apps/fazenda/fabrica',
    zod_schema_ref: 'fabrica.formulas.salvar',
    test_suite_ref: 'qa/suites/q4-fabrica-module.test.ts',
    status: 'IMPLEMENTADO_TESTADO'
  },
  {
    id: 'PORT-ADMIN-SAAS',
    legacy_ref: 'apps/web/src/pages/AdminPage.tsx',
    origin_branch: 'main',
    source_sha: '16b93499',
    owner: 'Squad SaaS',
    feature_name: 'Painel Backoffice Global Desacoplado de Fazendas',
    target_module: 'apps/admin-global',
    zod_schema_ref: 'admin.tenants.criar',
    test_suite_ref: 'qa/suites/q6-admin-tenants.test.ts',
    status: 'IMPLEMENTADO_TESTADO'
  },
  {
    id: 'PORT-AUTOUPDATE-SW',
    legacy_ref: 'Decisão Arquitetural 04/11/2026',
    origin_branch: 'feat/platform/f23-isolated-next-platform',
    source_sha: 'e4aa3396',
    owner: 'Platform Architect',
    feature_name: 'Autoupdate Quiescente sem Clique e Rollback 404',
    target_module: 'packages/module-release',
    zod_schema_ref: 'ModuleArtifactReleaseSchema',
    test_suite_ref: 'qa/suites/q7-safe-activation.test.ts',
    status: 'IMPLEMENTADO_TESTADO'
  },
  {
    id: 'PORT-LEGACY-DIRECT-DB',
    legacy_ref: 'apps/web/src/lib/supabase.ts (Acesso direto PostgREST)',
    origin_branch: 'legacy/main',
    source_sha: '16b93499',
    owner: 'Security Council',
    feature_name: 'Acesso Direto ao Banco sem Barreira Zod de API',
    target_module: 'REJEITADO_INSEGURO',
    zod_schema_ref: 'N/A',
    test_suite_ref: 'qa/suites/q1-anti-egress.test.ts',
    status: 'BLOQUEADO',
    governance_reason: 'Risco crítico: expõe credenciais e esquema do banco. Proibido pela diretriz API-Only (LF-011).'
  },
  {
    id: 'PORT-LEGACY-ANONYMOUS-UPLOAD',
    legacy_ref: 'apps/web/src/components/Upload.tsx (Upload não autenticado)',
    origin_branch: 'legacy/main',
    source_sha: '16b93499',
    owner: 'Security Council',
    feature_name: 'Upload Direto de Binários sem Autenticação ou Dissociação',
    target_module: 'REJEITADO_INSEGURO',
    zod_schema_ref: 'N/A',
    test_suite_ref: 'qa/suites/q5-cocho-photos-compression.test.ts',
    status: 'BLOQUEADO',
    governance_reason: 'Risco de negação de serviço e injeção de malware. Substituído por foto compactada dissociada com hash SHA-256.'
  }
] as const;

export function getPortabilityItem(id: string): PortabilityItem | undefined {
  return PORTABILITY_INVENTORY.find(item => item.id === id);
}

export function getApprovedPortabilityItems(): PortabilityItem[] {
  return PORTABILITY_INVENTORY.filter(
    item => item.status === 'HOMOLOGADO' || item.status === 'IMPLEMENTADO_TESTADO'
  );
}

export function getBlockedPortabilityItems(): PortabilityItem[] {
  return PORTABILITY_INVENTORY.filter(item => item.status === 'BLOQUEADO');
}
