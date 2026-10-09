import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

/**
 * Two REAL browser connections to the same local IndexedDB origin.
 * No API/Supabase/deploy. This test is a local precondition, not field-device QA.
 */
const compile = (name: string) => ts.transpileModule(
  readFileSync(resolve(__dirname, "../src/platform/" + name), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

const runtime = [
  "(() => {",
  "const policy = {};",
  "(function(exports) {", compile("offline/commandPolicy.ts"), "})(policy);",
  "const adapter = {};",
  "(function(exports, require) {", compile("adapters/IndexedDbAtomicCommandQueue.ts"),
  "})(adapter, (name) => { if (name === '../offline/commandPolicy') return policy; throw new Error(name); });",
  "window.__consubovQueueTest = { policy, Queue: adapter.IndexedDbAtomicCommandQueue };",
  "})();",
].join("\n");

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
    const fixture = (window as any).__consubovQueueTest;
    (window as any).__q = new fixture.Queue();
    (window as any).__owner = { tenantId: "tenant-fixture", userId: "user-fixture" };
  });
}
const add = async (page: Page, id = "cmd-1") => page.evaluate(async id => {
  const { policy } = (window as any).__consubovQueueTest;
  const command = policy.makePendingCommand({
    commandId: id, idempotencyKey: "idempotent-" + id,
    tenantId: "tenant-fixture", userId: "user-fixture",
    deviceId: "fixture-device", kind: "pesagem",
    createdAt: "2026-10-09T12:00:00Z",
    payload: { bytes: new Uint8Array([9, 8, 7]).buffer,
      photo: new Blob(["offline-bytes"], { type: "image/jpeg" }) },
  });
  await (window as any).__q.enqueue((window as any).__owner, command);
}, id);

test("two browser tabs claim a stored operation exactly once", async ({ page, context }) => {
  const other = await context.newPage();
  try {
    await Promise.all([openPage(page), openPage(other)]);
    await add(page);
    const [a, b] = await Promise.all([
      page.evaluate(() => (window as any).__q.claimPending((window as any).__owner, "cmd-1")),
      other.evaluate(() => (window as any).__q.claimPending((window as any).__owner, "cmd-1")),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect((a || b).attemptCount).toBe(1);
    const stored = await other.evaluate(async () =>
      (window as any).__q.get((window as any).__owner, "cmd-1"));
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
      const cmd = await (window as any).__q.get((window as any).__owner, "cmd-1");
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
      const own = (window as any).__q;
      const current = (window as any).__owner;
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
    const q = (window as any).__q, o = (window as any).__owner;
    const { policy } = (window as any).__consubovQueueTest;
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
