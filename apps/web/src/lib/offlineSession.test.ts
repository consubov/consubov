import { beforeEach, describe, expect, it, vi } from "vitest";

const openDB = vi.hoisted(() => vi.fn());
vi.mock("idb", () => ({ openDB }));

const emptyDb = () => ({
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
});

async function loadModule() {
  vi.resetModules();
  return import("./offlineSession");
}

describe("getAuthSession cold database discovery", () => {
  const originalDatabases = globalThis.indexedDB.databases;

  beforeEach(() => {
    openDB.mockReset();
    globalThis.indexedDB.databases = originalDatabases;
  });

  it("returns null without opening a database when the session database is absent", async () => {
    globalThis.indexedDB.databases = vi.fn().mockResolvedValue([]);
    const session = await (await loadModule()).getAuthSession();

    expect(session).toBeNull();
    expect(openDB).not.toHaveBeenCalled();
  });

  it("keeps the existing read path when the session database exists", async () => {
    const db = emptyDb();
    const payload = {
      user_id: "stored-user",
      email: "stored@example.test",
      access_token: "stored-access",
      refresh_token: "stored-refresh",
      expires_at: 2,
      saved_at: new Date(0).toISOString(),
    };
    db.get.mockResolvedValue(payload);
    globalThis.indexedDB.databases = vi.fn().mockResolvedValue([{ name: "consubov-session", version: 1 }]);
    openDB.mockResolvedValue(db);
    const offlineSession = await loadModule();

    await expect(offlineSession.getAuthSession()).resolves.toEqual(payload);
    await expect(offlineSession.getAuthSession()).resolves.toEqual(payload);
    expect(openDB).toHaveBeenCalledTimes(1);
    expect(globalThis.indexedDB.databases).toHaveBeenCalledTimes(1);
    expect(db.get).toHaveBeenCalledWith("auth_session", "current");
  });

  it("keeps the existing read path when database enumeration is unavailable", async () => {
    globalThis.indexedDB.databases = undefined as typeof globalThis.indexedDB.databases;
    const db = emptyDb();
    openDB.mockResolvedValue(db);

    await expect((await loadModule()).getAuthSession()).resolves.toBeNull();
    expect(openDB).toHaveBeenCalledTimes(1);
  });

  it("keeps the existing read path when database enumeration rejects", async () => {
    globalThis.indexedDB.databases = vi.fn().mockRejectedValue(new Error("enumeration unavailable"));
    const db = emptyDb();
    openDB.mockResolvedValue(db);

    await expect((await loadModule()).getAuthSession()).resolves.toBeNull();
    expect(openDB).toHaveBeenCalledTimes(1);
  });

  it("uses a concurrent save that starts while absence enumeration is pending", async () => {
    let resolveEnumeration!: (names: IDBDatabaseInfo[]) => void;
    globalThis.indexedDB.databases = vi.fn().mockImplementation(() => new Promise(resolve => { resolveEnumeration = resolve; }));
    const db = emptyDb();
    const savedSession = {
      user_id: "fixture-user",
      email: "fixture@example.test",
      access_token: "fixture-access",
      refresh_token: "fixture-refresh",
      expires_at: 1,
      saved_at: new Date(0).toISOString(),
    };
    db.get.mockResolvedValue(savedSession);
    openDB.mockResolvedValue(db);
    const offlineSession = await loadModule();

    const read = offlineSession.getAuthSession();
    await Promise.resolve();
    await offlineSession.saveAuthSession(savedSession);
    resolveEnumeration([]);

    await expect(read).resolves.toEqual(savedSession);
    expect(openDB).toHaveBeenCalledTimes(1);
    expect(db.put).toHaveBeenCalledWith("auth_session", expect.objectContaining({ user_id: "fixture-user" }), "current");
    expect(db.get).toHaveBeenCalledWith("auth_session", "current");
  });
});
