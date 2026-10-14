import { fileURLToPath } from "node:url";
import { test, expect, type Page } from "./persistentTest";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const compile = (name: string) =>
  ts.transpileModule(
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
  "const drainer = {};",
  "(function(exports, require) {", compile("offline/LocalQueueDrainer.ts"),
  "})(drainer, (name) => {",
  "  if (name === './commandPolicy') return policy;",
  "  if (name === './localSyncRound') return sync;",
  "  if (name === '../adapters/IndexedDbAtomicCommandQueue') return adapter;",
  "  throw new Error(name);",
  "});",
  "window.__consubovChaosTest = { policy, sync, adapter, drainer };",
  "})();",
].join("\n");

type ChaosFixtureWindow = Window & {
  __consubovChaosTest: {
    policy: typeof import("../src/platform/offline/commandPolicy");
    sync: typeof import("../src/platform/offline/localSyncRound");
    adapter: typeof import("../src/platform/adapters/IndexedDbAtomicCommandQueue");
    drainer: typeof import("../src/platform/offline/LocalQueueDrainer");
  };
  __q: import("../src/platform/adapters/IndexedDbAtomicCommandQueue").IndexedDbAtomicCommandQueue;
  __owner: import("../src/platform/offline/commandPolicy").CommandOwner;
  __transport: import("../src/platform/offline/LocalQueueDrainer").FakeOfflineCommandTransport;
  __drainer: import("../src/platform/offline/LocalQueueDrainer").LocalQueueDrainer;
};

let server: Server;
let origin = "";

test.beforeAll(async () => {
  server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
    res.end("<!doctype html><html><title>Queue Chaos Fixture</title><body>CONSUBOV CHAOS</body></html>");
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("port unavailable");
  origin = "http://127.0.0.1:" + address.port;
});

test.afterAll(async () => {
  await new Promise<void>((done, reject) => server.close((e) => (e ? reject(e) : done())));
});

async function openPage(page: Page) {
  await page.goto(origin);
  await page.addScriptTag({ content: runtime });
  await page.evaluate(() => {
    const { adapter, drainer } = (window as unknown as ChaosFixtureWindow).__consubovChaosTest;
    const q = new adapter.IndexedDbAtomicCommandQueue();
    const transport = new drainer.FakeOfflineCommandTransport();
    const d = new drainer.LocalQueueDrainer(q, transport);
    (window as unknown as ChaosFixtureWindow).__q = q;
    (window as unknown as ChaosFixtureWindow).__transport = transport;
    (window as unknown as ChaosFixtureWindow).__drainer = d;
    (window as unknown as ChaosFixtureWindow).__owner = { tenantId: "tenant-chaos", userId: "user-chaos" };
  });
}

test("multi-tab Web Locks leader election coordinates batch drain without duplicate transport calls", async ({ page, context }) => {
  const other = await context.newPage();
  try {
    await Promise.all([openPage(page), openPage(other)]);

    // Enqueue 2 commands
    await page.evaluate(async () => {
      const { policy } = (window as unknown as ChaosFixtureWindow).__consubovChaosTest;
      const q = (window as unknown as ChaosFixtureWindow).__q;
      const o = (window as unknown as ChaosFixtureWindow).__owner;
      for (const id of ["cmd-lock-1", "cmd-lock-2"]) {
        await q.enqueue(
          o,
          policy.makePendingCommand({
            commandId: id,
            idempotencyKey: "idem-" + id,
            tenantId: o.tenantId,
            userId: o.userId,
            deviceId: "device-lock",
            kind: "pesagem",
            createdAt: new Date().toISOString(),
            payload: { weight: 520 },
          }),
        );
      }
    });

    // Both tabs attempt to drain concurrently using Web Locks leader election
    const [resA, resB] = await Promise.all([
      page.evaluate(() => (window as unknown as ChaosFixtureWindow).__drainer.drainWithLeaderLock((window as unknown as ChaosFixtureWindow).__owner)),
      other.evaluate(() => (window as unknown as ChaosFixtureWindow).__drainer.drainWithLeaderLock((window as unknown as ChaosFixtureWindow).__owner)),
    ]);

    // Exactly one tab should have executed the drain
    const executed = [resA, resB].filter((r) => r.executed);
    expect(executed).toHaveLength(1);
    expect(executed[0].summary?.acked).toBe(2);

    // Stored commands in queue are both 'acked'
    const status1 = await page.evaluate(async () => (await (window as unknown as ChaosFixtureWindow).__q.get((window as unknown as ChaosFixtureWindow).__owner, "cmd-lock-1"))?.status);
    const status2 = await other.evaluate(async () => (await (window as unknown as ChaosFixtureWindow).__q.get((window as unknown as ChaosFixtureWindow).__owner, "cmd-lock-2"))?.status);
    expect(status1).toBe("acked");
    expect(status2).toBe("acked");
  } finally {
    await other.close();
  }
});

test("network drop mid-push releases command for retry; surviving tab completes sync after reconnection", async ({ page, context }) => {
  await openPage(page);

  // Enqueue a command with a photo Blob
  await page.evaluate(async () => {
    const { policy } = (window as unknown as ChaosFixtureWindow).__consubovChaosTest;
    const q = (window as unknown as ChaosFixtureWindow).__q;
    const o = (window as unknown as ChaosFixtureWindow).__owner;
    await q.enqueue(
      o,
      policy.makePendingCommand({
        commandId: "cmd-drop-1",
        idempotencyKey: "idem-cmd-drop-1",
        tenantId: o.tenantId,
        userId: o.userId,
        deviceId: "device-drop",
        kind: "salga",
        createdAt: new Date().toISOString(),
        payload: { foto: new Blob(["cocho-offline-foto"], { type: "image/jpeg" }) },
      }),
    );
  });

  // Set offline and attempt to drain
  await context.setOffline(true);
  try {
    const offlineDrain = await page.evaluate(async () => {
      const d = (window as unknown as ChaosFixtureWindow).__drainer;
      const t = (window as unknown as ChaosFixtureWindow).__transport;
      t.setOnline(false);
      return d.drainBatch((window as unknown as ChaosFixtureWindow).__owner);
    });

    expect(offlineDrain.retried).toBe(1);
    expect(offlineDrain.stoppedOnError).toBe(true);

    const storedPending = await page.evaluate(async () => {
      return (window as unknown as ChaosFixtureWindow).__q.get((window as unknown as ChaosFixtureWindow).__owner, "cmd-drop-1");
    });
    expect(storedPending?.status).toBe("pending");
    expect(storedPending?.attemptCount).toBe(1);
    expect(storedPending?.idempotencyKey).toBe("idem-cmd-drop-1");
  } finally {
    await context.setOffline(false);
  }

  // Restore online in new tab and complete drain
  const tab2 = await context.newPage();
  try {
    await openPage(tab2);
    const onlineDrain = await tab2.evaluate(async () => {
      const d = (window as unknown as ChaosFixtureWindow).__drainer;
      const t = (window as unknown as ChaosFixtureWindow).__transport;
      t.setOnline(true);
      return d.drainBatch((window as unknown as ChaosFixtureWindow).__owner);
    });

    expect(onlineDrain.acked).toBe(1);

    const finalStored = await tab2.evaluate(async () => {
      return (window as unknown as ChaosFixtureWindow).__q.get((window as unknown as ChaosFixtureWindow).__owner, "cmd-drop-1");
    });
    expect(finalStored?.status).toBe("acked");
    expect(finalStored?.attemptCount).toBe(2);
    expect(finalStored?.idempotencyKey).toBe("idem-cmd-drop-1");
  } finally {
    await tab2.close();
  }
});

test("simulated browser tab crash inflight recovery", async ({ page, context }) => {
  await openPage(page);

  // Enqueue command and claim it into inflight
  await page.evaluate(async () => {
    const { policy } = (window as unknown as ChaosFixtureWindow).__consubovChaosTest;
    const q = (window as unknown as ChaosFixtureWindow).__q;
    const o = (window as unknown as ChaosFixtureWindow).__owner;
    await q.enqueue(
      o,
      policy.makePendingCommand({
        commandId: "cmd-crash-1",
        idempotencyKey: "idem-crash-1",
        tenantId: o.tenantId,
        userId: o.userId,
        deviceId: "device-crash",
        kind: "pesagem",
        createdAt: new Date().toISOString(),
        payload: { peso: 480 },
      }),
    );
    await q.claimPending(o, "cmd-crash-1");
  });

  // Crash tab 1 abruptly
  await page.close();

  // Tab 2 opens, detects inflight, recovers it and finishes sync
  const tab2 = await context.newPage();
  try {
    await openPage(tab2);
    const inflightStatus = await tab2.evaluate(async () => {
      const cmd = await (window as unknown as ChaosFixtureWindow).__q.get((window as unknown as ChaosFixtureWindow).__owner, "cmd-crash-1");
      return { status: cmd?.status, attemptCount: cmd?.attemptCount };
    });
    expect(inflightStatus.status).toBe("inflight");
    expect(inflightStatus.attemptCount).toBe(1);

    // Tab 2 recovers unconfirmed with sender confirmed stopped
    await tab2.evaluate(async () => {
      await (window as unknown as ChaosFixtureWindow).__q.recoverUnconfirmed(
        (window as unknown as ChaosFixtureWindow).__owner,
        "cmd-crash-1",
        1,
        true,
      );
    });

    const recoveredStatus = await tab2.evaluate(async () => {
      return (await (window as unknown as ChaosFixtureWindow).__q.get((window as unknown as ChaosFixtureWindow).__owner, "cmd-crash-1"))?.status;
    });
    expect(recoveredStatus).toBe("pending");

    // Drain and ACK
    const drainRes = await tab2.evaluate(async () => {
      return (window as unknown as ChaosFixtureWindow).__drainer.drainBatch((window as unknown as ChaosFixtureWindow).__owner);
    });
    expect(drainRes.acked).toBe(1);

    const finalStatus = await tab2.evaluate(async () => {
      const cmd = await (window as unknown as ChaosFixtureWindow).__q.get((window as unknown as ChaosFixtureWindow).__owner, "cmd-crash-1");
      return { status: cmd?.status, attemptCount: cmd?.attemptCount };
    });
    expect(finalStatus.status).toBe("acked");
    expect(finalStatus.attemptCount).toBe(2);
  } finally {
    await tab2.close();
  }
});

test("BroadcastChannel notifies inactive tab of sync progress and completion", async ({ page, context }) => {
  const other = await context.newPage();
  try {
    await Promise.all([openPage(page), openPage(other)]);

    // Tab 2 listens on BroadcastChannel
    await other.evaluate(() => {
      const received: any[] = [];
      const bc = new BroadcastChannel("consubov-vnext-sync");
      bc.onmessage = (event) => received.push(event.data);
      (window as any).__bcReceived = received;
    });

    // Tab 1 enqueues and drains
    await page.evaluate(async () => {
      const { policy } = (window as unknown as ChaosFixtureWindow).__consubovChaosTest;
      const q = (window as unknown as ChaosFixtureWindow).__q;
      const o = (window as unknown as ChaosFixtureWindow).__owner;
      const d = (window as unknown as ChaosFixtureWindow).__drainer;

      await q.enqueue(
        o,
        policy.makePendingCommand({
          commandId: "cmd-broadcast-1",
          idempotencyKey: "idem-bc-1",
          tenantId: o.tenantId,
          userId: o.userId,
          deviceId: "device-bc",
          kind: "obs",
          createdAt: new Date().toISOString(),
          payload: { text: "conferido via broadcast" },
        }),
      );

      await d.drainBatch(o);
    });

    // Check events in Tab 2
    await other.waitForFunction(() => {
      const events = (window as any).__bcReceived as any[];
      return events && events.some((e) => e.type === "COMMAND_ACKED" && e.commandId === "cmd-broadcast-1");
    }, { timeout: 3000 });

    const receivedEvents = await other.evaluate(() => (window as any).__bcReceived);
    const ackEvent = receivedEvents.find((e: any) => e.type === "COMMAND_ACKED");
    expect(ackEvent).toBeTruthy();
    expect(ackEvent.commandId).toBe("cmd-broadcast-1");
  } finally {
    await other.close();
  }
});

test("large photo Blob (2MB) survival and integrity under WebKit and Chromium", async ({ page, context }) => {
  await openPage(page);

  // Create a 2MB binary payload
  const blobSize = 2 * 1024 * 1024;
  await page.evaluate(async (size) => {
    const { policy } = (window as unknown as ChaosFixtureWindow).__consubovChaosTest;
    const q = (window as unknown as ChaosFixtureWindow).__q;
    const o = (window as unknown as ChaosFixtureWindow).__owner;

    const buffer = new Uint8Array(size);
    // Fill first and last bytes with deterministic markers
    buffer[0] = 0xca;
    buffer[1] = 0xfe;
    buffer[size - 2] = 0xba;
    buffer[size - 1] = 0xbe;

    const blob = new Blob([buffer], { type: "image/jpeg" });
    await q.enqueue(
      o,
      policy.makePendingCommand({
        commandId: "cmd-photo-2mb",
        idempotencyKey: "idem-photo-2mb",
        tenantId: o.tenantId,
        userId: o.userId,
        deviceId: "device-large-photo",
        kind: "foto_curral",
        createdAt: new Date().toISOString(),
        payload: { foto: blob },
      }),
    );
  }, blobSize);

  // Close page and re-open in new page within the same persistent profile
  await page.close();

  const reopened = await context.newPage();
  try {
    await openPage(reopened);
    const photoDetails = await reopened.evaluate(async () => {
      const cmd = await (window as unknown as ChaosFixtureWindow).__q.get((window as unknown as ChaosFixtureWindow).__owner, "cmd-photo-2mb");
      if (!cmd) return null;
      const blob = cmd.payload.foto as Blob;
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      return {
        status: cmd.status,
        size: blob.size,
        type: blob.type,
        firstBytes: [bytes[0], bytes[1]],
        lastBytes: [bytes[bytes.length - 2], bytes[bytes.length - 1]],
      };
    });

    expect(photoDetails).toEqual({
      status: "pending",
      size: blobSize,
      type: "image/jpeg",
      firstBytes: [0xca, 0xfe],
      lastBytes: [0xba, 0xbe],
    });
  } finally {
    await reopened.close();
  }
});
