import { describe, expect, it, vi } from "vitest";
import {
  consumeMigrationFragment,
  receiveV2Migration,
  type DestinationMigrationPort,
} from "./receiveV2Migration";
import { NEW_APP_ORIGIN, TRANSFERABLE_DATABASES } from "./oneTouchMigrationFlow";

const CODE = "safeMigrationReference0123456789abc";
const NEXT = "2026-10-24T20:10:00.000Z";
const now = () => new Date("2026-10-24T20:00:00.000Z");

function createPort(overrides: Partial<DestinationMigrationPort> = {}): DestinationMigrationPort {
  return {
    currentIdentity: vi.fn(async () => ({ tenantId: "tenant-a", userId: "user-a" })),
    redeemOneTimeReference: vi.fn(async () => ({
      migrationId: "migration-1",
      sourceSnapshotId: "snapshot-1",
      tenantId: "tenant-a",
      userId: "user-a",
      expectedDatabases: [...TRANSFERABLE_DATABASES],
      expiresAt: NEXT,
    })),
    hydrateAuthorizedData: vi.fn(async () => ({
      migrationId: "migration-1",
      sourceSnapshotId: "snapshot-1",
      tenantId: "tenant-a",
      userId: "user-a",
      restoredDatabases: [...TRANSFERABLE_DATABASES],
      unconfirmedItems: 0,
      durableLocalCache: true,
    })),
    confirmDestinationReady: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("V2 destination: redeem and rehydrate from server", () => {
  it("removes migration fragment before doing anything else", () => {
    const cleared = vi.fn();
    expect(
      consumeMigrationFragment(
        "https://app.consubov.com.br/baixar#migration=" + CODE,
        cleared,
      ),
    ).toBe(CODE);
    expect(cleared).toHaveBeenCalledOnce();
    expect(consumeMigrationFragment("https://app.consubov.com.br/baixar", cleared)).toBeNull();
    expect(cleared).toHaveBeenCalledOnce();
  });

  it("discards malformed fragment rather than attempting backend redemption", () => {
    const cleared = vi.fn();
    expect(consumeMigrationFragment("https://app.consubov.com.br/baixar#migration=bad", cleared))
      .toBeNull();
    expect(cleared).toHaveBeenCalledOnce();
  });

  it("rejects foreign origins and absent tickets without contacting the backend", async () => {
    const port = createPort();
    expect(await receiveV2Migration({ origin: "https://attacker.test", code: CODE, now }, port))
      .toMatchObject({ ok: false, code: "WRONG_DESTINATION" });
    expect(await receiveV2Migration({ origin: NEW_APP_ORIGIN, code: null, now }, port))
      .toMatchObject({ ok: false, code: "NO_HANDOFF" });
    expect(port.currentIdentity).not.toHaveBeenCalled();
  });

  it("requires normal authenticated login in the new origin", async () => {
    const port = createPort({ currentIdentity: async () => null });
    expect(await receiveV2Migration({ origin: NEW_APP_ORIGIN, code: CODE, now }, port))
      .toMatchObject({ ok: false, code: "LOGIN_REQUIRED" });
    expect(port.redeemOneTimeReference).not.toHaveBeenCalled();
  });

  it("rejects expired or cross-tenant handoffs", async () => {
    const port = createPort({
      redeemOneTimeReference: async () => ({
        migrationId: "migration-1",
        sourceSnapshotId: "snapshot-1",
        tenantId: "tenant-b",
        userId: "user-a",
        expectedDatabases: [...TRANSFERABLE_DATABASES],
        expiresAt: NEXT,
      }),
    });
    expect(await receiveV2Migration({ origin: NEW_APP_ORIGIN, code: CODE, now }, port))
      .toMatchObject({ ok: false, code: "HANDOFF_UNVERIFIED" });
    expect(port.hydrateAuthorizedData).not.toHaveBeenCalled();
  });

  it("does not report success with missing restored photos or an unconfirmed record", async () => {
    const port = createPort({
      hydrateAuthorizedData: async () => ({
        migrationId: "migration-1",
        sourceSnapshotId: "snapshot-1",
        tenantId: "tenant-a",
        userId: "user-a",
        restoredDatabases: TRANSFERABLE_DATABASES.filter(
          (name) => name !== "consubov-fotos-salga",
        ),
        unconfirmedItems: 1,
        durableLocalCache: false,
      }),
    });
    expect(await receiveV2Migration({ origin: NEW_APP_ORIGIN, code: CODE, now }, port))
      .toMatchObject({ ok: false, code: "HYDRATION_INCOMPLETE" });
    expect(port.confirmDestinationReady).not.toHaveBeenCalled();
  });

  it("marks complete only after verified hydration into the NEW local cache", async () => {
    const port = createPort();
    const result = await receiveV2Migration({ origin: NEW_APP_ORIGIN, code: CODE, now }, port);
    expect(result).toEqual({ ok: true, migrationId: "migration-1" });
    expect(port.confirmDestinationReady).toHaveBeenCalledOnce();
    expect(port.redeemOneTimeReference).toHaveBeenCalledWith(CODE);
  });

  it("fails closed when backend completion fails, without manipulating the old app", async () => {
    const port = createPort({
      confirmDestinationReady: async () => { throw new Error("backend offline"); },
    });
    expect(await receiveV2Migration({ origin: NEW_APP_ORIGIN, code: CODE, now }, port))
      .toMatchObject({ ok: false, code: "DESTINATION_INTERRUPTED" });
  });
});
