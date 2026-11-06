import { describe, expect, test } from 'bun:test';
import { createReport, Q8_LOCAL_CHECK_IDS, verdictForChecks, type Q8ReportInput } from '../harness/q8-report';

function fixture(): Q8ReportInput {
  const baseline = { root: '/fixture', head: 'a'.repeat(40), branch: '(detached)', dirty: true, changedFileHashes: { 'next-platform/new.ts': 'dirty-bytes' } };
  const source = { files: { 'new.ts': 'dirty-bytes' }, sha256: 'current-manifest', exclusions: ['.qa'] };
  return { runId: 'own-run', startedAt: 'start', finishedAt: 'end', baseline, finalBaseline: structuredClone(baseline), canonicalBefore: baseline, canonicalAfter: structuredClone(baseline), sourceBefore: source, sourceAfter: structuredClone(source), checks: Q8_LOCAL_CHECK_IDS.map(id => ({ id, name: id, status: 'PASS', duration_ms: 1 })) };
}
describe('Q8 report evidence derivation', () => {
  test('first report requires no previous receipt and retains dirty source identity', () => {
    const report = createReport(fixture());
    expect(report.localGateVerdict).toBe('PASS');
    expect(report.verdict).toBe('NAO_EXECUTADO');
    expect(report.developmentVerdict).toBe('NAO_EXECUTADO');
    expect(report.sourceIdentity).toEqual({ commit: 'a'.repeat(40), dirty: true, manifestSha256: 'current-manifest' });
    expect(report.audit_flags.production_gate).toBe('NO_GO');
    expect(report.audit_flags.closure_status).toBe('HOMOLOGACAO_PENDENTE');
  });
  test('failure cannot produce corresponding success flag or closure approval', () => {
    const input = fixture(); input.checks[5]!.status = 'FAIL';
    const report = createReport(input);
    expect(report.verdict).toBe('FAIL');
    expect(report.audit_flags.typecheck_zero_errors).toBe(false);
    expect(report.summary.failed).toBe(1);
  });
  test.each(['NAO_EXECUTADO', 'BLOQUEADO'] as const)('%s check does not certify its flag', status => {
    const input = fixture(); input.checks[0]!.status = status;
    expect(createReport(input).audit_flags.iso_unit_suite_passed).toBe(false);
    expect(createReport(input).localGateVerdict).toBe(status);
  });
  test('new untracked source bytes invalidate stability even when HEAD is unchanged', () => {
    const input = fixture(); input.sourceAfter!.files['new.ts'] = 'changed';
    const report = createReport(input);
    expect(report.sourceUnchanged).toBe(false);
    expect(report.verdict).toBe('BLOQUEADO');
    expect(report.audit_flags.monorepo_regression_all_passed).toBe(false);
  });
  test('changed Git identity or canonical bytes block the gate', () => {
    for (const field of ['finalBaseline', 'canonicalAfter'] as const) {
      const input = fixture(); input[field]!.changedFileHashes = { arbitrary: 'changed' };
      expect(createReport(input).verdict).toBe('BLOQUEADO');
    }
  });
  test('empty, missing and duplicate checks cannot certify the gate', () => {
    expect(verdictForChecks([])).toBe('NAO_EXECUTADO');
    const input = fixture(); input.checks.pop();
    expect(createReport(input).localGateVerdict).toBe('NAO_EXECUTADO');
    const duplicate = fixture(); duplicate.checks.push(duplicate.checks[0]!);
    expect(createReport(duplicate).verdict).toBe('BLOQUEADO');
    expect(createReport(duplicate).localGateVerdict).toBe('BLOQUEADO');
  });
});
