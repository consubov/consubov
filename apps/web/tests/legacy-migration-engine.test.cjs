const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { indexedDB, IDBKeyRange } = require("fake-indexeddb");

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
    IDBKeyRange,
    ...extraGlobals,
  };
  vm.runInNewContext("(function(exports,require){" + js + "\n})", context)(exported, (specifier) => {
    if (specifier in imports) return imports[specifier];
    throw new Error("unexpected import " + specifier + " in " + file);
  });
  return exported;
}

const policy = loadTs("../src/platform/offline/commandPolicy.ts");
const localDbMod = loadTs("../src/platform/adapters/IndexedDbLocalDatabase.ts");
const queueMod = loadTs("../src/platform/adapters/IndexedDbAtomicCommandQueue.ts", {
  "../offline/commandPolicy": policy,
});
const inventoryMod = loadTs("../src/lib/legacyOfflineInventory.ts");

const migrationMod = loadTs(
  "../src/platform/migration/LegacyMigrationEngine.ts",
  {
    "../adapters/IndexedDbLocalDatabase": localDbMod,
    "../adapters/IndexedDbAtomicCommandQueue": queueMod,
    "../offline/commandPolicy": policy,
    "../../lib/legacyOfflineInventory": inventoryMod,
  },
  { IDBKeyRange }
);

const { LegacyMigrationEngine } = migrationMod;
const { IndexedDbLocalDatabase } = localDbMod;
const { IndexedDbAtomicCommandQueue } = queueMod;

const fakeFactory = () => new indexedDB.constructor();

function mockLocalStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, val) {
      store.set(key, String(val));
    },
    has(key) {
      return store.has(key);
    },
    _raw: store,
  };
}

async function populateLegacyDbs(factory) {
  // 1. consubov-capataz (v7)
  await new Promise((resolve, reject) => {
    const req = factory.open("consubov-capataz", 7);
    req.onupgradeneeded = () => {
      const db = req.result;
      const lanc = db.createObjectStore("lancamentos", { keyPath: "id" });
      const obs = db.createObjectStore("observacoesOffline", { keyPath: "id" });
      const pes = db.createObjectStore("pesagensPendentes", { keyPath: "id" });
      const sq = db.createObjectStore("syncQueue", { keyPath: "id" });
      const se = db.createObjectStore("syncErrors", { keyPath: "id" });
      const pdf = db.createObjectStore("lastPdfs", { keyPath: "id" });
      const pas = db.createObjectStore("pastos", { keyPath: "id" });
      const ret = db.createObjectStore("retiro", { keyPath: "id" });
      const cic = db.createObjectStore("ciclos", { keyPath: "id" });
      const prod = db.createObjectStore("produtoAtivo", { keyPath: "id" });
      const faz = db.createObjectStore("fazendaCache", { keyPath: "id" });
      const cfg = db.createObjectStore("config", { keyPath: "key" });
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction([
        "lancamentos", "observacoesOffline", "pesagensPendentes", "syncQueue", "syncErrors",
        "lastPdfs", "pastos", "retiro", "ciclos", "produtoAtivo", "fazendaCache", "config"
      ], "readwrite");

      tx.objectStore("lancamentos").put({ id: "lanc-1", status: "pendente", peso: 450, criado_em: "2026-10-10T10:00:00Z" });
      tx.objectStore("lancamentos").put({ id: "lanc-2", status: "sincronizado", peso: 480, criado_em: "2026-10-09T10:00:00Z" });

      tx.objectStore("observacoesOffline").put({ id: "obs-1", status: "pendente", texto: "pasto 3 precisando sal" });
      tx.objectStore("observacoesOffline").put({ id: "obs-2", status: "sincronizado", texto: "conferido" });

      tx.objectStore("pesagensPendentes").put({ id: "pes-1", sincronizado: false, animal: "BOV-001", peso: 510 });
      tx.objectStore("pesagensPendentes").put({ id: "pes-2", sincronizado: true, animal: "BOV-002", peso: 495 });

      tx.objectStore("syncQueue").put({ id: "sq-1", action: "sync_batch", items: [1, 2] });
      tx.objectStore("syncErrors").put({ id: "err-1", error: "network timeout" });

      const pdfBlob = new Blob(["mock-pdf-content-bytes"], { type: "application/pdf" });
      tx.objectStore("lastPdfs").put({ id: "pdf-1", fileName: "resumo-salga.pdf", blob: pdfBlob });

      tx.objectStore("pastos").put({ id: "pasto-1", nome: "Pasto Principal", lotacao: 120 });
      tx.objectStore("retiro").put({ id: "ret-1", nome: "Retiro Sede" });
      tx.objectStore("ciclos").put({ id: "cic-1", nome: "Ciclo das Águas 2026" });
      tx.objectStore("produtoAtivo").put({ id: "prod-1", nome: "Sal Mineral 80" });
      tx.objectStore("fazendaCache").put({ id: "faz-1", nome: "Fazenda Santa Maria" });
      tx.objectStore("config").put({ key: "modo_conferencia", valor: "avancado" });

      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
    req.onerror = () => reject(req.error);
  });

  // 2. consubov-session (v1)
  await new Promise((resolve, reject) => {
    const req = factory.open("consubov-session", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("auth_session");
      db.createObjectStore("offline_data");
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(["auth_session", "offline_data"], "readwrite");
      tx.objectStore("auth_session").put({ user_id: "user-1", token: "tok-123" }, "current");
      tx.objectStore("offline_data").put({ cachedAt: "2026-10-10" }, "current");
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
    req.onerror = () => reject(req.error);
  });

  // 3. consubov-consultor-offline (v2)
  await new Promise((resolve, reject) => {
    const req = factory.open("consubov-consultor-offline", 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("foto_queue", { keyPath: "localId" });
      db.createObjectStore("text_mutations", { keyPath: "id" });
      db.createObjectStore("snapshots", { keyPath: "visitaId" });
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(["foto_queue", "text_mutations", "snapshots"], "readwrite");
      const fotoBlob = new Blob(["mock-foto-consultor"], { type: "image/jpeg" });
      tx.objectStore("foto_queue").put({
        localId: "foto-consultor-1",
        visitaId: "vis-1",
        blob: fotoBlob,
        mime: "image/jpeg",
        queuedAt: "2026-10-10T11:00:00Z",
      });
      tx.objectStore("text_mutations").put({ id: "mut-1", campo: "diagnostico", valor: "pastagem degradada" });
      tx.objectStore("snapshots").put({ visitaId: "vis-1", resumo: "visita completa" });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
    req.onerror = () => reject(req.error);
  });

  // 4. mais-arrobas-offline (v1)
  await new Promise((resolve, reject) => {
    const req = factory.open("mais-arrobas-offline", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("tables");
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(["tables"], "readwrite");
      tx.objectStore("tables").put([{ id: 1, name: "Animais" }], "animais_cache");
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
    req.onerror = () => reject(req.error);
  });

  // 5. mais-arrobas-sync (v2)
  await new Promise((resolve, reject) => {
    const req = factory.open("mais-arrobas-sync", 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("queue", { keyPath: "id" });
      db.createObjectStore("acknowledged-inserts", { keyPath: "key" });
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(["queue", "acknowledged-inserts"], "readwrite");
      tx.objectStore("queue").put({ id: "ma-cmd-1", acao: "pesar_lote", criado_em: "2026-10-10T12:00:00Z" });
      tx.objectStore("acknowledged-inserts").put({ key: "ma-ack-1", confirmedAt: "2026-10-09" });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
    req.onerror = () => reject(req.error);
  });

  // 6. consubov-fotos-salga (v1)
  await new Promise((resolve, reject) => {
    const req = factory.open("consubov-fotos-salga", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("fotos", { keyPath: "lancamento_id" });
      db.createObjectStore("feitos");
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(["fotos", "feitos"], "readwrite");
      const cochoBlob = new Blob(["mock-foto-cocho-salga"], { type: "image/jpeg" });
      tx.objectStore("fotos").put({
        lancamento_id: "salga-1",
        pasto_id: "pasto-1",
        blob: cochoBlob,
        tirada_em: "2026-10-10T13:00:00Z",
      });
      tx.objectStore("feitos").put({ synced: true }, "salga-feita-1");
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
    req.onerror = () => reject(req.error);
  });
}

test("Scenario 1: Absent or empty databases completes with success and clean checkpoint", async () => {
  const factory = fakeFactory();
  const storage = mockLocalStorage();
  const owner = { tenantId: "tenant-test", userId: "user-test" };
  const localDb = new IndexedDbLocalDatabase(owner, factory);
  const commandQueue = new IndexedDbAtomicCommandQueue(factory);

  const engine = new LegacyMigrationEngine(
    { tenantId: owner.tenantId, userId: owner.userId, deviceId: "device-1" },
    localDb,
    commandQueue,
    factory,
    storage
  );

  const summary = await engine.runMigration();
  assert.equal(summary.success, true);
  assert.equal(summary.totalDatabasesInspected, 0);
  assert.equal(summary.commandsEnqueued, 0);
  assert.equal(summary.errors.length, 0);

  const status = await engine.getStatus();
  assert.equal(status.overallStatus, "completed");
  assert.equal(status.tenantId, owner.tenantId);

  await localDb.close();
  await commandQueue.close();
});

test("Scenario 2: Full migration maps all 6 legacy databases and localStorage into vNext", async () => {
  const factory = fakeFactory();
  await populateLegacyDbs(factory);

  const storage = mockLocalStorage({
    pending_backup: JSON.stringify({ backupId: "b-1" }),
    pending_backup_at: "2026-10-10T14:00:00Z",
    "ma-offline-mode": "true",
  });

  const owner = { tenantId: "tenant-consubov", userId: "user-capataz" };
  const localDb = new IndexedDbLocalDatabase(owner, factory);
  const commandQueue = new IndexedDbAtomicCommandQueue(factory);

  const engine = new LegacyMigrationEngine(
    { tenantId: owner.tenantId, userId: owner.userId, deviceId: "device-alpha" },
    localDb,
    commandQueue,
    factory,
    storage
  );

  const summary = await engine.runMigration({ batchSize: 5 });
  assert.equal(summary.success, true);
  assert.equal(summary.totalDatabasesInspected, 6);
  assert.equal(summary.errors.length, 0);

  // Verify pending commands in AtomicCommandQueue
  const pendingCommands = await commandQueue.listPending(owner);
  const pendingIds = pendingCommands.map((c) => c.commandId);
  assert.ok(pendingIds.includes("lanc-1"), "lanc-1 should be pending command");
  assert.ok(pendingIds.includes("obs-1"), "obs-1 should be pending command");
  assert.ok(pendingIds.includes("pes-1"), "pes-1 should be pending command");
  assert.ok(pendingIds.includes("sq-1"), "sq-1 should be pending command");
  assert.ok(pendingIds.includes("foto-consultor-1"), "foto-consultor-1 should be pending command");
  assert.ok(pendingIds.includes("mut-1"), "mut-1 should be pending command");
  assert.ok(pendingIds.includes("ma-cmd-1"), "ma-cmd-1 should be pending command");
  assert.ok(pendingIds.includes("salga-1"), "salga-1 should be pending command");

  // Verify all pending commands have attemptCount 0 and deterministic idempotencyKey
  for (const cmd of pendingCommands) {
    assert.equal(cmd.status, "pending");
    assert.equal(cmd.attemptCount, 0);
    assert.ok(cmd.idempotencyKey.startsWith("urn:consubov:"), "idempotency key must start with urn:consubov:");
  }

  // Verify historical/reference records in IndexedDbLocalDatabase
  const lanc2 = await localDb.get("capataz:lancamento:lanc-2");
  assert.ok(lanc2, "lanc-2 should be in LocalDatabase");
  assert.equal(lanc2.status, "sincronizado");

  const pasto1 = await localDb.get("capataz:ref:pasto:pasto-1");
  assert.ok(pasto1, "pasto-1 should be in LocalDatabase");
  assert.equal(pasto1.nome, "Pasto Principal");

  const session = await localDb.get("session:auth_current");
  assert.ok(session, "session should be in LocalDatabase");
  assert.equal(session.token, "tok-123");

  const backup = await localDb.get("backup:pending_backup");
  assert.ok(backup, "backup should be in LocalDatabase");

  const pdfRecord = await localDb.get("capataz:pdf:pdf-1");
  assert.ok(pdfRecord, "pdf record should exist");
  assert.ok(pdfRecord.blob instanceof Blob, "blob should be preserved as Blob");
  assert.equal(await pdfRecord.blob.text(), "mock-pdf-content-bytes");

  await localDb.close();
  await commandQueue.close();
});

test("Scenario 3: Strict Idempotency — Running migration 2x consecutively produces zero duplicates and zero errors", async () => {
  const factory = fakeFactory();
  await populateLegacyDbs(factory);

  const storage = mockLocalStorage({
    pending_backup: "backup-data",
  });

  const owner = { tenantId: "tenant-idem", userId: "user-idem" };
  const localDb = new IndexedDbLocalDatabase(owner, factory);
  const commandQueue = new IndexedDbAtomicCommandQueue(factory);

  const engine = new LegacyMigrationEngine(
    { tenantId: owner.tenantId, userId: owner.userId, deviceId: "device-idem" },
    localDb,
    commandQueue,
    factory,
    storage
  );

  // First run
  const firstSummary = await engine.runMigration();
  assert.equal(firstSummary.success, true);
  const firstCount = (await commandQueue.listPending(owner)).length;
  assert.ok(firstCount > 0);

  // Second run immediately
  const secondSummary = await engine.runMigration();
  assert.equal(secondSummary.success, true);
  assert.equal(secondSummary.errors.length, 0);

  // Verify queue count did not increase
  const secondCount = (await commandQueue.listPending(owner)).length;
  assert.equal(secondCount, firstCount, "Queue count must remain strictly identical on second run");

  // Third run with a brand new engine instance
  const engine3 = new LegacyMigrationEngine(
    { tenantId: owner.tenantId, userId: owner.userId, deviceId: "device-idem" },
    localDb,
    commandQueue,
    factory,
    storage
  );
  const thirdSummary = await engine3.runMigration();
  assert.equal(thirdSummary.success, true);
  const thirdCount = (await commandQueue.listPending(owner)).length;
  assert.equal(thirdCount, firstCount, "Queue count must remain strictly identical on third run");

  await localDb.close();
  await commandQueue.close();
});

test("Scenario 4: Crash Resumption — Interrupted run resumes from checkpoint without duplicating records", async () => {
  const factory = fakeFactory();
  await populateLegacyDbs(factory);

  const storage = mockLocalStorage();
  const owner = { tenantId: "tenant-crash", userId: "user-crash" };
  const localDb = new IndexedDbLocalDatabase(owner, factory);
  const commandQueue = new IndexedDbAtomicCommandQueue(factory);

  // Populate multiple lancamentos to test batch pagination
  await new Promise((resolve, reject) => {
    const req = factory.open("consubov-capataz", 7);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("lancamentos", "readwrite");
      const store = tx.objectStore("lancamentos");
      for (let i = 10; i <= 25; i++) {
        store.put({ id: `lanc-${i}`, status: "pendente", peso: 400 + i });
      }
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });

  // Run with batchSize=2, interrupt after 2 batches
  let batchCount = 0;
  const engine1 = new LegacyMigrationEngine(
    { tenantId: owner.tenantId, userId: owner.userId, deviceId: "device-crash" },
    localDb,
    commandQueue,
    factory,
    storage
  );

  try {
    await engine1.runMigration({
      batchSize: 2,
      onProgress(p) {
        if (p.storeName === "lancamentos") {
          batchCount++;
          if (batchCount >= 2) {
            throw new Error("SIMULATED_CRASH_DURING_MIGRATION");
          }
        }
      },
    });
  } catch (err) {
    // Expected simulation crash
  }

  // Check state after crash: should be in_progress or partial_error
  const intermediateState = await engine1.getStatus();
  assert.ok(intermediateState, "Migration state must be persisted up to crash");
  const lancCheckpoint = intermediateState.checkpoints["consubov-capataz:lancamentos"];
  assert.ok(lancCheckpoint, "Lancamentos checkpoint must exist");
  assert.ok(lancCheckpoint.recordsMigrated > 0, "Some records must have been migrated before crash");

  // Now create a new engine and resume
  const engine2 = new LegacyMigrationEngine(
    { tenantId: owner.tenantId, userId: owner.userId, deviceId: "device-crash" },
    localDb,
    commandQueue,
    factory,
    storage
  );

  const resumeSummary = await engine2.runMigration({ batchSize: 5 });
  assert.equal(resumeSummary.success, true);

  const finalState = await engine2.getStatus();
  assert.equal(finalState.overallStatus, "completed");

  // Confirm all lancamentos exist exactly once in queue
  const pending = await commandQueue.listPending(owner);
  const lancIds = pending.map((c) => c.commandId).filter((id) => id.startsWith("lanc-"));
  const uniqueLancIds = new Set(lancIds);
  assert.equal(lancIds.length, uniqueLancIds.size, "No duplicate command IDs in queue");

  await localDb.close();
  await commandQueue.close();
});

test("Scenario 5: Preserves Blobs and ArrayBuffers bit-a-bit", async () => {
  const factory = fakeFactory();
  await populateLegacyDbs(factory);

  const owner = { tenantId: "tenant-blob", userId: "user-blob" };
  const localDb = new IndexedDbLocalDatabase(owner, factory);
  const commandQueue = new IndexedDbAtomicCommandQueue(factory);

  const engine = new LegacyMigrationEngine(
    { tenantId: owner.tenantId, userId: owner.userId, deviceId: "device-blob" },
    localDb,
    commandQueue,
    factory,
    mockLocalStorage()
  );

  const summary = await engine.runMigration();
  assert.equal(summary.success, true);
  assert.ok(summary.blobsPreserved >= 3, "At least 3 binary blobs preserved (PDF, consultor foto, salga foto)");

  // Verify PDF in LocalDatabase
  const pdfItem = await localDb.get("capataz:pdf:pdf-1");
  assert.ok(pdfItem.blob instanceof Blob);
  assert.equal(pdfItem.blob.type, "application/pdf");
  assert.equal(await pdfItem.blob.text(), "mock-pdf-content-bytes");

  // Verify Consultor foto in AtomicCommandQueue
  const fotoCmd = await commandQueue.get(owner, "foto-consultor-1");
  assert.ok(fotoCmd);
  assert.ok(fotoCmd.payload.blob instanceof Blob);
  assert.equal(fotoCmd.payload.blob.type, "image/jpeg");
  assert.equal(await fotoCmd.payload.blob.text(), "mock-foto-consultor");

  // Verify Salga foto in AtomicCommandQueue
  const salgaCmd = await commandQueue.get(owner, "salga-1");
  assert.ok(salgaCmd);
  assert.ok(salgaCmd.payload.blob instanceof Blob);
  assert.equal(salgaCmd.payload.blob.type, "image/jpeg");
  assert.equal(await salgaCmd.payload.blob.text(), "mock-foto-cocho-salga");

  await localDb.close();
  await commandQueue.close();
});

test("Scenario 6: Multi-Tenant and Multi-User Isolation", async () => {
  const factory = fakeFactory();
  await populateLegacyDbs(factory);

  const ownerA = { tenantId: "tenant-a", userId: "user-a" };
  const ownerB = { tenantId: "tenant-b", userId: "user-b" };

  const localDbA = new IndexedDbLocalDatabase(ownerA, factory);
  const queueA = new IndexedDbAtomicCommandQueue(factory);

  const engineA = new LegacyMigrationEngine(
    { tenantId: ownerA.tenantId, userId: ownerA.userId, deviceId: "device-a" },
    localDbA,
    queueA,
    factory,
    mockLocalStorage({ pending_backup: "user-a-backup" })
  );

  await engineA.runMigration();

  // Inspect from User B's perspective
  const localDbB = new IndexedDbLocalDatabase(ownerB, factory);
  const queueB = new IndexedDbAtomicCommandQueue(factory);

  const pendingB = await queueB.listPending(ownerB);
  assert.equal(pendingB.length, 0, "User B must see 0 pending commands");

  const cmdB = await queueB.get(ownerB, "lanc-1");
  assert.equal(cmdB, null, "User B cannot get User A's command");

  const backupB = await localDbB.get("backup:pending_backup");
  assert.equal(backupB, undefined, "User B cannot get User A's KV data");

  await localDbA.close();
  await queueA.close();
  await localDbB.close();
  await queueB.close();
});

test("Scenario 7: Non-destructive guarantee — Legacy databases remain intact with all original records", async () => {
  const factory = fakeFactory();
  await populateLegacyDbs(factory);

  const storage = mockLocalStorage({
    pending_backup: "backup-stays-intact",
  });

  const owner = { tenantId: "tenant-nd", userId: "user-nd" };
  const localDb = new IndexedDbLocalDatabase(owner, factory);
  const commandQueue = new IndexedDbAtomicCommandQueue(factory);

  const engine = new LegacyMigrationEngine(
    { tenantId: owner.tenantId, userId: owner.userId, deviceId: "device-nd" },
    localDb,
    commandQueue,
    factory,
    storage
  );

  await engine.runMigration();

  // Verify all 6 legacy databases still exist
  const dbs = await factory.databases();
  const dbNames = dbs.map((d) => d.name);
  assert.ok(dbNames.includes("consubov-capataz"));
  assert.ok(dbNames.includes("consubov-session"));
  assert.ok(dbNames.includes("consubov-consultor-offline"));
  assert.ok(dbNames.includes("mais-arrobas-offline"));
  assert.ok(dbNames.includes("mais-arrobas-sync"));
  assert.ok(dbNames.includes("consubov-fotos-salga"));

  // Verify records inside consubov-capataz remain intact
  await new Promise((resolve, reject) => {
    const req = factory.open("consubov-capataz", 7);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("lancamentos", "readonly");
      const store = tx.objectStore("lancamentos");
      const getReq = store.get("lanc-1");
      getReq.onsuccess = () => {
        assert.ok(getReq.result, "lanc-1 must still be in legacy store");
        assert.equal(getReq.result.status, "pendente");
        db.close();
        resolve();
      };
      getReq.onerror = () => { db.close(); reject(getReq.error); };
    };
    req.onerror = () => reject(req.error);
  });

  // Verify localStorage still has keys intact
  assert.equal(storage.getItem("pending_backup"), "backup-stays-intact");

  await localDb.close();
  await commandQueue.close();
});
