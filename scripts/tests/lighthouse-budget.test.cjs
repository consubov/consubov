const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const checker = path.resolve(__dirname, '../check-web-lighthouse-budget.mjs');
const sample = {
  categories: { performance: { score: 0.82 }, accessibility: { score: 0.95 } },
  audits: { 'largest-contentful-paint': { numericValue: 2100 }, 'cumulative-layout-shift': { numericValue: 0.08 }, 'total-blocking-time': { numericValue: 250 } },
};
function withReports(action) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lighthouse-qa-'));
  const budgetPath = path.join(dir, 'budget.json');
  fs.writeFileSync(path.join(dir, 'lighthouse-home.json'), JSON.stringify(sample));
  fs.writeFileSync(path.join(dir, 'lighthouse-login.json'), JSON.stringify(sample));
  const execute = (budget) => {
    fs.writeFileSync(budgetPath, JSON.stringify(budget));
    return spawnSync(process.execPath, [checker], { encoding: 'utf8', env: { ...process.env, QA_OUTPUT_DIR: dir, LIGHTHOUSE_BUDGET_PATH: budgetPath } });
  };
  try { return action(execute); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const approved = {
  status: 'APPROVED_BASELINE', baselineCommit: 'a'.repeat(40),
  pages: {
    home: { minimum: { performance: 0.8, accessibility: 0.9 }, maximum: { lcpMs: 2500, cls: 0.1, tbtMs: 300 } },
    login: { minimum: { performance: 0.8, accessibility: 0.9 }, maximum: { lcpMs: 2500, cls: 0.1, tbtMs: 300 } },
  },
};
test('unmeasured Lighthouse baseline cannot silently pass', () => withReports(run => {
  const r = run({ ...approved, status: 'PENDING_LOCAL_BASELINE', baselineCommit: null });
  assert.notEqual(r.status, 0);
}));
test('approved measurements inside limits pass', () => withReports(run => {
  const r = run(approved);
  assert.equal(r.status, 0, r.stderr);
}));
test('regressing a threshold fails the gate', () => withReports(run => {
  const r = run({ ...approved, pages: { ...approved.pages, home: { ...approved.pages.home, minimum: { performance: 0.9 } } } });
  assert.notEqual(r.status, 0);
}));
test('null threshold fails the gate instead of disabling it', () => withReports(run => {
  const r = run({ ...approved, pages: { ...approved.pages, login: { ...approved.pages.login, maximum: { lcpMs: null } } } });
  assert.notEqual(r.status, 0);
}));
test('an approved status with no measured page rules still fails', () => withReports(run => {
  const r = run({ ...approved, pages: {} });
  assert.notEqual(r.status, 0);
}));
test('baseline must identify the exact measured commit', () => withReports(run => {
  const r = run({ ...approved, baselineCommit: 'unknown' });
  assert.notEqual(r.status, 0);
}));

test('literal null budget fails closed rather than silently accepting a run', () => withReports(run => {
  const r = run(null); assert.notEqual(r.status, 0);
}));
test('literal false budget fails closed rather than silently accepting a run', () => withReports(run => {
  const r = run(false); assert.notEqual(r.status, 0);
}));
