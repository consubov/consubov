/** Portable local QA matrix; does not call GitHub Actions or any remote system. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sourceState } from './source-state.mjs';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const available = [
  'qa:regressions', 'qa:check', 'qa:phase5',
  'qa:pwa:build-preflight', 'qa:pwa:upgrade-fixture',
  'qa:offline:core', 'qa:offline:browser', 'qa:offline:inventory', 'qa:phase6', 'qa:phase7', 'qa:phase8', 'qa:phase9', 'qa:phase10',
];
const opts = process.argv.slice(2);
if (opts.length > 1 || (opts.length === 1 && !opts[0].startsWith('--only='))) {
  console.error('Usage: node scripts/qa/run-matrix.mjs [--only=qa:phase5,qa:phase6]');
  process.exit(2);
}
const selected = opts.length === 0 ? available : opts[0].slice('--only='.length).split(',');
if (selected.length === 0 || selected.some(name => !available.includes(name)) || new Set(selected).size !== selected.length) {
  console.error('Invalid QA matrix tasks:', selected.join(','));
  process.exit(2);
}

const initialSource = sourceState(repoRoot);
const sha = initialSource.commit;
let dirty = initialSource.workingTreeDirty;
let sourceUnchanged = initialSource.fingerprint !== null;
let finalSource = initialSource;
const now = new Date();
const runId = now.toISOString().replace(/[-:.]/g, '').replace('T', 'T').slice(0, 15) + '-' + process.pid;
const runDir = path.join(repoRoot, '.qa', 'matrix', runId);
fs.mkdirSync(runDir, { recursive: true });
const records = [];
const simulated = process.env.NODE_ENV === 'test' && Boolean(process.env.QA_MATRIX_TEST_EXECUTABLE);
const executable = simulated ? process.execPath : (process.platform === 'win32' ? 'task.exe' : 'task');
for (const name of selected) {
  const startedAt = new Date().toISOString();
  console.log('[qa:matrix] START', name);
  const result = spawnSync(executable, simulated ? [process.env.QA_MATRIX_TEST_EXECUTABLE, name] : [name], { cwd: repoRoot, stdio: 'inherit', env: process.env });
  finalSource = sourceState(repoRoot);
  dirty ||= finalSource.workingTreeDirty;
  const unchanged = finalSource.fingerprint !== null && finalSource.fingerprint === initialSource.fingerprint;
  sourceUnchanged &&= unchanged;
  const exitCode = result.status ?? 2;
  const status = exitCode === 0 && !result.error && !result.signal ? 'PASS' : 'FAIL';
  records.push({ task: name, status, exitCode, startedAt, finishedAt: new Date().toISOString(), error: result.error?.code ?? result.signal ?? null, sourceCommitAfter: finalSource.commit, sourceUnchanged: unchanged });
  console.log('[qa:matrix]', status, name, 'exit=' + exitCode);
}
const summary = {
  kind: 'local-qa-matrix', startedAt: now.toISOString(), finishedAt: new Date().toISOString(),
  branch: initialSource.branch, commit: sha, workingTreeDirty: dirty,
  sourceUnchanged, sourceFingerprint: initialSource.fingerprint, finalSourceFingerprint: finalSource.fingerprint, finalCommit: finalSource.commit, finalWorkingTreeDirty: finalSource.workingTreeDirty,
  operatingSystem: os.platform(), node: process.version, simulated,
  status: sourceUnchanged && records.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL',
  results: records,
};
const reportPath = path.join(runDir, 'result.json');
fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2) + '\n');
const markdown = [
  '# Local QA Matrix', '',
  '- Commit: ' + sha,
  '- Dirty: ' + dirty,
  '- Source unchanged during run: ' + sourceUnchanged,
  '- Status: **' + summary.status + '**', '',
  '| Task | Status | Exit |', '| --- | --- | --- |',
  ...records.map(item => '| ' + item.task + ' | ' + item.status + ' | ' + item.exitCode + ' |'), '',
  '> Local development artifact, not evidence of device homologation.', '',
].join('\n');
fs.writeFileSync(path.join(runDir, 'summary.md'), markdown);
console.log('MATRIX_REPORT=' + reportPath);
process.exit(summary.status === 'PASS' ? 0 : 1);
