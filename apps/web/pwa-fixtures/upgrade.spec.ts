import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Local, synthetic old/new SW test; does NOT certify migration of real legacy data. */
const sw = readFileSync(resolve(__dirname, "../public/sw.js"), "utf8");
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
  await page.evaluate(async () => { try { await (await navigator.serviceWorker.getRegistration())?.update(); } catch {} });
  await expect.poll(() => page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return { waiting: !!r?.waiting, installing: !!r?.installing };
  }), { timeout: 20000 }).toEqual({ waiting: false, installing: false });
  await page.context().setOffline(true);
  await page.goto(origin + "/pesagem");
  await expect(page.locator("#build")).toHaveText("a");
});
