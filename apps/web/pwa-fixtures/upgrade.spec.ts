import { fileURLToPath } from "node:url";
import { test, expect } from "./persistentTest";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Local, synthetic old/new SW test; does NOT certify migration of real legacy data. */
const sw = readFileSync(resolve(fileURLToPath(new URL(".", import.meta.url)), "../public/sw.js"), "utf8");
let server: Server;
let origin = "";
let version = "a";
let failLazy = false;
const assets = (v: string) => ["/assets/app." + v + "12345678.js", "/assets/lazy." + v + "12345678.js"];
function swFor(v: string) {
  return sw.replaceAll("__BUILD_TIMESTAMP__", "fixture-" + v)
    .replace("'__PRECACHE_ASSETS__'", JSON.stringify(assets(v)));
}
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url || "/", "http://localhost").pathname;
    if (url === "/sw.js") {
      res.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "no-store" });
      res.end(swFor(version)); return;
    }
    if (url === "/" || url === "/index.html" || url === "/pesagem") {
      res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
      res.end('<!doctype html><html><body><h1 id="build">' + version
        + '</h1><script src="/assets/app.' + version + '12345678.js"></script></body></html>'); return;
    }
    if (url.startsWith("/assets/")) {
      if (failLazy && url.includes("lazy.b")) { res.writeHead(404); res.end("missing"); return; }
      res.writeHead(200, { "Content-Type": "text/javascript" });
      res.end("void 0;"); return;
    }
    res.writeHead(404); res.end("missing");
  });
  await new Promise<void>(resolveReady => server.listen(0, "127.0.0.1", resolveReady));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("fixture server unavailable");
  origin = "http://127.0.0.1:" + addr.port;
});
test.afterAll(async () => {
  await new Promise<void>((done, fail) => server.close(error => error ? fail(error) : done()));
});
test.beforeEach(() => { version = "a"; failLazy = false; });
async function installOld(page: import("@playwright/test").Page) {
  await page.goto(origin + "/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.locator("#build")).toHaveText("a");
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}
test("new installed SW only switches after consent; IndexedDB Blob and backup survive", async ({ page }) => {
  await installOld(page);
  await page.evaluate(async () => {
    localStorage.setItem("pending_backup", "pending-1");
    const req = indexedDB.open("consubov-fixture-offline", 1);
    await new Promise<void>((ok, fail) => {
      req.onupgradeneeded = () => req.result.createObjectStore("queue", { keyPath: "id" });
      req.onsuccess = () => ok(); req.onerror = () => fail(req.error);
    });
    const tx = req.result.transaction("queue", "readwrite");
    tx.objectStore("queue").put({ id: "pending-1", blob: new Blob(["offline-photo"]) });
    await new Promise<void>((ok, fail) => {
      tx.oncomplete = () => ok(); tx.onerror = () => fail(tx.error);
    });
    req.result.close();
  });
  version = "b";
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
  await expect.poll(() => page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistration())?.waiting?.state ?? null), { timeout: 20000 }).toBe("installed");
  await page.goto(origin + "/pesagem");
  await expect(page.locator("#build")).toHaveText("a");
  await page.evaluate(async () => {
    const waiting = (await navigator.serviceWorker.getRegistration())?.waiting;
    if (!waiting) throw new Error("no waiting SW");
    await new Promise<void>(ok => {
      navigator.serviceWorker.addEventListener("controllerchange", () => ok(), { once: true });
      waiting.postMessage({ type: "SKIP_WAITING" });
    });
  });
  await page.reload();
  await expect(page.locator("#build")).toHaveText("b");
  const result = await page.evaluate(async () => {
    const req = indexedDB.open("consubov-fixture-offline", 1);
    const db = await new Promise<IDBDatabase>((ok, fail) => {
      req.onsuccess = () => ok(req.result); req.onerror = () => fail(req.error);
    });
    const item = await new Promise<{id:string, blob:Blob}>((ok, fail) => {
      const r = db.transaction("queue", "readonly").objectStore("queue").get("pending-1");
      r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error);
    });
    db.close();
    return { id: item.id, photo: await item.blob.text(), backup: localStorage.getItem("pending_backup") };
  });
  expect(result).toEqual({ id: "pending-1", photo: "offline-photo", backup: "pending-1" });
});
test("unavailable lazy asset prevents offline shell replacement", async ({ page }) => {
  await installOld(page);
  version = "b";
  failLazy = true;
  await page.evaluate(async () => { try { await (await navigator.serviceWorker.getRegistration())?.update(); } catch { /* The failed install is asserted below. */ } });
  await expect.poll(() => page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return { waiting: !!r?.waiting, installing: !!r?.installing };
  }), { timeout: 20000 }).toEqual({ waiting: false, installing: false });
  await page.context().setOffline(true);
  await page.goto(origin + "/pesagem");
  await expect(page.locator("#build")).toHaveText("a");
});


test("the six actual legacy database names retain pending rows and binary attachments after upgrade", async ({ page }) => {
  await installOld(page);
  // Fixture-only fake records; no real client data, credentials or remote API.
  await page.evaluate(async () => {
    const schema: { name: string; version: number; stores: [string, string | null][] }[] = [
      { name: "consubov-capataz", version: 7, stores: [
        ["lancamentos", "id"], ["pastos", "id"], ["retiro", "id"], ["ciclos", "id"],
        ["config", "key"], ["observacoesOffline", "id"], ["produtoAtivo", "id"],
        ["fazendaCache", "id"], ["pesagensPendentes", "id"], ["syncQueue", "id"],
        ["syncErrors", "id"], ["lastPdfs", "id"],
      ] },
      { name: "consubov-session", version: 1, stores: [["auth_session", null], ["offline_data", null]] },
      { name: "consubov-consultor-offline", version: 2, stores: [
        ["foto_queue", "localId"], ["snapshots", "visitaId"], ["text_mutations", "id"],
      ] },
      { name: "mais-arrobas-offline", version: 1, stores: [["tables", null]] },
      { name: "mais-arrobas-sync", version: 2, stores: [["queue", "id"], ["acknowledged-inserts", null]] },
      { name: "consubov-fotos-salga", version: 1, stores: [["fotos", "lancamento_id"], ["feitos", null]] },
    ];
    for (const definition of schema) {
      const req = indexedDB.open(definition.name, definition.version);
      const db = await new Promise<IDBDatabase>((resolveDb, reject) => {
        req.onupgradeneeded = () => {
          for (const [name, keyPath] of definition.stores) {
            req.result.createObjectStore(name, keyPath === null ? undefined : { keyPath });
          }
        };
        req.onsuccess = () => resolveDb(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction(definition.stores.map(([name]) => name), "readwrite");
      const put = (store: string, value: unknown, key?: IDBValidKey) =>
        tx.objectStore(store).put(value, key);
      if (definition.name === "consubov-capataz") {
        put("syncQueue", { id: "cmd-a", tenant_id: "tenant-fixture", status: "pending" });
        put("pesagensPendentes", { id: "pesagem-a", sincronizado: false });
        put("lastPdfs", { id: "pdf-a", blob: new Blob(["pdf-bytes-fixture"], { type: "application/pdf" }) });
      } else if (definition.name === "consubov-session") {
        put("auth_session", { fixture: true }, "current");
        put("offline_data", { id: "session-a", offline: true }, "current");
      } else if (definition.name === "consubov-consultor-offline") {
        put("foto_queue", { localId: "photo-a", status: "pending",
          blob: new Blob(["photo-bytes-fixture"], { type: "image/jpeg" }),
          blobBuffer: new Uint8Array([14, 24, 34]).buffer });
        put("text_mutations", { id: "mutation-a", status: "pending", tries: 2 });
        put("snapshots", { visitaId: "visit-a", data: { fixture: true } });
      } else if (definition.name === "mais-arrobas-offline") {
        put("tables", { id: "table-a", pending: true }, "table-a");
      } else if (definition.name === "mais-arrobas-sync") {
        put("queue", { id: "mais-a", status: "pending" });
        put("acknowledged-inserts", "acknowledged", "ack-a");
      } else if (definition.name === "consubov-fotos-salga") {
        put("fotos", { lancamento_id: "salga-a",
          blob: new Blob(["salga-bytes-fixture"], { type: "image/jpeg" }) });
        put("feitos", "ok", "feito-a");
      }
      await new Promise<void>((resolveTx, reject) => {
        tx.oncomplete = () => resolveTx();
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    }
    localStorage.setItem("pending_backup", JSON.stringify({ ids: ["cmd-a", "pesagem-a"] }));
    localStorage.setItem("pending_backup_at", "2026-10-09T00:00:00Z");
    localStorage.setItem("ma-offline-mode", "true");
  });

  version = "b";
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
  await expect.poll(() => page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistration())?.waiting?.state ?? null), { timeout: 20000 }).toBe("installed");

  await page.goto(origin + "/pesagem");
  await expect(page.locator("#build")).toHaveText("a");

  await page.evaluate(async () => {
    const waiting = (await navigator.serviceWorker.getRegistration())?.waiting;
    if (!waiting) throw new Error("new worker not waiting");
    await new Promise<void>(resolveChanged => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolveChanged(), { once: true });
      waiting.postMessage({ type: "SKIP_WAITING" });
    });
  });

  await page.context().setOffline(true);
  await page.goto(origin + "/pesagem");
  await expect(page.locator("#build")).toHaveText("b");

  const recovered = await page.evaluate(async () => {
    const read = async (name: string, version: number, store: string, key: IDBValidKey): Promise<Record<string, unknown>> => {
      const req = indexedDB.open(name, version);
      const db = await new Promise<IDBDatabase>((resolveDb, reject) => {
        // A version upgrade would be dangerous in this verification.
        req.onupgradeneeded = () => { req.transaction?.abort(); reject(new Error("unexpected database creation")); };
        req.onsuccess = () => resolveDb(req.result);
        req.onerror = () => reject(req.error);
      });
      try {
        return await new Promise<Record<string, unknown>>((resolveRow, reject) => {
          const row = db.transaction(store, "readonly").objectStore(store).get(key);
          row.onsuccess = () => resolveRow(row.result);
          row.onerror = () => reject(row.error);
        });
      } finally { db.close(); }
    };
    const capataz = await read("consubov-capataz", 7, "syncQueue", "cmd-a");
    const pesagem = await read("consubov-capataz", 7, "pesagensPendentes", "pesagem-a");
    const pdf = await read("consubov-capataz", 7, "lastPdfs", "pdf-a");
    const session = await read("consubov-session", 1, "offline_data", "current");
    const mutation = await read("consubov-consultor-offline", 2, "text_mutations", "mutation-a");
    const photo = await read("consubov-consultor-offline", 2, "foto_queue", "photo-a");
    const table = await read("mais-arrobas-offline", 1, "tables", "table-a");
    const queue = await read("mais-arrobas-sync", 2, "queue", "mais-a");
    const ack = await read("mais-arrobas-sync", 2, "acknowledged-inserts", "ack-a");
    const salga = await read("consubov-fotos-salga", 1, "fotos", "salga-a");
    return {
      capataz: [capataz?.id, capataz?.status],
      pesagem: [pesagem?.id, pesagem?.sincronizado],
      pdf: await pdf?.blob.text(),
      session: session?.offline,
      mutation: [mutation?.id, mutation?.tries],
      photo: await photo?.blob.text(),
      buffer: [...new Uint8Array(photo?.blobBuffer ?? [])],
      table: table?.id,
      queue: [queue?.id, queue?.status],
      ack,
      salga: await salga?.blob.text(),
      backup: localStorage.getItem("pending_backup"),
      backupAt: localStorage.getItem("pending_backup_at"),
      offlineFlag: localStorage.getItem("ma-offline-mode"),
    };
  });
  expect(recovered).toEqual({
    capataz: ["cmd-a", "pending"], pesagem: ["pesagem-a", false],
    pdf: "pdf-bytes-fixture", session: true,
    mutation: ["mutation-a", 2], photo: "photo-bytes-fixture", buffer: [14, 24, 34],
    table: "table-a", queue: ["mais-a", "pending"], ack: "acknowledged",
    salga: "salga-bytes-fixture",
    backup: '{"ids":["cmd-a","pesagem-a"]}',
    backupAt: "2026-10-09T00:00:00Z", offlineFlag: "true",
  });
});
