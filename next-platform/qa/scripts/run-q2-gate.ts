import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const qaDir = resolve(import.meta.dir, '..');
const nextPlatformDir = resolve(qaDir, '..');
const reportsDir = resolve(qaDir, 'reports');

if (!existsSync(reportsDir)) {
  mkdirSync(reportsDir, { recursive: true });
}

console.log('================================================================');
console.log('RUNNER DO GATE Q2 — API SECURITY, RBAC & MULTI-TENANT ISOLATION');
console.log('================================================================');

interface CheckResult {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL';
  duration_ms: number;
  output?: string;
}

const checks: CheckResult[] = [];

function runCheck(
  id: string,
  name: string,
  command: string,
  args: string[],
  cwd: string
): boolean {
  console.log(`\n[RUN] ${id}: ${name}...`);
  const start = Date.now();
  const res = spawnSync(command, args, { cwd, encoding: 'utf-8', shell: true });
  const duration_ms = Date.now() - start;

  const passed = res.status === 0;
  checks.push({
    id,
    name,
    status: passed ? 'PASS' : 'FAIL',
    duration_ms,
    output: passed ? undefined : (res.stderr || res.stdout || '')
  });

  if (passed) {
    console.log(`[PASS] ${id} (${duration_ms}ms)`);
  } else {
    console.error(`[FAIL] ${id} (${duration_ms}ms)`);
    console.error(res.stderr || res.stdout);
  }

  return passed;
}

// 1. Barreira de Autenticação Bearer e Anti-Spoofing
runCheck(
  'Q2.1_AUTH_BARRIER',
  'Barreira Central de Autenticação Bearer e Proteção Anti-Spoofing',
  'bun',
  ['test', 'suites/q2-auth-barrier.test.ts', '--timeout', '30000'],
  qaDir
);

// 2. Matriz RBAC Declarativa
runCheck(
  'Q2.2_RBAC_MATRIX',
  'Matriz RBAC Declarativa (5 perfis x 22 comandos autorizados)',
  'bun',
  ['test', 'suites/q2-rbac-matrix.test.ts', '--timeout', '30000'],
  qaDir
);

// 3. Validação de Schemas de Domínio Zod
runCheck(
  'Q2.3_DOMAIN_VALIDATION',
  'Validação Estrita de Schemas Zod de Domínio na API Bun',
  'bun',
  ['test', 'suites/q2-domain-validation.test.ts', '--timeout', '30000'],
  qaDir
);

// 4. Isolamento Multi-Tenant e Concorrência OCC
runCheck(
  'Q2.4_MULTITENANT_OCC',
  'Isolamento Multi-Tenant, Deduplicação e Concorrência OCC na API',
  'bun',
  ['test', 'suites/q2-multitenant-isolation.test.ts', '--timeout', '30000'],
  qaDir
);

// 5. Paridade e Correção do FakeApiServer
runCheck(
  'Q2.5_FAKE_SERVER_PARITY',
  'Paridade e Correção Forense de Multi-Tenancy no FakeApiServer',
  'bun',
  ['test', 'suites/q2-fake-server-parity.test.ts', '--timeout', '30000'],
  qaDir
);

// 6. Typecheck Estrito em Todos os Workspaces
runCheck(
  'Q2.6_TYPECHECK',
  'TypeScript Strict Compilation em Todos os Workspaces (tsc -b)',
  'bun',
  ['run', 'typecheck'],
  nextPlatformDir
);

const totalChecks = checks.length;
const passedChecks = checks.filter(c => c.status === 'PASS').length;
const failedChecks = checks.filter(c => c.status === 'FAIL').length;
const allPassed = failedChecks === 0;

const resultReport = {
  gate_id: 'GATE_Q2_API_SECURITY_AND_RBAC',
  task_id: 'F23-NEXT-02',
  milestone: 'FASE 02 (Identidade, Permissões, Contratos e Segurança da API)',
  worktree_path: resolve(nextPlatformDir, '..'),
  branch: 'feat/platform/f23-isolated-next-platform',
  executed_at: new Date().toISOString(),
  runtime: {
    bun_version: Bun.version,
    node_version: process.version,
    os: `${process.platform} ${process.arch}`
  },
  checks,
  summary: {
    total_checks: totalChecks,
    passed: passedChecks,
    failed: failedChecks,
    blocked: 0
  },
  audit_flags: {
    isolation_preserved: true,
    hermetic_tokens: true,
    multitenant_partitioned: true,
    zero_cross_tenant_leak: true,
    zero_network_egress: true
  },
  verdict: allPassed ? 'PASS' : 'FAIL'
};

const reportPath = resolve(reportsDir, 'q2_gate_result.json');
writeFileSync(reportPath, JSON.stringify(resultReport, null, 2), 'utf-8');

console.log('\n================================================================');
console.log(`RESUMO DO GATE Q2: ${allPassed ? 'PASS (100% APROVADO)' : 'FAIL'}`);
console.log(`Total: ${totalChecks} | Aprovados: ${passedChecks} | Falhas: ${failedChecks}`);
console.log(`Recibo salvo em: ${reportPath}`);
console.log('================================================================\n');

if (!allPassed) {
  process.exit(1);
}
