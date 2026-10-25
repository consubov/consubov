import { afterEach, describe, expect, it, vi } from "vitest";
import { createV2MigrationApiPort } from "./apiV2MigrationDestinationPort";
import { TRANSFERABLE_DATABASES } from "./oneTouchMigrationFlow";

afterEach(() => {
  vi.unstubAllGlobals();
});

const VALID_MIGRATION = {
  migrationId: "migration-synthetic-1",
  sourceSnapshotId: "snapshot-synthetic-1",
  tenantId: "tenant-synthetic-1",
  userId: "user-synthetic-1",
  expectedDatabases: [...TRANSFERABLE_DATABASES],
  expiresAt: "2026-10-25T14:00:00.000Z",
};

function api(getAccessToken = async () => "synthetic-test-token") {
  return createV2MigrationApiPort({
    baseUrl: "https://api.example.test",
    getAccessToken,
  });
}

describe("V2 migration destination API contract", () => {
  it("never requests a backend endpoint without a verified auth token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(api(async () => null).currentIdentity())
      .rejects.toThrow("MIGRATION_BACKEND_UNAVAILABLE");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never uses an unconfigured backend URL", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const port = createV2MigrationApiPort({
      baseUrl: "",
      getAccessToken: async () => "synthetic-token",
    });
    await expect(port.currentIdentity()).rejects.toThrow("MIGRATION_BACKEND_UNAVAILABLE");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes bearer auth only to the configured backend and blocks caching", async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ tenantId: "tenant-synthetic-1", userId: "user-synthetic-1" }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const result = await api().currentIdentity();
    expect(result).toEqual({
      tenantId: "tenant-synthetic-1",
      userId: "user-synthetic-1",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.test/api/v1/migration/me");
    expect(opts.credentials).toBe("omit");
    expect(opts.cache).toBe("no-store");
    expect(new Headers(opts.headers).get("Authorization")).toBe("Bearer synthetic-test-token");
    expect(new Headers(opts.headers).get("cache-control")).toBe("no-store");
  });

  it("fails closed on invalid server identity; never trusts an incomplete JSON response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ userId: "user-synthetic-1" }),
      { status: 200, headers: { "content-type": "application/json" } },
    )));
    await expect(api().currentIdentity()).rejects.toThrow();
  });

  it("never redeems an invalid migration reference", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(api().redeemOneTimeReference("bad")).rejects.toThrow("INVALID_REFERENCE");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a migration owned by a different tenant even when the response is syntactically valid", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ ...VALID_MIGRATION, tenantId: "other-tenant" }),
      { status: 200, headers: { "content-type": "application/json" } },
    )));
    const port = api();
    if (!port.findVerifiedMigrationForIdentity) throw new Error("DISCOVERY_NOT_CONFIGURED");
    await expect(port.findVerifiedMigrationForIdentity({
      tenantId: VALID_MIGRATION.tenantId,
      userId: VALID_MIGRATION.userId,
    })).rejects.toThrow("TENANT_MISMATCH");
  });

  it("rejects a backend failure without falling back to unauthenticated data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }),
      { status: 401, headers: { "content-type": "application/json" } },
    )));
    await expect(api().currentIdentity()).rejects.toThrow();
  });

  it("does not mark a migration complete without a real hydration adapter", async () => {
    await expect(api().hydrateAuthorizedData(VALID_MIGRATION))
      .rejects.toThrow("HYDRATION_ADAPTER_NOT_CONFIGURED");
  });
});
