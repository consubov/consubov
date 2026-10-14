const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const runner=path.resolve(__dirname,'../qa/run-matrix.mjs');
function simulate(failing, tasks='qa:regressions,qa:phase5') {
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'qa-matrix-'));
  const exe=path.join(tmp,'fake-task.cjs');
  fs.writeFileSync(exe, 'process.exit(process.argv[2]===process.env.FAILING_TASK?3:0);\n');
  const result=spawnSync(process.execPath,[runner,'--only='+tasks],{
    env:{...process.env,NODE_ENV:'test',QA_MATRIX_TEST_EXECUTABLE:exe,FAILING_TASK:failing},
    encoding:'utf8',cwd:tmp,timeout:20_000,
  });
  const filename=result.stdout.match(/MATRIX_REPORT=(.+)/)?.[1]?.trim();
  const report=filename&&fs.existsSync(filename)?JSON.parse(fs.readFileSync(filename,'utf8')):null;
  fs.rmSync(tmp,{recursive:true,force:true});
  return {result,report};
}
test('matrix runs every selected phase despite one failure, but aggregate remains FAIL',()=>{
  const {result,report}=simulate('qa:regressions');
  assert.equal(result.status,1,result.stderr);
  assert.equal(report.status,'FAIL');assert.equal(report.simulated,true);
  assert.deepEqual(report.results.map(r=>r.status),['FAIL','PASS']);
  assert.deepEqual(report.results.map(r=>r.exitCode),[3,0]);
});
test('all green matrix yields PASS and evidence metadata',()=>{
  const {result,report}=simulate('none');
  assert.equal(result.status,0,result.stderr);assert.equal(report.status,'PASS');assert.equal(report.simulated,true);
  assert.ok(report.startedAt);assert.ok(report.finishedAt);
  assert.equal(report.results.length,2);
});
test('unknown tasks are rejected before executing anything',()=>{
  const {result,report}=simulate('none','qa:delete-production');
  assert.equal(result.status,2);assert.equal(report,null);
});

function sourceChangingMatrix(mode) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-source-drift-'));
  const localRunner = path.join(tmp, 'scripts', 'qa', 'run-matrix.mjs');
  fs.mkdirSync(path.dirname(localRunner), { recursive: true });
  fs.copyFileSync(runner, localRunner);
  const helper = path.join(path.dirname(runner), 'source-state.mjs');
  if (fs.existsSync(helper)) fs.copyFileSync(helper, path.join(path.dirname(localRunner), 'source-state.mjs'));
  fs.writeFileSync(path.join(tmp, '.gitignore'), '.qa/\n');
  fs.writeFileSync(path.join(tmp, 'input.txt'), 'tested source\n');
  const executable = path.join(tmp, 'fake-task.cjs');
  fs.writeFileSync(executable, `
    const fs = require('node:fs');
    const { execFileSync } = require('node:child_process');
    if (process.argv[2] === 'qa:regressions') {
      if (process.env.QA_CHANGE_MODE === 'index') {
        fs.writeFileSync('input.txt', 'index two\\n');
        execFileSync('git', ['add', 'input.txt'], { stdio: 'ignore', timeout:20_000 });
        fs.writeFileSync('input.txt', 'tested source\\n');
      } else fs.writeFileSync('input.txt', 'changed during test\\n');
      if (process.env.QA_CHANGE_MODE === 'commit') {
        execFileSync('git', ['commit', '-am', 'Changed source'], { stdio: 'ignore', timeout:20_000 });
      }
    }
  `);
  const git = (...args) => require('node:child_process').execFileSync('git', args, { cwd: tmp, stdio: 'ignore', timeout:20_000 });
  try {
    git('init', '-q');
    git('config', 'core.autocrlf', 'false');
    git('config', 'user.name', 'Local QA Fixture');
    git('config', 'user.email', 'qa@example.invalid');
    git('add', '.');
    git('commit', '-qm', 'Baseline');
    if (mode === 'index') {
      fs.writeFileSync(path.join(tmp, 'input.txt'), 'index one\n');
      git('add', 'input.txt');
      fs.writeFileSync(path.join(tmp, 'input.txt'), 'tested source\n');
    }
    const result = spawnSync(process.execPath, [localRunner, '--only=qa:regressions,qa:phase5'], {
      cwd: tmp, encoding: 'utf8', timeout:20_000,
      env: { ...process.env, NODE_ENV: 'test', QA_MATRIX_TEST_EXECUTABLE: executable, QA_CHANGE_MODE: mode },
    });
    const filename = result.stdout.match(/MATRIX_REPORT=(.+)/)?.[1]?.trim();
    return { result, report: JSON.parse(fs.readFileSync(filename, 'utf8')) };
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

test('matrix cannot approve a source tree changed while commands were running', () => {
  const { result, report } = sourceChangingMatrix('file');
  assert.notEqual(result.status, 0, 'changed source falsely passed QA');
  assert.equal(report.status, 'FAIL');
  assert.equal(report.workingTreeDirty, true);
  assert.equal(report.sourceUnchanged, false);
});

test('matrix cannot attribute results to an old commit after HEAD moves during tests', () => {
  const { result, report } = sourceChangingMatrix('commit');
  assert.notEqual(result.status, 0, 'different commits were counted as one verified run');
  assert.equal(report.status, 'FAIL');
  assert.equal(report.sourceUnchanged, false);
});

test('matrix detects index-only content drift while working source remains unchanged', () => {
  const { result, report } = sourceChangingMatrix('index');
  assert.notEqual(result.status, 0, 'staged content changed but matrix falsely approved');
  assert.equal(report.status, 'FAIL');
  assert.equal(report.sourceUnchanged, false);
  assert.notEqual(report.sourceFingerprint, report.finalSourceFingerprint);
});
