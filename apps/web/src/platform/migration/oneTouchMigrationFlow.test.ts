import { describe, expect, it, vi } from "vitest";
import {
  CONSENT_TEXT_VERSION,
  LEGACY_APP_ORIGIN,
  LEGACY_DATABASES,
  MIGRATION_RELEASE_ID,
  NEW_APP_ORIGIN,
  OneTouchMigrationFlow,
  TRANSFERABLE_DATABASES,
  type LegacyDatabase,
  type LocalAudit,
  type MigrationIdentity,
  type MigrationPort,
} from "./oneTouchMigrationFlow";

const identity: MigrationIdentity = {
  tenantId: "tenant-test",
  userId: "user-test",
  deviceId: "device-test",
};
const NOW = new Date("2026-10-24T20:00:00.000Z");
const NEXT = "2026-10-24T20:10:00.000Z";
const CODE = "safeMigrationReference0123456789abc";

function audit(pending = 0): LocalAudit {
  return {
    criticalOperationActive: false,
    databases: LEGACY_DATABASES.map((name) => ({
      name,
      inspected: true,
      pendingRecords: name === "consubov-capataz" ? pending : 0,
      pendingAttachments: 0,
    })),
  };
}

function makePort(overrides: Partial<MigrationPort> = {}): MigrationPort {
  return {
    isOnline: vi.fn(() => true),
    readAuthenticatedIdentity: vi.fn(async () => identity),
    inspectAllLocalDatabases: vi.fn(async () => audit()),
    recordExplicitConsent: vi.fn(async ({ identity: user }: Parameters<MigrationPort["recordExplicitConsent"]>[0]) => ({
      id: "consent-1",
      identity: user,
      textVersion: CONSENT_TEXT_VERSION as typeof CONSENT_TEXT_VERSION,
      releaseId: MIGRATION_RELEASE_ID as typeof MIGRATION_RELEASE_ID,
    })),
    createNonDestructiveBackup: vi.fn(async (user) => ({
      snapshotId: "snapshot-1",
      identity: user,
      coveredDatabases: [...LEGACY_DATABASES],
      durableOnOriginalDevice: true,
      binaryAttachmentsPreserved: true,
    })),
    synchronizeEveryPendingDomain: vi.fn(async () => {}),
    verifyDurableServerAcks: vi.fn(async ({ identity: user }) => ({
      migrationId: "migration-1",
      snapshotId: "snapshot-1",
      identity: user,
      consentReceiptId: "consent-1",
      acknowledgedDatabases: [...TRANSFERABLE_DATABASES],
      unacknowledgedRecords: 0,
      unacknowledgedAttachments: 0,
      durable: true,
      expiresAt: NEXT,
    })),
    createSingleUseHandoff: vi.fn(async () => ({
      code: CODE,
      expiresAt: NEXT,
    })),
    ...overrides,
  };
}

function flow(port: MigrationPort, origin = LEGACY_APP_ORIGIN) {
  return new OneTouchMigrationFlow(port, { origin, now: () => NOW });
}

describe("CONSUBOV v2 single-consent migration", () => {
  it("does not access storage or backend without an explicit tap", async () => {
    const port = makePort();
    const result = await flow(port).run(false);
    expect(result).toMatchObject({ ok: false, code: "CONSENT_REQUIRED" });
    expect(port.readAuthenticatedIdentity).not.toHaveBeenCalled();
    expect(port.recordExplicitConsent).not.toHaveBeenCalled();
    expect(port.synchronizeEveryPendingDomain).not.toHaveBeenCalled();
  });

  it("refuses execution outside the actual legacy origin", async () => {
    const port = makePort();
    const result = await flow(port, NEW_APP_ORIGIN).run(true);
    expect(result).toMatchObject({ ok: false, code: "WRONG_SOURCE_ORIGIN" });
    expect(port.recordExplicitConsent).not.toHaveBeenCalled();
  });

  it("keeps the old app if the device is offline", async () => {
    const port = makePort({ isOnline: () => false });
    expect(await flow(port).run(true)).toMatchObject({ code: "OFFLINE" });
    expect(port.readAuthenticatedIdentity).not.toHaveBeenCalled();
  });

  it("does not transfer without authenticated ownership", async () => {
    const port = makePort({ readAuthenticatedIdentity: async () => null });
    expect(await flow(port).run(true)).toMatchObject({ code: "LOGIN_REQUIRED" });
    expect(port.createNonDestructiveBackup).not.toHaveBeenCalled();
  });

  it("requires an audit of all six legacy databases, including the session DB", async () => {
    const incomplete = audit();
    incomplete.databases.pop();
    const port = makePort({ inspectAllLocalDatabases: async () => incomplete });
    expect(await flow(port).run(true)).toMatchObject({ code: "INCOMPLETE_INVENTORY" });
    expect(port.recordExplicitConsent).not.toHaveBeenCalled();
  });

  it("rejects a critical operation and negative or unknown pending counts", async () => {
    const critical = audit();
    critical.criticalOperationActive = true;
    expect(await flow(makePort({ inspectAllLocalDatabases: async () => critical })).run(true))
      .toMatchObject({ code: "INCOMPLETE_INVENTORY" });
    const invalid = audit();
    invalid.databases[0].pendingAttachments = -1;
    expect(await flow(makePort({ inspectAllLocalDatabases: async () => invalid })).run(true))
      .toMatchObject({ code: "INCOMPLETE_INVENTORY" });
  });

  it("requires proof of the user's explicit consent before the backup", async () => {
    const port = makePort({
      recordExplicitConsent: async () => ({
        id: "consent-1",
        identity: { ...identity, tenantId: "other-tenant" },
        textVersion: CONSENT_TEXT_VERSION,
        releaseId: MIGRATION_RELEASE_ID,
      }),
    });
    expect(await flow(port).run(true)).toMatchObject({ code: "CONSENT_NOT_CONFIRMED" });
    expect(port.createNonDestructiveBackup).not.toHaveBeenCalled();
  });

  it("never migrates if backup excludes photos, blobs, a database or another owner", async () => {
    const port = makePort({
      createNonDestructiveBackup: async (user) => ({
        snapshotId: "snapshot-1",
        identity: user,
        coveredDatabases: LEGACY_DATABASES.filter(
          (name) => name !== "consubov-fotos-salga",
        ),
        durableOnOriginalDevice: true,
        binaryAttachmentsPreserved: false,
      }),
    });
    expect(await flow(port).run(true)).toMatchObject({ code: "BACKUP_INCOMPLETE" });
    expect(port.synchronizeEveryPendingDomain).not.toHaveBeenCalled();
    const mismatched = makePort({
      createNonDestructiveBackup: async () => ({
        snapshotId: "snapshot-1",
        identity: { ...identity, userId: "user-b" },
        coveredDatabases: [...LEGACY_DATABASES],
        durableOnOriginalDevice: true,
        binaryAttachmentsPreserved: true,
      }),
    });
    expect(await flow(mismatched).run(true)).toMatchObject({ code: "BACKUP_INCOMPLETE" });
  });

  it("does not redirect when a receipt contains unconfirmed photos or queues", async () => {
    const port = makePort({
      verifyDurableServerAcks: async () => ({
        migrationId: "migration-1",
        snapshotId: "snapshot-1",
        identity,
        consentReceiptId: "consent-1",
        acknowledgedDatabases: [...TRANSFERABLE_DATABASES],
        unacknowledgedRecords: 0,
        unacknowledgedAttachments: 1,
        durable: true,
        expiresAt: NEXT,
      }),
    });
    expect(await flow(port).run(true)).toMatchObject({ code: "SERVER_ACK_INCOMPLETE" });
    expect(port.createSingleUseHandoff).not.toHaveBeenCalled();
  });

  it("does not accept a receipt with a different tenant or missing domains", async () => {
    const port = makePort({
      verifyDurableServerAcks: async () => ({
        migrationId: "migration-1",
        snapshotId: "snapshot-1",
        identity: { ...identity, tenantId: "wrong-tenant" },
        consentReceiptId: "consent-1",
        acknowledgedDatabases: TRANSFERABLE_DATABASES.slice(0, 4),
        unacknowledgedRecords: 0,
        unacknowledgedAttachments: 0,
        durable: true,
        expiresAt: NEXT,
      }),
    });
    expect(await flow(port).run(true)).toMatchObject({ code: "SERVER_ACK_INCOMPLETE" });
  });

  it("rejects new local records written during migration", async () => {
    const inspect = vi.fn().mockResolvedValueOnce(audit(2)).mockResolvedValueOnce(audit(1));
    const port = makePort({ inspectAllLocalDatabases: inspect });
    expect(await flow(port).run(true)).toMatchObject({ code: "NEW_LOCAL_PENDING" });
    expect(port.createSingleUseHandoff).not.toHaveBeenCalled();
  });

  it("blocks expired or invalid transfer references", async () => {
    const port = makePort({
      createSingleUseHandoff: async () => ({
        code: "short",
        expiresAt: "2026-10-24T20:11:00.000Z",
      }),
    });
    expect(await flow(port).run(true)).toMatchObject({ code: "HANDOFF_INVALID" });
  });

  it("fails closed after a network/storage error without deleting the old app", async () => {
    const port = makePort({
      synchronizeEveryPendingDomain: async () => { throw new Error("secret: should not leak"); },
    });
    const result = await flow(port).run(true);
    expect(result).toMatchObject({ code: "MIGRATION_INTERRUPTED" });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(port.createSingleUseHandoff).not.toHaveBeenCalled();
  });

  it("returns a single-use handoff only after every verified gate succeeds", async () => {
    const port = makePort({
      inspectAllLocalDatabases: vi.fn()
        .mockResolvedValueOnce(audit(5))
        .mockResolvedValueOnce(audit(0)),
    });
    const stages: string[] = [];
    const result = await flow(port).run(true, (phase) => stages.push(phase));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const url = new URL(result.url);
    expect(url.origin).toBe(NEW_APP_ORIGIN);
    expect(url.pathname).toBe("/baixar");
    expect(url.search).toBe("");
    expect(url.hash).toBe("#migration=" + CODE);
    expect(result.migrationId).toBe("migration-1");
    expect(stages).toEqual(["checking", "backup", "syncing", "verifying", "opening"]);
    expect(port.recordExplicitConsent).toHaveBeenCalledWith({
      identity,
      releaseId: MIGRATION_RELEASE_ID,
      textVersion: CONSENT_TEXT_VERSION,
      grantedAt: NOW.toISOString(),
    });
  });


  it("does not resume without a backend-validated previous consent", async () => {
    const port = makePort();
    expect(await flow(port).resumePreviouslyAuthorized()).toMatchObject({
      ok: false,
      code: "CONSENT_NOT_CONFIRMED",
    });
    expect(port.recordExplicitConsent).not.toHaveBeenCalled();
    expect(port.createNonDestructiveBackup).not.toHaveBeenCalled();
  });

  it("resumes automatically without a second notification after verified consent", async () => {
    const port = makePort({
      recoverPreviouslyGrantedConsent: vi.fn(async ({ identity: user }: Parameters<NonNullable<MigrationPort["recoverPreviouslyGrantedConsent"]>>[0]) => ({
        id: "consent-1",
        identity: user,
        textVersion: CONSENT_TEXT_VERSION as typeof CONSENT_TEXT_VERSION,
        releaseId: MIGRATION_RELEASE_ID as typeof MIGRATION_RELEASE_ID,
      })),
    });
    const result = await flow(port).resumePreviouslyAuthorized();
    expect(result.ok).toBe(true);
    expect(port.recoverPreviouslyGrantedConsent).toHaveBeenCalledOnce();
    expect(port.recordExplicitConsent).not.toHaveBeenCalled();
    expect(port.synchronizeEveryPendingDomain).toHaveBeenCalledOnce();
  });

  it("deduplicates simultaneous presses so consent and upload run once", async () => {
    let release: (() => void) | undefined;
    const wait = new Promise<void>((resolve) => { release = resolve; });
    const port = makePort({
      synchronizeEveryPendingDomain: vi.fn(async () => { await wait; }),
    });
    const migration = flow(port);
    const first = migration.run(true);
    const second = migration.run(true);
    expect(first).toBe(second);
    release?.();
    const [a, b] = await Promise.all([first, second]);
    expect(a).toEqual(b);
    expect(port.recordExplicitConsent).toHaveBeenCalledTimes(1);
    expect(port.synchronizeEveryPendingDomain).toHaveBeenCalledTimes(1);
  });
});
