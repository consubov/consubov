import { afterEach, describe, expect, it, vi } from "vitest";
import { RequestCancelledError, RequestTimeoutError, runWithDeadline } from "./requestDeadline";

afterEach(() => vi.useRealTimers());

describe("runWithDeadline", () => {
  it("returns a completed request and clears its timer", async () => {
    vi.useFakeTimers();
    const result = await runWithDeadline(async () => ({ items: ["fazenda"] }), { timeoutMs: 12000 });
    expect(result.items).toEqual(["fazenda"]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects stalled requests in bounded time and aborts the fetch", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const operation = runWithDeadline((s) => {
      signal = s;
      return new Promise<never>(() => undefined);
    }, { timeoutMs: 12000 });
    const assertion = expect(operation).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(12000);
    await assertion;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels a pending request when a retry or unmount aborts it", async () => {
    const controller = new AbortController();
    let signal: AbortSignal | undefined;
    const operation = runWithDeadline((s) => {
      signal = s;
      return new Promise<never>(() => undefined);
    }, { signal: controller.signal, timeoutMs: 12000 });
    await Promise.resolve();
    controller.abort();
    await expect(operation).rejects.toBeInstanceOf(RequestCancelledError);
    expect(signal?.aborted).toBe(true);
  });

  it("does not start a request whose parent was already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const request = vi.fn(async () => "nope");
    await expect(runWithDeadline(request, { signal: controller.signal, timeoutMs: 12000 }))
      .rejects.toBeInstanceOf(RequestCancelledError);
    expect(request).not.toHaveBeenCalled();
  });

  it("passes through server failures without hiding them", async () => {
    const failure = new Error("permission-denied");
    await expect(runWithDeadline(async () => { throw failure; }, { timeoutMs: 12000 }))
      .rejects.toBe(failure);
  });
});
