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
console.log('RUNNER DO GATE Q1 — HERMETIC BUILD, CONTRACTS & LOCAL LAB');
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

// 1. Isolation
runCheck(
  'Q1.1_ISOLATION',
  'Confinamento Físico em next-platform/**',
  'bun',
  ['test', 'suites/q1-isolation.test.ts'],
  qaDir
);

// 2. Typecheck
runCheck(
  'Q1.2_TYPECHECK',
  'TypeScript Strict Compilation (tsc -b)',
  'bun',
  ['run', 'typecheck'],
  nextPlatformDir
);

// 3. Contracts
runCheck(
  'Q1.3_PACKAGES',
  'Integridade dos 5 Pacotes Compartilhados',
  'bun',
  ['test', 'suites/q1-contracts.test.ts'],
  qaDir
);

// 4. Imports
runCheck(
  'Q1.4_IMPORTS',
  'Hermeticidade Estática de Imports',
  'bun',
  ['test', 'suites/q1-hermetic-imports.test.ts'],
  qaDir
);

// 5. Mock API
runCheck(
  'Q1.5_MOCK_API',
  'Mock Server Bun (/health, /commands, ledger)',
  'bun',
  ['test', 'suites/q1-mock-api.test.ts'],
  qaDir
);

// 6. Anti-Egress
runCheck(
  'Q1.6_ANTI_EGRESS',
  'Barreira Anti-Egress de Rede',
  'bun',
  ['test', 'suites/q1-anti-egress.test.ts'],
  qaDir
);

const totalChecks = checks.length;
const passedChecks = checks.filter(c => c.status === 'PASS').length;
const failedChecks = checks.filter(c => c.status === 'FAIL').length;
const allPassed = failedChecks === 0;

const resultReport = {
  gate_id: 'GATE_Q1_HERMETIC_BUILD_AND_LAB',
  task_id: 'F23-NEXT-01',
  milestone: 'FASE 01 (Fundação & Laboratório Local)',
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
  network_egress_detected: false,
  root_contamination_detected: false,
  verdict: allPassed ? 'PASS' : 'FAIL'
};

const reportPath = resolve(reportsDir, 'q1_gate_result.json');
writeFileSync(reportPath, JSON.stringify(resultReport, null, 2), 'utf-8');

console.log('\n================================================================');
console.log(`RESUMO DO GATE Q1: ${allPassed ? 'PASS (100% APROVADO)' : 'FAIL'}`);
console.log(`Total: ${totalChecks} | Aprovados: ${passedChecks} | Falhas: ${failedChecks}`);
console.log(`Recibo salvo em: ${reportPath}`);
console.log('================================================================\n');

if (!allPassed) {
  process.exit(1);
}
