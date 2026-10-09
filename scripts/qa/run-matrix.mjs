/** Portable local QA matrix; does not call GitHub Actions or any remote system. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const available = [
  'qa:regressions', 'qa:check', 'qa:phase5',
  'qa:offline:inventory', 'qa:phase6', 'qa:phase7',
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

let sha = 'no-git';
let dirty = true;
try {
  sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  dirty = execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().length > 0;
} catch { /* no local Git checkout; report as dirty and keep executing tests */ }
const now = new Date();
const runId = now.toISOString().replace(/[-:.]/g, '').replace('T', 'T').slice(0, 15) + '-' + process.pid;
const runDir = path.join(repoRoot, '.qa', 'matrix', runId);
fs.mkdirSync(runDir, { recursive: true });
const records = [];
const executable = process.platform === 'win32' ? 'task.exe' : 'task';
for (const name of selected) {
  const startedAt = new Date().toISOString();
  console.log('[qa:matrix] START', name);
  const result = spawnSync(executable, [name], { cwd: repoRoot, stdio: 'inherit', env: process.env });
  const exitCode = result.status ?? 2;
  const status = exitCode === 0 && !result.error && !result.signal ? 'PASS' : 'FAIL';
  records.push({ task: name, status, exitCode, startedAt, finishedAt: new Date().toISOString(), error: result.error?.code ?? result.signal ?? null });
  console.log('[qa:matrix]', status, name, 'exit=' + exitCode);
}
const summary = {
  kind: 'local-qa-matrix', startedAt: now.toISOString(), finishedAt: new Date().toISOString(),
  branch: process.env.GIT_BRANCH ?? null, commit: sha, workingTreeDirty: dirty,
  operatingSystem: os.platform(), node: process.version,
  status: records.every(item => item.status === 'PASS') ? 'PASS' : 'FAIL',
  results: records,
};
const reportPath = path.join(runDir, 'result.json');
fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2) + '\n');
const markdown = [
  '# Local QA Matrix', '',
  '- Commit: ' + sha,
  '- Dirty: ' + dirty,
  '- Status: **' + summary.status + '**', '',
  '| Task | Status | Exit |', '| --- | --- | --- |',
  ...records.map(item => '| ' + item.task + ' | ' + item.status + ' | ' + item.exitCode + ' |'), '',
  '> Local development artifact, not evidence of device homologation.', '',
].join('\n');
fs.writeFileSync(path.join(runDir, 'summary.md'), markdown);
console.log('MATRIX_REPORT=' + reportPath);
process.exit(summary.status === 'PASS' ? 0 : 1);
