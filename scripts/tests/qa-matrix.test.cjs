const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const runner=path.resolve(__dirname,'../qa/run-matrix.mjs');
function simulate(failing, tasks='qa:regressions,qa:phase5') {
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'qa-matrix-'));
  const exe=path.join(tmp,'task');
  fs.writeFileSync(exe, '#!/bin/sh\necho "called:$1"\n[ "$1" = "$FAILING_TASK" ] && exit 3\nexit 0\n');
  fs.chmodSync(exe,0o755);
  const result=spawnSync(process.execPath,[runner,'--only='+tasks],{
    env:{...process.env,PATH:tmp+':'+process.env.PATH,FAILING_TASK:failing},
    encoding:'utf8',cwd:tmp,
  });
  const filename=result.stdout.match(/MATRIX_REPORT=(.+)/)?.[1]?.trim();
  const report=filename&&fs.existsSync(filename)?JSON.parse(fs.readFileSync(filename,'utf8')):null;
  fs.rmSync(tmp,{recursive:true,force:true});
  return {result,report};
}
test('matrix runs every selected phase despite one failure, but aggregate remains FAIL',()=>{
  const {result,report}=simulate('qa:regressions');
  assert.equal(result.status,1,result.stderr);
  assert.equal(report.status,'FAIL');
  assert.deepEqual(report.results.map(r=>r.status),['FAIL','PASS']);
  assert.deepEqual(report.results.map(r=>r.exitCode),[3,0]);
});
test('all green matrix yields PASS and evidence metadata',()=>{
  const {result,report}=simulate('none');
  assert.equal(result.status,0,result.stderr);assert.equal(report.status,'PASS');
  assert.ok(report.startedAt);assert.ok(report.finishedAt);
  assert.equal(report.results.length,2);
});
test('unknown tasks are rejected before executing anything',()=>{
  const {result,report}=simulate('none','qa:delete-production');
  assert.equal(result.status,2);assert.equal(report,null);
});
