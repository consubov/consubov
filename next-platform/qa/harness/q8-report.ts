export type CheckStatus = 'PASS' | 'FAIL' | 'NAO_EXECUTADO' | 'BLOQUEADO';
export interface Q8Check {
  id: string;
  name: string;
  status: CheckStatus;
  duration_ms: number;
  output?: string;
  process?: { command: string; args: string[]; cwd: string; exitCode: number | null; signal: string | null; error?: string };
}
export interface GitIdentity {
  root: string; head: string; branch: string; dirty: boolean;
  [key: string]: unknown;
}
export interface SourceManifest { files: Record<string, string>; sha256: string; exclusions: string[] }
export interface Q8ReportInput {
  runId: string; startedAt: string; finishedAt: string;
  baseline: GitIdentity | null; finalBaseline: GitIdentity | null;
  canonicalBefore: GitIdentity | null; canonicalAfter: GitIdentity | null;
  sourceBefore: SourceManifest | null; sourceAfter: SourceManifest | null;
  checks: Q8Check[];
}
export const Q8_LOCAL_CHECK_IDS = [
  'Q8.1_ISO_MATRIX_AUDIT', 'Q8.2_LOCAL_FIRST_LF_MATRIX', 'Q8.3_PORTABILITY_PORT_MATRIX',
  'Q8.4_FULL_AST_I18N_GUARD', 'Q8.5_HERMETIC_SECURITY_ANTI_EGRESS',
  'Q8.6_TYPECHECK_GLOBAL', 'Q8.7_FULL_MONOREPO_REGRESSION', 'Q8.8_DOCUMENTATION_EXISTENCE'
] as const;

/** Empty, missing and duplicate evidence cannot certify a gate. */
export function verdictForChecks(checks: Q8Check[]): CheckStatus {
  if (checks.some(check => check.status === 'FAIL')) return 'FAIL';
  if (checks.some(check => check.status === 'BLOQUEADO')) return 'BLOQUEADO';
  if (!checks.length || checks.some(check => check.status !== 'PASS')) return 'NAO_EXECUTADO';
  if (new Set(checks.map(check => check.id)).size !== checks.length) return 'BLOQUEADO';
  return 'PASS';
}
const equal = (before: unknown, after: unknown) => before != null && after != null && JSON.stringify(before) === JSON.stringify(after);

/** Pure derivation: no historical receipt, filesystem or process access. */
export function createReport(input: Q8ReportInput) {
  const checks = input.checks.map(check => ({ ...check }));
  const pass = (id: string) => checks.filter(check => check.id === id).length === 1 && checks.find(check => check.id === id)?.status === 'PASS';
  const gitUnchanged = equal(input.baseline, input.finalBaseline);
  const canonicalUnchanged = equal(input.canonicalBefore, input.canonicalAfter);
  const sourceUnchanged = equal(input.sourceBefore, input.sourceAfter);
  const stable = gitUnchanged && canonicalUnchanged && sourceUnchanged;
  const localChecks = Q8_LOCAL_CHECK_IDS.map(id => checks.find(check => check.id === id) ?? { id, name: id, status: 'NAO_EXECUTADO' as const, duration_ms: 0 });
  const localVerdict = verdictForChecks(localChecks);
  const duplicateIds = new Set(checks.map(check => check.id)).size !== checks.length;
  const localGateVerdict: CheckStatus = !stable || duplicateIds || checks.some(check => check.status === 'BLOQUEADO') ? 'BLOQUEADO' : localVerdict;
  const allVerdict = verdictForChecks(checks);
  const acceptanceObserved = ['Q8_REAL_BROWSER', 'Q8_PHYSICAL_HARDWARE', 'Q8_INDEPENDENT_QA'].every(pass);
  const verdict: CheckStatus = !stable || duplicateIds ? 'BLOQUEADO' : localVerdict !== 'PASS' ? localVerdict : allVerdict === 'PASS' && !acceptanceObserved ? 'NAO_EXECUTADO' : allVerdict;
  return {
    schemaVersion: 1, gate_id: 'GATE_Q8_LOCAL_EVIDENCE', task_id: 'F23-T07',
    runId: input.runId, startedAt: input.startedAt, finishedAt: input.finishedAt,
    branch: input.baseline?.branch ?? null, initialCommit: input.baseline?.head ?? null,
    finalCommit: input.finalBaseline?.head ?? null, dirty: input.baseline?.dirty ?? null,
    finalDirty: input.finalBaseline?.dirty ?? null,
    sourceIdentity: input.baseline && input.sourceBefore ? { commit: input.baseline.head, dirty: input.baseline.dirty, manifestSha256: input.sourceBefore.sha256 } : null,
    baseline: input.baseline, finalBaseline: input.finalBaseline,
    canonicalBefore: input.canonicalBefore, canonicalAfter: input.canonicalAfter,
    sourceBefore: input.sourceBefore, sourceAfter: input.sourceAfter,
    sourceScope: 'All next-platform files, tracked and untracked, except the explicitly listed generated outputs',
    sourceUnchanged, gitUnchanged, canonicalUnchanged, checks,
    summary: { total_checks: checks.length, passed: checks.filter(c => c.status === 'PASS').length, failed: checks.filter(c => c.status === 'FAIL').length, blocked: checks.filter(c => c.status === 'BLOQUEADO').length, not_executed: checks.filter(c => c.status === 'NAO_EXECUTADO').length },
    audit_flags: {
      isolation_preserved: stable && pass('Q8.5_HERMETIC_SECURITY_ANTI_EGRESS'),
      canonical_repo_untouched: canonicalUnchanged,
      iso_unit_suite_passed: stable && pass('Q8.1_ISO_MATRIX_AUDIT'),
      local_first_unit_suite_passed: stable && pass('Q8.2_LOCAL_FIRST_LF_MATRIX'),
      portability_unit_suite_passed: stable && pass('Q8.3_PORTABILITY_PORT_MATRIX'),
      ast_scanned_sources_passed: stable && pass('Q8.4_FULL_AST_I18N_GUARD'),
      typecheck_zero_errors: stable && pass('Q8.6_TYPECHECK_GLOBAL'),
      monorepo_regression_all_passed: stable && pass('Q8.7_FULL_MONOREPO_REGRESSION'),
      documentation_files_exist: pass('Q8.8_DOCUMENTATION_EXISTENCE'),
      production_gate: 'NO_GO', closure_status: 'HOMOLOGACAO_PENDENTE'
    },
    localGateVerdict, developmentVerdict: 'NAO_EXECUTADO' as CheckStatus,
    developmentScope: 'DEV LOCAL READY requires the separately coordinated real browser matrix; this runner measures unit/static/regression checks only.',
    verdict
  };
}
