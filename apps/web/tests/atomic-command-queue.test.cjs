const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { indexedDB } = require("fake-indexeddb");

function load(file, imports = {}) {
  const content = fs.readFileSync(path.resolve(__dirname, file), "utf8");
  const js = ts.transpileModule(content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exported = {};
  vm.runInNewContext("(function(exports,require){" + js + "\n})", { Blob, console, Promise })(exported, (specifier) => {
    assert.ok(specifier in imports, "unexpected runtime import " + specifier);
    return imports[specifier];
  });
  return exported;
}
const policy = load("../src/platform/offline/commandPolicy.ts");
const queueMod = load("../src/platform/adapters/IndexedDbAtomicCommandQueue.ts", {
  "../offline/commandPolicy": policy,
});
const sync = load("../src/platform/offline/localSyncRound.ts", {
  "./commandPolicy": policy,
});
const { IndexedDbAtomicCommandQueue, NEXT_COMMAND_QUEUE_DB_NAME } = queueMod;
const owner = { tenantId: "tenant-a", userId: "user-a" };
const otherOwner = { tenantId: "tenant-a", userId: "user-b" };
const fakeFactory = () => new indexedDB.constructor();
const initial = (commandId = "cmd-1", extra = {}) => policy.makePendingCommand({
  commandId, idempotencyKey: "idem-" + commandId,
  tenantId: owner.tenantId, userId: owner.userId,
  deviceId: "device-1", kind: "pesagem", createdAt: "2026-10-09T08:00:00Z",
  payload: { count: 1, image: new Blob(["picture-bytes"], { type: "image/jpeg" }),
    bytes: new Uint8Array([1, 2, 3]).buffer },
  ...extra,
});
const ack = (command) => ({
  tenantId: command.tenantId, userId: command.userId,
  commandId: command.commandId, idempotencyKey: command.idempotencyKey,
});

test("new database is separate from six legacy DBs and retains payload after reopening", async () => {
  const factory = fakeFactory();
  const a = new IndexedDbAtomicCommandQueue(factory);
  const command = initial();
  await a.enqueue(owner, command);
  await a.close();
  const b = new IndexedDbAtomicCommandQueue(factory);
  const loaded = await b.get(owner, command.commandId);
  assert.equal(loaded.status, "pending");
  assert.equal(await loaded.payload.image.text(), "picture-bytes");
  assert.deepEqual([...new Uint8Array(loaded.payload.bytes)], [1, 2, 3]);
  const databases = await factory.databases();
  assert.deepEqual(databases.map(db => db.name), [NEXT_COMMAND_QUEUE_DB_NAME]);
});

test("two independent tabs can claim the same pending command only once", async () => {
  const factory = fakeFactory();
  const tabA = new IndexedDbAtomicCommandQueue(factory);
  const tabB = new IndexedDbAtomicCommandQueue(factory);
  await tabA.enqueue(owner, initial());
  const claimed = await Promise.all([
    tabA.claimPending(owner, "cmd-1"),
    tabB.claimPending(owner, "cmd-1"),
  ]);
  assert.equal(claimed.filter(Boolean).length, 1);
  assert.equal((await tabA.get(owner, "cmd-1")).attemptCount, 1);
  assert.equal((await tabB.get(owner, "cmd-1")).status, "inflight");
});

test("unique idempotency key prevents a second command under the same owner", async () => {
  const queue = new IndexedDbAtomicCommandQueue(fakeFactory());
  await queue.enqueue(owner, initial("cmd-1"));
  await assert.rejects(queue.enqueue(owner, initial("cmd-2", { idempotencyKey: "idem-cmd-1" })));
  assert.equal(await queue.get(owner, "cmd-2"), null);
  assert.equal((await queue.get(owner, "cmd-1")).status, "pending");
});

test("duplicate ID does not overwrite previously saved offline data", async () => {
  const queue = new IndexedDbAtomicCommandQueue(fakeFactory());
  await queue.enqueue(owner, initial("cmd-1"));
  await assert.rejects(queue.enqueue(owner, initial("cmd-1", { payload: { count: 999 } })));
  assert.equal((await queue.get(owner, "cmd-1")).payload.count, 1);
});

test("different owners cannot list, claim or inspect each other's commands", async () => {
  const queue = new IndexedDbAtomicCommandQueue(fakeFactory());
  await queue.enqueue(owner, initial());
  assert.equal(await queue.get(otherOwner, "cmd-1"), null);
  assert.equal(await queue.claimPending(otherOwner, "cmd-1"), null);
  assert.equal((await queue.listPending(otherOwner)).length, 0);
  assert.equal((await queue.listPending(owner)).length, 1);
});

test("scoped pending index excludes already inflight and acknowledged work", async () => {
  const queue = new IndexedDbAtomicCommandQueue(fakeFactory());
  await queue.enqueue(owner, initial("cmd-1"));
  await queue.enqueue(owner, initial("cmd-2"));
  const pending = await queue.claimPending(owner, "cmd-1");
  assert.deepEqual((await queue.listPending(owner)).map(c => c.commandId), ["cmd-2"]);
  const approved = policy.acknowledgeCommand(pending, owner, ack(pending));
  await queue.acknowledge(owner, approved);
  assert.deepEqual((await queue.listPending(owner)).map(c => c.commandId), ["cmd-2"]);
});

test("valid ACK survives crash/reopen; stale ACK cannot overwrite new attempt", async () => {
  const factory = fakeFactory();
  const queue = new IndexedDbAtomicCommandQueue(factory);
  await queue.enqueue(owner, initial());
  const first = await queue.claimPending(owner, "cmd-1");
  await queue.releaseForRetry(owner, first);
  const second = await queue.claimPending(owner, "cmd-1");
  await assert.rejects(queue.acknowledge(owner, policy.acknowledgeCommand(first, owner, ack(first))));
  assert.equal((await queue.get(owner, "cmd-1")).status, "inflight");
  await queue.acknowledge(owner, policy.acknowledgeCommand(second, owner, ack(second)));
  await queue.close();
  const reopened = new IndexedDbAtomicCommandQueue(factory);
  assert.equal((await reopened.get(owner, "cmd-1")).status, "acked");
  assert.equal((await reopened.claimPending(owner, "cmd-1")), null);
});

test("network error retries with stable idempotency and durable attempt count", async () => {
  const queue = new IndexedDbAtomicCommandQueue(fakeFactory());
  await queue.enqueue(owner, initial());
  assert.equal((await sync.syncOneLocalCommand(owner, "cmd-1", queue,
    { async push() { throw new Error("offline"); } })).status, "retry");
  assert.equal((await queue.get(owner, "cmd-1")).status, "pending");
  const second = await sync.syncOneLocalCommand(owner, "cmd-1", queue, {
    async push(command) {
      assert.equal(command.idempotencyKey, "idem-cmd-1");
      assert.equal(command.attemptCount, 2);
      return { kind: "acked", ack: ack(command) };
    },
  });
  assert.equal(second.status, "acked");
  assert.equal((await queue.get(owner, "cmd-1")).attemptCount, 2);
});

test("conflict remains persisted and cannot be retried or deleted implicitly", async () => {
  const queue = new IndexedDbAtomicCommandQueue(fakeFactory());
  await queue.enqueue(owner, initial());
  const res = await sync.syncOneLocalCommand(owner, "cmd-1", queue,
    { async push() { return { kind: "conflict" }; } });
  assert.equal(res.status, "conflict");
  assert.equal((await queue.get(owner, "cmd-1")).status, "conflict");
  assert.equal((await queue.claimPending(owner, "cmd-1")), null);
});

test("unknown tenant ACK rejects and never writes an acknowledged state", async () => {
  const queue = new IndexedDbAtomicCommandQueue(fakeFactory());
  await queue.enqueue(owner, initial());
  await assert.rejects(sync.syncOneLocalCommand(owner, "cmd-1", queue, {
    async push(command) { return { kind: "acked", ack: { ...ack(command), tenantId: "other" } }; },
  }));
  assert.equal((await queue.get(owner, "cmd-1")).status, "inflight");
});

test("failed transition aborts atomically; subsequent correct retry remains possible", async () => {
  const queue = new IndexedDbAtomicCommandQueue(fakeFactory());
  await queue.enqueue(owner, initial());
  const captured = await queue.claimPending(owner, "cmd-1");
  await assert.rejects(queue.releaseForRetry(owner, { ...captured, attemptCount: 100 }));
  assert.equal((await queue.get(owner, "cmd-1")).attemptCount, 1);
  await queue.releaseForRetry(owner, captured);
  assert.equal((await queue.get(owner, "cmd-1")).status, "pending");
});

test("crash recovery requires explicit confirmation and exact attempt CAS", async () => {
  const factory = fakeFactory();
  const queue = new IndexedDbAtomicCommandQueue(factory);
  await queue.enqueue(owner, initial());
  const sent = await queue.claimPending(owner, "cmd-1");
  await queue.close();
  const recovered = new IndexedDbAtomicCommandQueue(factory);
  await assert.rejects(recovered.recoverUnconfirmed(owner, "cmd-1", 1, false));
  await assert.rejects(recovered.recoverUnconfirmed(owner, "cmd-1", 2, true));
  assert.equal((await recovered.get(owner, "cmd-1")).status, "inflight");
  await recovered.recoverUnconfirmed(owner, "cmd-1", sent.attemptCount, true);
  const reattempt = await recovered.claimPending(owner, "cmd-1");
  assert.equal(reattempt.idempotencyKey, sent.idempotencyKey);
  assert.equal(reattempt.attemptCount, 2);
});

test("enqueue rejects unconfirmed inflight payloads and commands without identity", async () => {
  const queue = new IndexedDbAtomicCommandQueue(fakeFactory());
  await assert.rejects(queue.enqueue(owner, { ...initial(), status: "inflight" }));
  assert.throws(() => initial("cmd-1", { idempotencyKey: " " }));
});

test("IndexedDB unavailable refuses to accept a command as persisted", async () => {
  const queue = new IndexedDbAtomicCommandQueue(undefined);
  await assert.rejects(queue.enqueue(owner, initial()));
});
