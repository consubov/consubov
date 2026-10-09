const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {spawnSync}=require('node:child_process');
const check=path.resolve(__dirname,'../qa/check-preprod-local-gates.mjs');
const sha='c'.repeat(40);
const record=()=>({kind:'local-qa-matrix',status:'PASS',simulated:false,workingTreeDirty:false,commit:sha,
results:['qa:phase5','qa:phase6','qa:phase7'].map(task=>({task,status:'PASS',exitCode:0}))});
function run(data=record(),expected=sha){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'preprod-'));
  const file=path.join(dir,'matrix.json');
  if(data)fs.writeFileSync(file,JSON.stringify(data));
  try{return spawnSync(process.execPath,[check],{encoding:'utf8',env:{...process.env,NODE_ENV:'test',QA_MATRIX_REPORT:file,QA_EXPECTED_COMMIT:expected}})}
  finally{fs.rmSync(dir,{force:true,recursive:true})}}
test('complete clean current SHA local QA is eligible for prerelease review, not production',()=>{
  const r=run();assert.equal(r.status,0);assert.match(r.stdout,/release authorization remain PENDING/);
});
test('missing evidence fails closed',()=>assert.notEqual(run(null).status,0));
test('wrong SHA fails',()=>assert.notEqual(run(record(),'a'.repeat(40)).status,0));
test('dirty result fails',()=>assert.notEqual(run({...record(),workingTreeDirty:true}).status,0));
test('simulated QA fails',()=>assert.notEqual(run({...record(),simulated:true}).status,0));
test('missing phase6 fails',()=>assert.notEqual(run({...record(),results:record().results.filter(r=>r.task!=='qa:phase6')}).status,0));
test('phase7 failed despite matrix label passes still fails',()=>assert.notEqual(run({...record(),results:record().results.map(r=>r.task==='qa:phase7'?{...r,status:'FAIL',exitCode:1}:r)}).status,0));
test('missing simulation or dirty fields fails closed',()=>{const d=record();delete d.simulated;assert.notEqual(run(d).status,0);});
