const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { indexedDB } = require("fake-indexeddb");
function load(file, imports = {}) {
  const js = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exported = {};
  vm.runInNewContext("(function(exports,require){" + js + "\n})", {
    Blob, console, Promise, structuredClone,
  })(exported, name => {
    assert.ok(Object.hasOwn(imports, name), "unexpected runtime import " + name);
    return imports[name];
  });
  return exported;
}
const policy = load("../src/platform/offline/commandPolicy.ts");
const { IndexedDbAtomicCommandQueue } = load("../src/platform/adapters/IndexedDbAtomicCommandQueue.ts", {
  "../offline/commandPolicy": policy,
});
const owner = { tenantId: "tenant-fixture", userId: "user-fixture" };
const transitions = [
  ["acknowledge", "acked", "acked"],
  ["markConflict", "inflight", "conflict"],
  ["releaseForRetry", "inflight", "pending"],
];
async function reservedTwice(t) {
  const factory = new indexedDB.constructor();
  const queue = new IndexedDbAtomicCommandQueue(factory);
  t.after(() => queue.close());
  await queue.enqueue(owner, policy.makePendingCommand({
    ...owner, commandId: "cmd-1", idempotencyKey: "idem-1", deviceId: "device-1",
    kind: "pesagem", createdAt: "2026-10-12T10:00:00Z",
    payload: { bytes: new Uint8Array([9, 8, 7]).buffer, photo: new Blob(["offline-bytes"]) },
  }));
  const first = await queue.claimPending(owner, "cmd-1");
  await queue.releaseForRetry(owner, first);
  const current = await queue.claimPending(owner, "cmd-1");
  return { queue, first, current, factory };
}
async function assertStored(queue, status) {
  const saved = await queue.get(owner, "cmd-1");
  assert.equal(saved.status, status);
  assert.equal(saved.attemptCount, 2);
  assert.equal(saved.idempotencyKey, "idem-1");
  assert.equal(saved.tenantId, owner.tenantId);
  assert.equal(saved.userId, owner.userId);
  assert.deepEqual([...new Uint8Array(saved.payload.bytes)], [9, 8, 7]);
  assert.equal(await saved.payload.photo.text(), "offline-bytes");
}
for (const [method, incomingStatus, savedStatus] of transitions) {
  test(method + " cannot turn an old attempt into a valid transition by mutating its argument after invocation", async t => {
    const { queue, first, current } = await reservedTwice(t);
    const incoming = { ...first, status: incomingStatus };
    const pending = queue[method](owner, incoming);
    incoming.attemptCount = current.attemptCount;
    await assert.rejects(pending, /stale or mismatched/);
    await assertStored(queue, "inflight");
    // A failed stale transition must not poison the next transaction.
    await queue[method](owner, { ...current, status: incomingStatus });
    await assertStored(queue, savedStatus);
  });
  test(method + " uses the accepted attempt even if a caller reuses the envelope during the async wait", async t => {
    const { queue, current, factory } = await reservedTwice(t);
    const incoming = { ...current, status: incomingStatus };
    const pending = queue[method](owner, incoming);
    incoming.attemptCount = 99;
    incoming.deviceId = "changed-after-call";
    incoming.payload = { bytes: new ArrayBuffer(0), photo: new Blob(["changed-after-call"]) };
    await pending;
    await queue.close();
    const reopened = new IndexedDbAtomicCommandQueue(factory);
    t.after(() => reopened.close());
    await assertStored(reopened, savedStatus);
  });
}

// The double controls only the abandoned-open event sequence; retries below
// use the installed fake-indexeddb implementation rather than a simulated DB.
function abandonedOpen() {
  const real = new indexedDB.constructor();
  const request = {};
  let first = true;
  const queue = new IndexedDbAtomicCommandQueue({
    open(...args) {
      if (first) { first = false; return request; }
      return real.open(...args);
    },
  });
  return { queue, request };
}
test("a late success after blocked open closes the abandoned connection without inspecting it", async t => {
  const { queue, request } = abandonedOpen();
  t.after(() => queue.close());
  const failed = queue.get(owner, "cmd-1");
  request.onblocked();
  await assert.rejects(failed, /blocked/);
  let closed = 0;
  let inspected = 0;
  request.result = {
    close() { closed++; },
    transaction() {
      inspected++;
      return { objectStore() { return {
        keyPath: "key", autoIncrement: false, indexNames: { contains: () => true },
        index(name) { return { keyPath: name === "byOwnerStatus" ? "ownerStatus" : "idempotencyScope",
          unique: name !== "byOwnerStatus", multiEntry: false }; },
      }; } };
    },
  };
  request.onsuccess();
  assert.equal(closed, 1);
  assert.equal(inspected, 0);
  assert.equal(await queue.get(owner, "cmd-1"), null);
});
test("a late upgrade after blocked open aborts rather than creating stores after caller failure", async t => {
  const { queue, request } = abandonedOpen();
  t.after(() => queue.close());
  const failed = queue.get(owner, "cmd-1");
  request.onblocked();
  await assert.rejects(failed, /blocked/);
  let aborted = 0;
  let created = 0;
  request.transaction = { abort() { aborted++; } };
  request.result = { objectStoreNames: { contains: () => false },
    createObjectStore() { created++; return { createIndex() {} }; } };
  request.onupgradeneeded();
  assert.equal(aborted, 1);
  assert.equal(created, 0);
  assert.equal(await queue.get(owner, "cmd-1"), null);
});
