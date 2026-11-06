import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createReport, Q8_LOCAL_CHECK_IDS, type Q8Check, type Q8ReportInput } from '../harness/q8-report';
import { assertOnlyNextPlatformChanges, canonicalRepository, captureGitBaseline, captureSourceManifest, createOwnedQaDirectory, nextPlatformDir, worktreeDir } from '../harness/workspace-baseline';

const qaDir = resolve(import.meta.dir, '..');
const checks: Q8Check[] = [];
const startedAt = new Date().toISOString();
let outputPath: string | undefined;
function log(message: string) {
  console.log(message);
  if (outputPath) appendFileSync(outputPath, `${message}\n`, 'utf8');
}
function runCheck(id: string, name: string, args: string[], cwd = qaDir) {
  const started = Date.now();
  log(`[RUN] ${id}: ${name}`);
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', shell: false, windowsHide: true, timeout: 600_000, maxBuffer: 32 * 1024 * 1024 });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  // Bun can return success with no matching tests. Such a run provides no evidence.
  const coverageObserved = args[0] !== 'test' || /\b[1-9]\d* pass\b/.test(output);
  const status = !result.error && result.status === 0 && !result.signal && coverageObserved ? 'PASS' : 'FAIL';
  checks.push({ id, name, status, duration_ms: Date.now() - started, output,
    process: { command: process.execPath, args, cwd, exitCode: result.status, signal: result.signal, ...(result.error ? { error: result.error.message } : {}) } });
  log(output);
  log(`[${status}] ${id}`);
}
const state: Q8ReportInput = { runId: '', startedAt, finishedAt: '', baseline: null, finalBaseline: null, canonicalBefore: null, canonicalAfter: null, sourceBefore: null, sourceAfter: null, checks };
let canonical: string | undefined;
let reportPath: string | undefined;
try {
  // Validate the checkout identities before creating any output directory.
  if (JSON.parse(readFileSync(resolve(nextPlatformDir, 'package.json'), 'utf8')).name !== '@consubov/next-platform') throw new Error('Unexpected workspace package identity');
  canonical = canonicalRepository();
  const initialBaseline = captureGitBaseline(worktreeDir);
  state.baseline = initialBaseline;
  state.canonicalBefore = captureGitBaseline(canonical);
  state.sourceBefore = captureSourceManifest();
  const run = createOwnedQaDirectory('q8', 'runs');
  state.runId = run.path.split(/[\\/]/).at(-1)!;
  reportPath = resolve(run.path, 'result.json');
  outputPath = resolve(run.path, 'output.log');
  writeFileSync(outputPath, '', { flag: 'wx' });
  log(`Q8 local evidence ${state.runId}; HEAD=${state.baseline.head}; dirty=${state.baseline.dirty}`);
  assertOnlyNextPlatformChanges(initialBaseline);
  runCheck(Q8_LOCAL_CHECK_IDS[0], 'ISO unit matrix (memory fixtures; no browser durability claim)', ['test', 'suites/q8-consolidation-matrix.test.ts', '-t', 'ISO-', '--timeout', '30000']);
  runCheck(Q8_LOCAL_CHECK_IDS[1], 'Local-first unit matrix (memory fixtures)', ['test', 'suites/q8-consolidation-matrix.test.ts', '-t', 'LF-', '--timeout', '30000']);
  runCheck(Q8_LOCAL_CHECK_IDS[2], 'Portability unit matrix', ['test', 'suites/q8-consolidation-matrix.test.ts', '-t', 'PORT-', '--timeout', '30000']);
  runCheck(Q8_LOCAL_CHECK_IDS[3], 'AST literal scanner and dictionary key parity within scanned scope', ['test', 'suites/q8-ast-literal-guard.test.ts', '--timeout', '30000']);
  runCheck(Q8_LOCAL_CHECK_IDS[4], 'Anti-egress and worktree isolation suites', ['test', 'suites/q1-anti-egress.test.ts', 'suites/q1-isolation.test.ts', '--timeout', '30000']);
  runCheck(Q8_LOCAL_CHECK_IDS[5], 'Workspace TypeScript check', ['run', 'typecheck'], nextPlatformDir);
  runCheck(Q8_LOCAL_CHECK_IDS[6], 'Full Q1-Q8 unit/static regression', ['test', 'qa/suites/', '--timeout', '90000'], nextPlatformDir);
  const started = Date.now();
  const required = ['f08-arquitetura-plataforma-isolada.md', 'f08-guia-operacao-offgrid-capataz.md', 'f08-relatorio-encerramento-incubacao.md'];
  const documents = required.map(file => {
    try { const info = statSync(resolve(nextPlatformDir, 'docs', file)); return { file, exists: info.isFile(), bytes: info.size }; }
    catch { return { file, exists: false, bytes: 0 }; }
  });
  checks.push({ id: Q8_LOCAL_CHECK_IDS[7], name: 'Historical documentation file existence only; content and closure not approved', status: documents.every(doc => doc.exists && doc.bytes > 0) ? 'PASS' : 'FAIL', duration_ms: Date.now() - started, output: JSON.stringify(documents) });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  checks.push({ id: 'Q8_EXECUTION_CONTEXT', name: 'Execution context and scope', status: 'BLOQUEADO', duration_ms: 0, output: message });
  log(`[BLOQUEADO] ${message}`);
} finally {
  for (const id of Q8_LOCAL_CHECK_IDS) if (!checks.some(check => check.id === id)) checks.push({ id, name: id, status: 'NAO_EXECUTADO', duration_ms: 0 });
  for (const [id, name] of [
    ['Q8_REAL_BROWSER', 'Chromium/WebKit and persistence matrix: separate coordinated execution required'],
    ['Q8_PHYSICAL_HARDWARE', 'Physical devices: not executed by this runner'],
    ['Q8_INDEPENDENT_QA', 'Independent acceptance: not performed by this runner']
  ]) checks.push({ id: id!, name: name!, status: 'NAO_EXECUTADO', duration_ms: 0 });
  try {
    state.finalBaseline = captureGitBaseline(worktreeDir);
    if (canonical) state.canonicalAfter = captureGitBaseline(canonical);
    state.sourceAfter = captureSourceManifest();
  } catch (error) {
    checks.push({ id: 'Q8_FINAL_BASELINE', name: 'Final stability capture', status: 'BLOQUEADO', duration_ms: 0, output: String(error) });
  }
  state.finishedAt = new Date().toISOString();
  const report = createReport(state);
  if (reportPath) {
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    const persisted = JSON.parse(readFileSync(reportPath, 'utf8'));
    if (persisted.runId !== report.runId || persisted.sourceBefore?.sha256 !== report.sourceBefore?.sha256 || persisted.verdict !== report.verdict) throw new Error('Persisted receipt validation failed');
    log(`Receipt: ${reportPath}`);
  }
  log(`Local checks=${report.localGateVerdict}; overall=${report.verdict}; production=NO_GO`);
  // This command's exit describes the local test gate, never whole-phase approval.
  process.exitCode = report.localGateVerdict === 'PASS' && !checks.some(check => check.status === 'FAIL' || check.status === 'BLOQUEADO') ? 0 : 1;
}
