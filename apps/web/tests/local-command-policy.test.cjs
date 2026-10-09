const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/platform/offline/commandPolicy.ts'), 'utf8');
const code = ts.transpileModule(source, {compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const modExports = {};
vm.runInNewContext('(function(exports){' + code + '\n})')(modExports);
const {makePendingCommand,beginCommandAttempt,acknowledgeCommand,retryAfterUncertainDelivery,markCommandConflict,assertCommandOwner} = modExports;
const owner = {tenantId:'tenant-a',userId:'user-a'};
const input = () => ({commandId:'c1',idempotencyKey:'idem-c1',tenantId:owner.tenantId,userId:owner.userId,deviceId:'device-01',kind:'pesagem',createdAt:'2026-10-09T10:00:00Z',payload:{weight:460}});

test('creates a pending command with stable identity and no ACK',()=>{
  const c=makePendingCommand(input());
  assert.equal(c.status,'pending');assert.equal(c.attemptCount,0);
  assert.equal(c.idempotencyKey,'idem-c1');
});
test('replay on uncertain timeout never creates a new idempotency key',()=>{
  const created=makePendingCommand(input());
  const sent=beginCommandAttempt(created,owner);
  const again=beginCommandAttempt(retryAfterUncertainDelivery(sent,owner),owner);
  assert.equal(again.commandId,created.commandId);assert.equal(again.idempotencyKey,created.idempotencyKey);
  assert.equal(again.attemptCount,2);
});
test('ack rejects another tenant, user or command',()=>{
  const inflight=beginCommandAttempt(makePendingCommand(input()),owner);
  assert.throws(()=>acknowledgeCommand(inflight,owner,{commandId:'c2',idempotencyKey:'idem-c1',...owner}));
  assert.throws(()=>acknowledgeCommand(inflight,owner,{commandId:'c1',idempotencyKey:'idem-c1',tenantId:'tenant-b',userId:'user-a'}));
  assert.throws(()=>acknowledgeCommand(inflight,{tenantId:'tenant-b',userId:'user-a'},{commandId:'c1',idempotencyKey:'idem-c1',...owner}));
});
test('only verified ACK can set acked status; acked commands are not retried',()=>{
  const inflight=beginCommandAttempt(makePendingCommand(input()),owner);
  const done=acknowledgeCommand(inflight,owner,{commandId:'c1',idempotencyKey:'idem-c1',...owner});
  assert.equal(done.status,'acked');
  assert.throws(()=>beginCommandAttempt(done,owner));
});
test('conflicts are never auto-acked or blindly retried',()=>{
  const inflight=beginCommandAttempt(makePendingCommand(input()),owner);
  const conflict=markCommandConflict(inflight,owner);
  assert.equal(conflict.status,'conflict');assert.throws(()=>beginCommandAttempt(conflict,owner));
  assert.throws(()=>acknowledgeCommand(conflict,owner,{commandId:'c1',idempotencyKey:'idem-c1',...owner}));
});
test('invalid owner, identifiers or missing payload are rejected',()=>{
  assert.throws(()=>makePendingCommand({...input(),tenantId:' '}));
  assert.throws(()=>makePendingCommand({...input(),payload:undefined}));
  assert.throws(()=>assertCommandOwner(makePendingCommand(input()),{tenantId:owner.tenantId,userId:'someone-else'}));
});
