const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
function load(sourcePath, imports = {}) {
  const js = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext("(function(exports,require){" + js + "\n})")(exports, key => {
    assert.ok(key in imports, "unexpected module " + key);
    return imports[key];
  });
  return exports;
}
const policy = load(path.resolve(__dirname, "../src/platform/offline/commandPolicy.ts"));
const { syncOneLocalCommand } = load(
  path.resolve(__dirname, "../src/platform/offline/localSyncRound.ts"),
  { "./commandPolicy": policy },
);
const owner = { tenantId: "tenant-a", userId: "user-a" };
const command = () => policy.makePendingCommand({
  commandId: "cmd-a", idempotencyKey: "idem-a", tenantId: owner.tenantId, userId: owner.userId,
  deviceId: "device-a", kind: "pesagem", createdAt: "2026-10-09T10:00:00Z", payload: { weight: 500 },
});
function makeQueue(initial = command()) {
  let state = initial;
  const calls = [];
  const queue = {
    async claimPending(o, commandId) {
      calls.push("claim");
      if (!state || state.commandId !== commandId || state.status !== "pending") return null;
      state = policy.beginCommandAttempt(state, o);
      return state;
    },
    async acknowledge(o, approved) {
      calls.push("acknowledge");
      assert.equal(approved.status, "acked");
      policy.assertCommandOwner(approved, o);
      state = approved;
    },
    async markConflict(o, reserved) {
      calls.push("conflict");
      state = policy.markCommandConflict(reserved, o);
    },
    async releaseForRetry(o, reserved) {
      calls.push("retry");
      state = policy.retryAfterUncertainDelivery(reserved, o);
    },
  };
  return { queue, calls, state: () => state };
}
const ack = { commandId: "cmd-a", idempotencyKey: "idem-a", ...owner };
test("valid matching ACK marks queue acknowledged without discarding record", async () => {
  const store = makeQueue();
  const result = await syncOneLocalCommand(owner, "cmd-a", store.queue, {
    async push(sent) { assert.equal(sent.status, "inflight"); return { kind: "acked", ack }; },
  });
  assert.equal(result.status, "acked");
  assert.equal(store.state().status, "acked");
  assert.deepEqual(store.calls, ["claim", "acknowledge"]);
});
test("network timeout returns pending for retry with unchanged idempotency key", async () => {
  const store = makeQueue();
  const result = await syncOneLocalCommand(owner, "cmd-a", store.queue, {
    async push() { throw new Error("timeout after server ACK"); },
  });
  assert.equal(result.status, "retry");
  assert.equal(store.state().status, "pending");
  assert.equal(store.state().idempotencyKey, "idem-a");
  assert.equal(store.state().attemptCount, 1);
});
test("retry uses original ID and idempotency key, then accepts matching ACK", async () => {
  const store = makeQueue();
  await syncOneLocalCommand(owner, "cmd-a", store.queue, { async push() { return {kind:"retry-later"}; } });
  const second = await syncOneLocalCommand(owner, "cmd-a", store.queue, {
    async push(sent) { assert.equal(sent.idempotencyKey, "idem-a"); return { kind: "acked", ack }; },
  });
  assert.equal(second.status, "acked");
  assert.equal(store.state().attemptCount, 2);
});
test("conflict remains visible instead of silently approving or re-sending", async () => {
  const store = makeQueue();
  const result = await syncOneLocalCommand(owner, "cmd-a", store.queue, {
    async push() { return { kind: "conflict" }; },
  });
  assert.equal(result.status, "conflict");
  assert.equal(store.state().status, "conflict");
  assert.equal((await syncOneLocalCommand(owner, "cmd-a", store.queue, {
    async push() { throw new Error("must not send conflict"); },
  })).status, "empty");
});
test("wrong tenant in ACK never transitions to acked", async () => {
  const store = makeQueue();
  await assert.rejects(syncOneLocalCommand(owner, "cmd-a", store.queue, {
    async push() { return { kind: "acked", ack: { ...ack, tenantId: "someone-else" } }; },
  }));
  assert.notEqual(store.state().status, "acked");
});
test("wrong idempotency key never transitions to acked", async () => {
  const store = makeQueue();
  await assert.rejects(syncOneLocalCommand(owner, "cmd-a", store.queue, {
    async push() { return { kind: "acked", ack: { ...ack, idempotencyKey: "other" } }; },
  }));
  assert.notEqual(store.state().status, "acked");
});
test("empty queue produces no transport call", async () => {
  const store = makeQueue(null);
  const result = await syncOneLocalCommand(owner, "cmd-a", store.queue, {
    async push() { throw new Error("unexpected"); },
  });
  assert.equal(result.status, "empty");
});
test("invalid or unexpected response cannot count as successful sync", async () => {
  const store = makeQueue();
  await assert.rejects(syncOneLocalCommand(owner, "cmd-a", store.queue, {
    async push() { return { kind: "unknown" }; },
  }), /unrecognized sync response/);
  assert.equal(store.state().status, "pending");
});
