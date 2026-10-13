import { fileURLToPath } from "node:url";
import { test, expect, type Page } from "./persistentTest";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

/**
 * Two REAL browser connections to the same local IndexedDB origin.
 * No API/Supabase/deploy. This test is a local precondition, not field-device QA.
 */
const compile = (name: string) => ts.transpileModule(
  readFileSync(resolve(fileURLToPath(new URL(".", import.meta.url)), "../src/platform/" + name), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

const runtime = [
  "(() => {",
  "const policy = {};",
  "(function(exports) {", compile("offline/commandPolicy.ts"), "})(policy);",
  "const adapter = {};",
  "(function(exports, require) {", compile("adapters/IndexedDbAtomicCommandQueue.ts"),
  "})(adapter, (name) => { if (name === '../offline/commandPolicy') return policy; throw new Error(name); });",
  "const sync = {};",
  "(function(exports, require) {", compile("offline/localSyncRound.ts"),
  "})(sync, (name) => { if (name === './commandPolicy') return policy; throw new Error(name); });",
  "window.__consubovQueueTest = { policy, sync, Queue: adapter.IndexedDbAtomicCommandQueue };",
  "})();",
].join("\n");

type QueuePayload = { bytes: ArrayBuffer; photo: Blob };
type QueueFixtureWindow = Window & {
  __consubovQueueTest: {
    policy: typeof import("../src/platform/offline/commandPolicy");
    sync: typeof import("../src/platform/offline/localSyncRound");
    Queue: new () => import("../src/platform/adapters/IndexedDbAtomicCommandQueue").IndexedDbAtomicCommandQueue<QueuePayload>;
  };
  __q: import("../src/platform/adapters/IndexedDbAtomicCommandQueue").IndexedDbAtomicCommandQueue<QueuePayload>;
  __owner: import("../src/platform/offline/commandPolicy").CommandOwner;
};

let server: Server;
let origin = "";

test.beforeAll(async () => {
  server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
    res.end("<!doctype html><html><title>Local queue fixture</title><body>CONSUBOV</body></html>");
  });
  await new Promise<void>(ok => server.listen(0, "127.0.0.1", ok));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("port unavailable");
  origin = "http://127.0.0.1:" + address.port;
});
test.afterAll(async () => {
  await new Promise<void>((done, reject) => server.close(e => e ? reject(e) : done()));
});
async function openPage(page: Page) {
  await page.goto(origin);
  await page.addScriptTag({ content: runtime });
  await page.evaluate(() => {
    const fixture = (window as unknown as QueueFixtureWindow).__consubovQueueTest;
    (window as unknown as QueueFixtureWindow).__q = new fixture.Queue();
    (window as unknown as QueueFixtureWindow).__owner = { tenantId: "tenant-fixture", userId: "user-fixture" };
  });
}
const add = async (page: Page, id = "cmd-1") => page.evaluate(async id => {
  const { policy } = (window as unknown as QueueFixtureWindow).__consubovQueueTest;
  const command = policy.makePendingCommand({
    commandId: id, idempotencyKey: "idempotent-" + id,
    tenantId: "tenant-fixture", userId: "user-fixture",
    deviceId: "fixture-device", kind: "pesagem",
    createdAt: "2026-10-09T12:00:00Z",
    payload: { bytes: new Uint8Array([9, 8, 7]).buffer,
      photo: new Blob(["offline-bytes"], { type: "image/jpeg" }) },
  });
  await (window as unknown as QueueFixtureWindow).__q.enqueue((window as unknown as QueueFixtureWindow).__owner, command);
}, id);

test("two browser tabs claim a stored operation exactly once", async ({ page, context }) => {
  const other = await context.newPage();
  try {
    await Promise.all([openPage(page), openPage(other)]);
    await add(page);
    const [a, b] = await Promise.all([
      page.evaluate(() => (window as unknown as QueueFixtureWindow).__q.claimPending((window as unknown as QueueFixtureWindow).__owner, "cmd-1")),
      other.evaluate(() => (window as unknown as QueueFixtureWindow).__q.claimPending((window as unknown as QueueFixtureWindow).__owner, "cmd-1")),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect((a || b).attemptCount).toBe(1);
    const stored = await other.evaluate(async () =>
      (window as unknown as QueueFixtureWindow).__q.get((window as unknown as QueueFixtureWindow).__owner, "cmd-1"));
    expect(stored.status).toBe("inflight");
  } finally { await other.close(); }
});

test("queue survives browser tab close, with Blob and ArrayBuffer intact while offline", async ({ page, context }) => {
  await openPage(page);
  await add(page);
  await page.close(); // Test a crashed/closed tab, not a JavaScript variable retained.
  const reopened = await context.newPage();
  try {
    await openPage(reopened);
    await context.setOffline(true);
    const state = await reopened.evaluate(async () => {
      const cmd = await (window as unknown as QueueFixtureWindow).__q.get((window as unknown as QueueFixtureWindow).__owner, "cmd-1");
      return { state: cmd.status, photo: await cmd.payload.photo.text(),
        bytes: [...new Uint8Array(cmd.payload.bytes)] };
    });
    expect(state).toEqual({ state: "pending", photo: "offline-bytes", bytes: [9, 8, 7] });
  } finally {
    await context.setOffline(false);
    await reopened.close();
  }
});

test("tenant/user boundary and unique idempotency index survive concurrent inserts", async ({ page, context }) => {
  const other = await context.newPage();
  try {
    await Promise.all([openPage(page), openPage(other)]);
    const result = await Promise.allSettled([add(page, "cmd-1"), add(other, "cmd-1")]);
    expect(result.filter(item => item.status === "fulfilled")).toHaveLength(1);
    const visible = await other.evaluate(async () => {
      const own = (window as unknown as QueueFixtureWindow).__q;
      const current = (window as unknown as QueueFixtureWindow).__owner;
      const someoneElse = { tenantId: current.tenantId, userId: "different-user" };
      return { pending: (await own.listPending(current)).length,
        other: await own.get(someoneElse, "cmd-1"),
        otherList: (await own.listPending(someoneElse)).length };
    });
    expect(visible).toEqual({ pending: 1, other: null, otherList: 0 });
  } finally { await other.close(); }
});

test("stale ACK is rejected without silently losing newer inflight work", async ({ page }) => {
  await openPage(page);
  await add(page);
  const states = await page.evaluate(async () => {
    const q = (window as unknown as QueueFixtureWindow).__q, o = (window as unknown as QueueFixtureWindow).__owner;
    const { policy } = (window as unknown as QueueFixtureWindow).__consubovQueueTest;
    const one = await q.claimPending(o, "cmd-1");
    await q.releaseForRetry(o, one);
    const two = await q.claimPending(o, "cmd-1");
    let rejected = false;
    try {
      await q.acknowledge(o, policy.acknowledgeCommand(one, o, {
        commandId: one.commandId, idempotencyKey: one.idempotencyKey, ...o,
      }));
    } catch { rejected = true; }
    return { rejected, status: (await q.get(o, "cmd-1")).status, attempt: two.attemptCount };
  });
  expect(states).toEqual({ rejected: true, status: "inflight", attempt: 2 });
});


test("offline fake transport retries with one durable idempotency key and explicit ACK", async ({ page, context }) => {
  await openPage(page);
  await add(page);
  await context.setOffline(true);
  try {
    const offline = await page.evaluate(async () => {
      const { sync } = (window as unknown as QueueFixtureWindow).__consubovQueueTest;
      const q = (window as unknown as QueueFixtureWindow).__q, owner = (window as unknown as QueueFixtureWindow).__owner;
      const outcome = await sync.syncOneLocalCommand(owner, "cmd-1", q, {
        async push() { throw new Error("offline fixture"); },
      });
      return { outcome: outcome.status, saved: await q.get(owner, "cmd-1") };
    });
    expect(offline.outcome).toBe("retry");
    expect(offline.saved.status).toBe("pending");
    expect(offline.saved.attemptCount).toBe(1);
  } finally { await context.setOffline(false); }

  const delivered = await page.evaluate(async () => {
    const { sync } = (window as unknown as QueueFixtureWindow).__consubovQueueTest;
    const q = (window as unknown as QueueFixtureWindow).__q, owner = (window as unknown as QueueFixtureWindow).__owner;
    return sync.syncOneLocalCommand(owner, "cmd-1", q, {
      async push(command: import("../src/platform/offline/commandPolicy").LocalCommand<QueuePayload>) {
        if (command.idempotencyKey !== "idempotent-cmd-1" || command.attemptCount !== 2) {
          throw new Error("changed idempotency after offline retry");
        }
        return { kind: "acked", ack: {
          commandId: command.commandId, idempotencyKey: command.idempotencyKey,
          tenantId: owner.tenantId, userId: owner.userId,
        }};
      },
    });
  });
  expect(delivered.status).toBe("acked");

  await page.reload();
  await page.addScriptTag({ content: runtime });
  const persisted = await page.evaluate(async () => {
    const { Queue } = (window as unknown as QueueFixtureWindow).__consubovQueueTest;
    return new Queue().get({ tenantId: "tenant-fixture", userId: "user-fixture" }, "cmd-1");
  });
  expect(persisted.status).toBe("acked");
  expect(persisted.idempotencyKey).toBe("idempotent-cmd-1");
  expect(persisted.attemptCount).toBe(2);
});

for (const method of ["acknowledge", "markConflict", "releaseForRetry"] as const) {
  test("snapshot boundary: " + method + " rejects an old attempt mutated after invocation", async ({ page }) => {
    await openPage(page);
    await add(page);
    const state = await page.evaluate(async method => {
      const { __q: q, __owner: owner } = window as unknown as QueueFixtureWindow;
      const first = await q.claimPending(owner, "cmd-1");
      if (!first) throw new Error("missing first reservation");
      await q.releaseForRetry(owner, first);
      const second = await q.claimPending(owner, "cmd-1");
      if (!second) throw new Error("missing second reservation");
      const incoming = { ...first, status: method === "acknowledge" ? "acked" as const : "inflight" as const };
      const pending = q[method](owner, incoming);
      incoming.attemptCount = second.attemptCount;
      let rejected = false;
      try { await pending; } catch { rejected = true; }
      await q.close();
      const { Queue } = (window as unknown as QueueFixtureWindow).__consubovQueueTest;
      const reopened = new Queue();
      try {
        const saved = await reopened.get(owner, "cmd-1");
        if (!saved) throw new Error("lost command");
        return { rejected, status: saved.status, attempt: saved.attemptCount,
          key: saved.idempotencyKey, photo: await saved.payload.photo.text(),
          bytes: [...new Uint8Array(saved.payload.bytes)] };
      } finally { await reopened.close(); }
    }, method);
    expect(state).toEqual({ rejected: true, status: "inflight", attempt: 2,
      key: "idempotent-cmd-1", photo: "offline-bytes", bytes: [9, 8, 7] });
  });

  test("snapshot boundary: " + method + " preserves a valid accepted transition after caller mutation", async ({ page }) => {
    await openPage(page);
    await add(page);
    const state = await page.evaluate(async method => {
      const { __q: q, __owner: owner } = window as unknown as QueueFixtureWindow;
      const first = await q.claimPending(owner, "cmd-1");
      if (!first) throw new Error("missing reservation");
      const incoming = { ...first, status: method === "acknowledge" ? "acked" as const : "inflight" as const };
      const pending = q[method](owner, incoming);
      incoming.attemptCount = 99;
      incoming.deviceId = "changed-after-invocation";
      incoming.payload = { bytes: new ArrayBuffer(0), photo: new Blob(["changed"]) };
      await pending;
      await q.close();
      const { Queue } = (window as unknown as QueueFixtureWindow).__consubovQueueTest;
      const reopened = new Queue();
      try {
        const saved = await reopened.get(owner, "cmd-1");
        if (!saved) throw new Error("lost command");
        return { status: saved.status, attempt: saved.attemptCount,
          key: saved.idempotencyKey, photo: await saved.payload.photo.text(),
          bytes: [...new Uint8Array(saved.payload.bytes)] };
      } finally { await reopened.close(); }
    }, method);
    const status = method === "acknowledge" ? "acked" : method === "markConflict" ? "conflict" : "pending";
    expect(state).toEqual({ status, attempt: 1,
      key: "idempotent-cmd-1", photo: "offline-bytes", bytes: [9, 8, 7] });
  });
}
