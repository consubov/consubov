const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const check = path.resolve(__dirname, '../qa/check-preprod-local-gates.mjs');
const sha = 'c'.repeat(40);
const record = () => ({
  kind: 'local-qa-matrix', status: 'PASS', simulated: false, workingTreeDirty: false,
  commit: sha, finalCommit: sha, sourceUnchanged: true,
  results: ['qa:phase5', 'qa:phase6', 'qa:phase7'].map(task => ({ task, status: 'PASS', exitCode: 0 })),
});
function run(data = record(), expected = sha, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preprod-git-'));
  const checker = path.join(dir, 'scripts', 'qa', 'check-preprod-local-gates.mjs');
  const file = path.join(dir, '.qa', 'matrix.json');
  fs.mkdirSync(path.dirname(checker), { recursive: true });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.copyFileSync(check, checker);
  fs.writeFileSync(path.join(dir, '.gitignore'), '.qa/\n');
  fs.writeFileSync(path.join(dir, 'source.txt'), 'tested source\n');
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    git('init', '-q'); git('config', 'user.name', 'Local QA Fixture');
    git('config', 'user.email', 'qa@example.invalid'); git('add', '.'); git('commit', '-qm', 'Baseline');
    const realSha = git('rev-parse', 'HEAD').trim();
    if (data) {
      const report = { ...data, commit: expected === sha ? realSha : expected,
        finalCommit: data.finalCommit === sha ? realSha : data.finalCommit };
      fs.writeFileSync(file, JSON.stringify(report));
    }
    if (options.raw !== undefined) fs.writeFileSync(file, options.raw);
    if (options.dirty) fs.writeFileSync(path.join(dir, 'source.txt'), 'untested change\n');
    return spawnSync(process.execPath, [checker], {
      cwd: dir, encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test', QA_MATRIX_REPORT: file, QA_EXPECTED_COMMIT: realSha, ...(options.env || {}) },
    });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
test('complete clean current SHA local QA is eligible for prerelease review, not production', () => {
  const r = run(); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /release authorization remain PENDING/);
});
test('missing evidence fails closed', () => assert.notEqual(run(null).status, 0));
test('wrong SHA fails', () => assert.notEqual(run(record(), 'a'.repeat(40)).status, 0));
test('dirty result fails', () => assert.notEqual(run({ ...record(), workingTreeDirty: true }).status, 0));
test('simulated QA fails', () => assert.notEqual(run({ ...record(), simulated: true }).status, 0));
test('missing phase6 fails', () => assert.notEqual(run({ ...record(), results: record().results.filter(r => r.task !== 'qa:phase6') }).status, 0));
test('phase7 failed despite matrix label passes still fails', () => assert.notEqual(run({
  ...record(), results: record().results.map(r => r.task === 'qa:phase7' ? { ...r, status: 'FAIL', exitCode: 1 } : r),
}).status, 0));
test('missing simulation or dirty fields fails closed', () => {
  const d = record(); delete d.simulated; assert.notEqual(run(d).status, 0);
});
test('literal JSON null is not accepted as evidence', () => assert.notEqual(run(null, sha, { raw: 'null' }).status, 0));
test('literal JSON false is not accepted as evidence', () => assert.notEqual(run(null, sha, { raw: 'false' }).status, 0));
test('changes to current checkout invalidate an old clean report', () => {
  assert.notEqual(run(record(), sha, { dirty: true }).status, 0);
});
test('source changes during a successful test sequence invalidate the report', () => {
  assert.notEqual(run({ ...record(), sourceUnchanged: false }).status, 0);
});
test('QA_REQUIRED_GATES up to phase9 passes when all gates are green', () => {
  const fullRecord = {
    ...record(),
    results: ['qa:phase5', 'qa:phase6', 'qa:phase7', 'qa:phase8', 'qa:phase9'].map(task => ({ task, status: 'PASS', exitCode: 0 })),
  };
  const r = run(fullRecord, sha, {
    env: { QA_REQUIRED_GATES: 'qa:phase5,qa:phase6,qa:phase7,qa:phase8,qa:phase9' },
  });
  assert.equal(r.status, 0, r.stderr);
});
test('QA_REQUIRED_GATES fails when phase9 is missing', () => {
  const r = run(record(), sha, {
    env: { QA_REQUIRED_GATES: 'qa:phase5,qa:phase6,qa:phase7,qa:phase8,qa:phase9' },
  });
  assert.notEqual(r.status, 0);
});
