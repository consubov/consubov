import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_VERSION } from "@/lib/appVersion";

const oldBuild = "1793370000000";
const newBuild = "1793370000001";

const controls = vi.hoisted(() => ({ busy: false, reload: vi.fn(), drain: vi.fn() }));
vi.mock("@/lib/authIdle", () => ({ reloadWhenAuthIdle: controls.reload }));
vi.mock("@/lib/criticalOperations", () => ({
  hasCriticalOperations: () => controls.busy,
  onCriticalOperationsDrained: controls.drain,
}));

describe("PWA update consent (runtime)", () => {
  beforeEach(() => {
    vi.resetModules(); vi.useFakeTimers();
    controls.busy = false; controls.reload.mockReset(); controls.drain.mockReset();
    vi.stubGlobal("__APP_BUILD_VERSION__", oldBuild);
    // A real SW upgrade requires verified newer metadata, not merely a waiting worker.
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ version: newBuild, appVersion: APP_VERSION }),
    })));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  async function fixture() {
    const events = new Map<string, (event?: unknown) => void>();
    const waiting = { postMessage: vi.fn(), scriptURL: `${window.location.origin}/sw.js?v=${newBuild}` };
    const registration = { waiting, update: vi.fn(async () => undefined), addEventListener: vi.fn() };
    const sw = {
      controller: { scriptURL: `${window.location.origin}/sw.js?v=${oldBuild}` },
      getRegistration: vi.fn(async () => registration),
      addEventListener: (name: string, handler: (event?: unknown) => void) => events.set(name, handler),
    };
    vi.stubGlobal("navigator", { serviceWorker: sw });
    return { sw, events, waiting, module: await import("@/lib/swRegistration") };
  }

  it("does not reload after a consent timeout with the old controller", async () => {
    const f = await fixture();
    await f.module.applyPendingUpdateNow("user-click");
    expect(f.waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    await vi.advanceTimersByTimeAsync(16000);
    f.events.get("message")?.({ data: { type: "CONSUBOV_SW_ACTIVATED", version: newBuild } });
    expect(controls.reload).not.toHaveBeenCalled();
  });

  it("does not activate a waiting worker while a field operation is critical", async () => {
    const f = await fixture();
    controls.busy = true;
    controls.drain.mockReturnValue(() => undefined);
    await f.module.applyPendingUpdateNow("user-click");
    expect(f.waiting.postMessage).not.toHaveBeenCalled();
    expect(controls.drain).toHaveBeenCalledOnce();
    expect(controls.reload).not.toHaveBeenCalled();
  });

  it("requires both explicit consent and a changed controller before scheduling reload", async () => {
    const f = await fixture();
    await f.module.applyPendingUpdateNow("user-click");
    f.events.get("controllerchange")?.();
    expect(controls.reload).not.toHaveBeenCalled();
    f.sw.controller = { scriptURL: `${window.location.origin}/sw.js?v=${newBuild}` };
    f.events.get("controllerchange")?.();
    expect(controls.reload).toHaveBeenCalledOnce();
    f.events.get("controllerchange")?.();
    expect(controls.reload).toHaveBeenCalledOnce();
  });
  it("rejects an unverified or stale published release without activating an SW", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ version: oldBuild, appVersion: APP_VERSION }),
    })));
    const f = await fixture();
    await f.module.applyPendingUpdateNow("user-click");
    expect(f.waiting.postMessage).not.toHaveBeenCalled();
    expect(controls.reload).not.toHaveBeenCalled();
  });

});
