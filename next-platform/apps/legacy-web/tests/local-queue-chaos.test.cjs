const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { indexedDB } = require("fake-indexeddb");

function loadTs(file, imports = {}, extraGlobals = {}) {
  const content = fs.readFileSync(path.resolve(__dirname, file), "utf8");
  const js = ts.transpileModule(content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exported = {};
  const context = {
    Blob,
    ArrayBuffer,
    Uint8Array,
    console,
    Promise,
    structuredClone,
    setTimeout,
    clearTimeout,
    ...extraGlobals,
  };
  vm.runInNewContext("(function(exports,require){" + js + "\n})", context)(exported, (specifier) => {
    if (specifier in imports) return imports[specifier];
    throw new Error("unexpected import " + specifier + " in " + file);
  });
  return exported;
}

const policy = loadTs("../src/platform/offline/commandPolicy.ts");
const syncMod = loadTs("../src/platform/offline/localSyncRound.ts", {
  "./commandPolicy": policy,
});
const queueMod = loadTs("../src/platform/adapters/IndexedDbAtomicCommandQueue.ts", {
  "../offline/commandPolicy": policy,
});
const drainerMod = loadTs("../src/platform/offline/LocalQueueDrainer.ts", {
  "./commandPolicy": policy,
  "./localSyncRound": syncMod,
  "../adapters/IndexedDbAtomicCommandQueue": queueMod,
});

const { LocalQueueDrainer, FakeOfflineCommandTransport, withSyncLeaderLock } = drainerMod;
const { IndexedDbAtomicCommandQueue } = queueMod;

const fakeFactory = () => new indexedDB.constructor();

const ownerA = { tenantId: "tenant-chaos-a", userId: "user-chaos-a" };
const ownerB = { tenantId: "tenant-chaos-b", userId: "user-chaos-b" };

function makeCmd(owner, id, kind = "pesagem", payload = { value: 100 }, extra = {}) {
  return policy.makePendingCommand({
    commandId: id,
    idempotencyKey: `urn:consubov:${owner.tenantId}:${id}`,
    tenantId: owner.tenantId,
    userId: owner.userId,
    deviceId: "device-test",
    kind,
    createdAt: new Date().toISOString(),
    payload,
    ...extra,
  });
}

test("CHAOS-1: Lost ACK simulation — Server receives and persists, client experiences timeout, retries idempotently", async () => {
  const factory = fakeFactory();
  const queue = new IndexedDbAtomicCommandQueue(factory);
  const transport = new FakeOfflineCommandTransport();

  const cmd = makeCmd(ownerA, "cmd-lost-ack-1");
  await queue.enqueue(ownerA, cmd);

  // Mark command for Lost ACK: transport will commit to serverState, but throw network error before ACK reaches client
  transport.simulateLostAck(cmd.idempotencyKey);

  const drainer = new LocalQueueDrainer(queue, transport);

  // First drain: should fail on the lost ack and trigger circuit-breaker / retry
  const firstSummary = await drainer.drainBatch(ownerA);
  assert.equal(firstSummary.processed, 1);
  assert.equal(firstSummary.acked, 0);
  assert.equal(firstSummary.retried, 1);
  assert.equal(firstSummary.stoppedOnError, true);

  // Command in queue should be back in 'pending' status with attemptCount = 1
  const storedAfterFail = await queue.get(ownerA, "cmd-lost-ack-1");
  assert.equal(storedAfterFail.status, "pending");
  assert.equal(storedAfterFail.attemptCount, 1);
  assert.equal(storedAfterFail.idempotencyKey, cmd.idempotencyKey);

  // Server state already has the record from the first attempt
  const serverRec = transport.getServerRecord(cmd.idempotencyKey);
  assert.ok(serverRec, "Server must have recorded the operation even though client lost ACK");

  // Second drain: client retries with the SAME idempotencyKey and commandId
  const secondSummary = await drainer.drainBatch(ownerA);
  assert.equal(secondSummary.processed, 1);
  assert.equal(secondSummary.acked, 1);
  assert.equal(secondSummary.retried, 0);
  assert.equal(secondSummary.stoppedOnError, false);

  // Command in queue is now 'acked' with attemptCount = 2
  const storedAfterSuccess = await queue.get(ownerA, "cmd-lost-ack-1");
  assert.equal(storedAfterSuccess.status, "acked");
  assert.equal(storedAfterSuccess.attemptCount, 2);

  // Server state has exactly 1 entry, zero duplication!
  assert.equal(transport.getServerState().size, 1);

  await queue.close();
});

test("CHAOS-2: Circuit-Breaker in Batch Drain — Stops on first failure to protect offline battery and I/O", async () => {
  const factory = fakeFactory();
  const queue = new IndexedDbAtomicCommandQueue(factory);
  const transport = new FakeOfflineCommandTransport();

  // Enqueue 5 commands with ascending createdAt timestamps
  for (let i = 1; i <= 5; i++) {
    const timestamp = new Date(Date.now() + i * 1000).toISOString();
    await queue.enqueue(ownerA, makeCmd(ownerA, `cmd-batch-${i}`, "pesagem", { i }, { createdAt: timestamp }));
  }

  // Script transport to throw network error on command 3
  const cmd3Key = `urn:consubov:${ownerA.tenantId}:cmd-batch-3`;
  transport.scriptReply(cmd3Key, new Error("Simulated radio loss in rural field"));

  const drainer = new LocalQueueDrainer(queue, transport);
  const summary = await drainer.drainBatch(ownerA, { circuitBreakerOnFailure: true });

  assert.equal(summary.processed, 3, "Should have processed exactly 3 commands before breaking");
  assert.equal(summary.acked, 2, "First 2 commands should be ACKed");
  assert.equal(summary.retried, 1, "3rd command should be retried");
  assert.equal(summary.stoppedOnError, true, "Circuit-breaker must flag stoppedOnError");

  // Commands 1 and 2 are acked
  assert.equal((await queue.get(ownerA, "cmd-batch-1")).status, "acked");
  assert.equal((await queue.get(ownerA, "cmd-batch-2")).status, "acked");

  // Command 3 is pending (released for retry, attemptCount 1)
  const cmd3 = await queue.get(ownerA, "cmd-batch-3");
  assert.equal(cmd3.status, "pending");
  assert.equal(cmd3.attemptCount, 1);

  // Commands 4 and 5 were never attempted and remain pending with attemptCount 0
  const cmd4 = await queue.get(ownerA, "cmd-batch-4");
  const cmd5 = await queue.get(ownerA, "cmd-batch-5");
  assert.equal(cmd4.status, "pending");
  assert.equal(cmd4.attemptCount, 0);
  assert.equal(cmd5.status, "pending");
  assert.equal(cmd5.attemptCount, 0);

  // Remaining pending in queue is 3 (cmd-3, cmd-4, cmd-5)
  const pending = await queue.listPending(ownerA);
  assert.equal(pending.length, 3);

  await queue.close();
});

test("CHAOS-3: HTTP 409 Conflict — Conflict isolated without LWW; independent commands continue", async () => {
  const factory = fakeFactory();
  const queue = new IndexedDbAtomicCommandQueue(factory);
  const transport = new FakeOfflineCommandTransport();

  await queue.enqueue(ownerA, makeCmd(ownerA, "cmd-c1", "salga", { lote: 1 }));
  await queue.enqueue(ownerA, makeCmd(ownerA, "cmd-c2-conflict", "salga", { lote: 1 }));
  await queue.enqueue(ownerA, makeCmd(ownerA, "cmd-c3", "salga", { lote: 2 }));

  // Script conflict for cmd-c2
  const conflictKey = `urn:consubov:${ownerA.tenantId}:cmd-c2-conflict`;
  transport.scriptReply(conflictKey, { kind: "conflict" });

  const drainer = new LocalQueueDrainer(queue, transport);
  const summary = await drainer.drainBatch(ownerA);

  assert.equal(summary.processed, 3);
  assert.equal(summary.acked, 2);
  assert.equal(summary.conflicted, 1);
  assert.equal(summary.retried, 0);
  assert.equal(summary.stoppedOnError, false);

  assert.equal((await queue.get(ownerA, "cmd-c1")).status, "acked");
  assert.equal((await queue.get(ownerA, "cmd-c2-conflict")).status, "conflict");
  assert.equal((await queue.get(ownerA, "cmd-c3")).status, "acked");

  // Conflict cannot be claimed or drained implicitly
  assert.equal(await queue.claimPending(ownerA, "cmd-c2-conflict"), null);

  await queue.close();
});

test("CHAOS-4: Multi-Tenant and Multi-User Isolation under Chaos", async () => {
  const factory = fakeFactory();
  const queue = new IndexedDbAtomicCommandQueue(factory);
  const transport = new FakeOfflineCommandTransport();

  // Both tenant A and tenant B have a command with the same ID and same relative key
  const cmdA = makeCmd(ownerA, "cmd-shared-id");
  const cmdB = makeCmd(ownerB, "cmd-shared-id");

  await queue.enqueue(ownerA, cmdA);
  await queue.enqueue(ownerB, cmdB);

  const drainer = new LocalQueueDrainer(queue, transport);

  // Drain Tenant A only
  const summaryA = await drainer.drainBatch(ownerA);
  assert.equal(summaryA.processed, 1);
  assert.equal(summaryA.acked, 1);

  // Tenant A command is acked, Tenant B command is still pending
  assert.equal((await queue.get(ownerA, "cmd-shared-id")).status, "acked");
  assert.equal((await queue.get(ownerB, "cmd-shared-id")).status, "pending");

  // Drain Tenant B
  const summaryB = await drainer.drainBatch(ownerB);
  assert.equal(summaryB.processed, 1);
  assert.equal(summaryB.acked, 1);

  assert.equal((await queue.get(ownerB, "cmd-shared-id")).status, "acked");

  // Server state has 2 separate records for the two tenants
  assert.equal(transport.getServerState().size, 2);

  await queue.close();
});

test("CHAOS-5: Crash Recovery — Inflight recovery requires verified sender stop and preserves idempotency", async () => {
  const factory = fakeFactory();
  const queue = new IndexedDbAtomicCommandQueue(factory);
  const transport = new FakeOfflineCommandTransport();

  const cmd = makeCmd(ownerA, "cmd-crash-rec");
  await queue.enqueue(ownerA, cmd);

  // Tab 1 claims command into inflight
  const claimed = await queue.claimPending(ownerA, "cmd-crash-rec");
  assert.equal(claimed.status, "inflight");
  assert.equal(claimed.attemptCount, 1);

  // Tab 1 crashes without acknowledging or releasing
  // Tab 2 opens and discovers the inflight command
  const inMemoryInflight = await queue.get(ownerA, "cmd-crash-rec");
  assert.equal(inMemoryInflight.status, "inflight");

  // Attempting recovery without sender confirmation must throw
  await assert.rejects(
    queue.recoverUnconfirmed(ownerA, "cmd-crash-rec", 1, false),
    /recovery requires explicit sender-stop confirmation/
  );

  // Attempting recovery with wrong attemptCount must throw
  await assert.rejects(
    queue.recoverUnconfirmed(ownerA, "cmd-crash-rec", 99, true),
    /inflight command changed before recovery/
  );

  // Valid recovery by Tab 2 with sender confirmed stopped
  await queue.recoverUnconfirmed(ownerA, "cmd-crash-rec", 1, true);

  const recovered = await queue.get(ownerA, "cmd-crash-rec");
  assert.equal(recovered.status, "pending");
  assert.equal(recovered.attemptCount, 1);
  assert.equal(recovered.idempotencyKey, cmd.idempotencyKey);

  // Now drain completes successfully on attempt 2
  const drainer = new LocalQueueDrainer(queue, transport);
  const summary = await drainer.drainBatch(ownerA);
  assert.equal(summary.acked, 1);

  const finalCmd = await queue.get(ownerA, "cmd-crash-rec");
  assert.equal(finalCmd.status, "acked");
  assert.equal(finalCmd.attemptCount, 2);

  await queue.close();
});
