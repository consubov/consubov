import { describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { LEGACY_OFFLINE_DATABASES } from "../../lib/legacyOfflineInventory";
import { LEGACY_APP_ORIGIN } from "./oneTouchMigrationFlow";
import { inspectMigrationSourceFootprint } from "./inspectMigrationSourceFootprint";

type KnownDb = (typeof LEGACY_OFFLINE_DATABASES)[number];

function seed(
  factory: IDBFactory,
  expected: KnownDb,
  options: { missingStore?: string; extraStore?: string; value?: unknown } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory.open(expected.name, expected.version);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of expected.stores) {
        if (store !== options.missingStore) db.createObjectStore(store);
      }
      if (options.extraStore) db.createObjectStore(options.extraStore);
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!options.value) {
        db.close();
        resolve();
        return;
      }
      const tx = db.transaction(expected.stores[0], "readwrite");
      tx.objectStore(expected.stores[0]).put(options.value, "entry-1");
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

describe("Legacy v1 source fingerprint: read-only preflight", () => {
  it("refuses any origin other than the real existing app", async () => {
    const factory = new IDBFactory();
    const result = await inspectMigrationSourceFootprint("https://app.consubov.com.br", factory);
    expect(result).toMatchObject({ status: "blocked", reason: "WRONG_ORIGIN", readyToHandoff: false });
    expect(await factory.databases()).toEqual([]);
  });

  it("does not attempt to open databases when enumeration is unsupported", async () => {
    const open = vi.fn();
    const unsupported = { open } as unknown as IDBFactory;
    const result = await inspectMigrationSourceFootprint(LEGACY_APP_ORIGIN, unsupported);
    expect(result).toMatchObject({ status: "blocked", reason: "DATABASE_ENUMERATION_UNAVAILABLE" });
    expect(open).not.toHaveBeenCalled();
  });

  it("lists all six databases as absent without creating them", async () => {
    const factory = new IDBFactory();
    const result = await inspectMigrationSourceFootprint(LEGACY_APP_ORIGIN, factory);
    expect(result.status).toBe("inventory-complete");
    if (result.status !== "inventory-complete") return;
    expect(result.databases).toHaveLength(6);
    expect(result.databases.every((db) => db.present === false)).toBe(true);
    expect(result.totalRecords).toBe(0);
    expect(result.readyToHandoff).toBe(false);
    expect(await factory.databases()).toEqual([]);
  });

  it("counts records but never returns session secrets or individual payloads", async () => {
    const factory = new IDBFactory();
    const session = LEGACY_OFFLINE_DATABASES.find((db) => db.name === "consubov-session");
    if (!session) throw new Error("session inventory fixture missing");
    await seed(factory, session, { value: { refresh_token: "PRIVATE_REFRESH_TOKEN_FOR_TEST" } });
    const result = await inspectMigrationSourceFootprint(LEGACY_APP_ORIGIN, factory);
    expect(result.status).toBe("inventory-complete");
    if (result.status !== "inventory-complete") return;
    expect(result.totalRecords).toBe(1);
    expect(result.databases.find((db) => db.name === "consubov-session")?.stores[0]?.recordCount).toBe(1);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_REFRESH_TOKEN_FOR_TEST");
    expect(result.readyToHandoff).toBe(false);
  });

  it("counts stores without clearing pending records or attachments", async () => {
    const factory = new IDBFactory();
    const capataz = LEGACY_OFFLINE_DATABASES[0];
    await seed(factory, capataz, { value: { data: "synthetic-pending-record", foto: new Blob(["photo"]) } });
    const first = await inspectMigrationSourceFootprint(LEGACY_APP_ORIGIN, factory);
    const second = await inspectMigrationSourceFootprint(LEGACY_APP_ORIGIN, factory);
    expect(first.status).toBe("inventory-complete");
    expect(second.status).toBe("inventory-complete");
    if (first.status !== "inventory-complete" || second.status !== "inventory-complete") return;
    expect(first.totalRecords).toBe(1);
    expect(second.totalRecords).toBe(1);
    expect(await factory.databases()).toHaveLength(1);
  });

  it("blocks when an existing store is missing or an unknown store appears", async () => {
    const factory = new IDBFactory();
    const capataz = LEGACY_OFFLINE_DATABASES[0];
    await seed(factory, capataz, { missingStore: capataz.stores[1] });
    const result = await inspectMigrationSourceFootprint(LEGACY_APP_ORIGIN, factory);
    expect(result).toMatchObject({ status: "blocked", reason: "SCHEMA_UNRECOGNIZED" });
    expect(result.readyToHandoff).toBe(false);

    const second = new IDBFactory();
    await seed(second, capataz, { extraStore: "unknown-sensitive-store" });
    const extra = await inspectMigrationSourceFootprint(LEGACY_APP_ORIGIN, second);
    expect(extra).toMatchObject({ status: "blocked", reason: "SCHEMA_UNRECOGNIZED" });
  });
});
