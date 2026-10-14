/** Fail closed: local evidence check only; never claims production authorization. */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const defaultRequired = ['qa:phase5', 'qa:phase6', 'qa:phase7'];
const required = process.env.QA_REQUIRED_GATES
  ? process.env.QA_REQUIRED_GATES.split(',').map(s => s.trim()).filter(Boolean)
  : defaultRequired;
const fail = (why) => { console.error('[preprod:local] FAIL', why); process.exitCode = 1; };
const reportPath = process.env.QA_MATRIX_REPORT;
let report;
if (!reportPath) fail('Explicit QA_MATRIX_REPORT path required');
else {
  try { report = JSON.parse(fs.readFileSync(reportPath, 'utf8')); }
  catch { fail('Missing/invalid matrix evidence'); }
}
let sha;
try {
  const options = { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
  sha = execFileSync('git', ['rev-parse', 'HEAD'], options).trim();
  if (execFileSync('git', ['status', '--porcelain'], options).trim()) {
    fail('Current checkout has untested changes');
  }
} catch { fail('Cannot verify current Git checkout'); }
if (!/^[a-f0-9]{40}$/i.test(sha || '')) fail('Expected SHA must be full 40 hex chars');
if (report === null || typeof report !== 'object' || Array.isArray(report)) {
  fail('Matrix evidence must be a non-null JSON object');
} else {
  if (report.kind !== 'local-qa-matrix' || report.status !== 'PASS') fail('QA matrix is not approved');
  if (report.simulated !== false || report.workingTreeDirty !== false) fail('Simulated, incomplete or dirty matrix evidence cannot approve');
  if (report.sourceUnchanged !== true || report.finalCommit !== report.commit) fail('Source stability during QA was not proven');
  if (report.commit !== sha) fail('Matrix commit does not match checked revision');
  if (!Array.isArray(report.results)) fail('Matrix results must be an array');
  else for (const task of required) {
    const found = report.results.filter(item => item && item.task === task);
    if (found.length !== 1 || found[0].status !== 'PASS' || found[0].exitCode !== 0) {
      fail('Required local gate missing/failing: ' + task);
    }
  }
}
if (!process.exitCode) console.log('[preprod:local] PASS: local gate evidence only. Physical pilot, rollback and explicit release authorization remain PENDING.');
