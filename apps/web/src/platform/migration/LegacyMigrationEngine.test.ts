import { describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { LegacyMigrationEngine } from "./LegacyMigrationEngine";
import { IndexedDbLocalDatabase } from "../adapters/IndexedDbLocalDatabase";
import { IndexedDbAtomicCommandQueue } from "../adapters/IndexedDbAtomicCommandQueue";

describe("LegacyMigrationEngine unit tests (Vitest)", () => {
  it("initializes and handles absent databases gracefully", async () => {
    const factory = new IDBFactory();
    const owner = { tenantId: "tenant-vitest", userId: "user-vitest" };
    const localDb = new IndexedDbLocalDatabase(owner, factory);
    const queue = new IndexedDbAtomicCommandQueue(factory);

    const engine = new LegacyMigrationEngine(
      { tenantId: owner.tenantId, userId: owner.userId, deviceId: "device-vitest" },
      localDb,
      queue,
      factory,
    );

    const summary = await engine.runMigration();
    expect(summary.success).toBe(true);
    expect(summary.commandsEnqueued).toBe(0);

    const status = await engine.getStatus();
    expect(status?.overallStatus).toBe("completed");

    await localDb.close();
    await queue.close();
  });
});
