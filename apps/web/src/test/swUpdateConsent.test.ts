import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const controls = vi.hoisted(() => ({ busy: false, reload: vi.fn(), drain: vi.fn() }));
vi.mock("@/lib/authIdle", () => ({ reloadWhenAuthIdle: controls.reload }));
vi.mock("@/lib/criticalOperations", () => ({
  hasCriticalOperations: () => controls.busy,
  onCriticalOperationsDrained: controls.drain,
}));

const LOCAL_BUILD = "1793286452000";
const REMOTE_BUILD = "1793286453000";

describe("PWA update consent (verified 2.0.0 release)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    controls.busy = false;
    controls.reload.mockReset();
    controls.drain.mockReset();
    controls.drain.mockReturnValue(() => undefined);
    vi.stubGlobal("__APP_BUILD_VERSION__", LOCAL_BUILD);
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ appVersion: "2.0.0", version: REMOTE_BUILD }),
    })));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function fixture(waitingVersion = REMOTE_BUILD) {
    const events = new Map<string, (event?: unknown) => void>();
    const waiting = {
      postMessage: vi.fn(),
      scriptURL: window.location.origin + "/sw.js?v=" + waitingVersion,
    };
    const registration = {
      waiting,
      update: vi.fn(async () => undefined),
      addEventListener: vi.fn(),
    };
    const sw = {
      controller: { scriptURL: window.location.origin + "/sw.js?v=" + LOCAL_BUILD },
      getRegistration: vi.fn(async () => registration),
      addEventListener: (name: string, handler: (event?: unknown) => void) => events.set(name, handler),
    };
    vi.stubGlobal("navigator", { serviceWorker: sw });
    return { sw, events, waiting, module: await import("@/lib/swRegistration") };
  }

  it("refuses a regressive 1.155.0 release despite a newer build timestamp", async () => {
    const f = await fixture();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ appVersion: "1.155.0", version: REMOTE_BUILD }),
    })));
    await f.module.applyPendingUpdateNow("user-click");
    expect(f.waiting.postMessage).not.toHaveBeenCalled();
    expect(controls.reload).not.toHaveBeenCalled();
  });

  it("refuses a worker whose timestamp does not match the published release", async () => {
    const f = await fixture("1793286454000");
    await f.module.applyPendingUpdateNow("user-click");
    expect(f.waiting.postMessage).not.toHaveBeenCalled();
    expect(controls.reload).not.toHaveBeenCalled();
  });

  it("keeps the current controller after a consent timeout", async () => {
    const f = await fixture();
    await f.module.applyPendingUpdateNow("user-click");
    expect(f.waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    await vi.advanceTimersByTimeAsync(16_000);
    f.events.get("message")?.({ data: { type: "CONSUBOV_SW_ACTIVATED", version: REMOTE_BUILD } });
    expect(controls.reload).not.toHaveBeenCalled();
  });

  it("never activates a worker while a field operation is critical", async () => {
    const f = await fixture();
    controls.busy = true;
    await f.module.applyPendingUpdateNow("user-click");
    expect(f.waiting.postMessage).not.toHaveBeenCalled();
    expect(controls.drain).toHaveBeenCalledOnce();
    expect(controls.reload).not.toHaveBeenCalled();
  });

  it("needs explicit consent and a changed controller before scheduling reload", async () => {
    const f = await fixture();
    await f.module.applyPendingUpdateNow("user-click");
    f.events.get("controllerchange")?.();
    expect(controls.reload).not.toHaveBeenCalled();
    f.sw.controller = { scriptURL: window.location.origin + "/sw.js?v=" + REMOTE_BUILD };
    f.events.get("controllerchange")?.();
    expect(controls.reload).toHaveBeenCalledOnce();
    f.events.get("controllerchange")?.();
    expect(controls.reload).toHaveBeenCalledOnce();
  });
});
