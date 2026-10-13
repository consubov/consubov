import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { DeferredBrasilMap } from "@/components/landing/DeferredBrasilMap";
vi.mock("@/components/landing/BrasilMap", () => ({ default: () => <svg aria-label="Mapa carregado" /> }));
afterEach(() => vi.unstubAllGlobals());
describe("deferred below-fold map", () => {
  it("waits for proximity, then mounts and disconnects", async () => {
    let notify!: IntersectionObserverCallback;
    const disconnect = vi.fn(); const observe = vi.fn();
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) { notify = callback; }
      observe = observe; disconnect = disconnect;
    });
    const view = render(<DeferredBrasilMap />);
    expect(screen.queryByLabelText("Mapa carregado")).toBeNull();
    expect(observe).toHaveBeenCalledOnce();
    await act(async () => notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(await screen.findByLabelText("Mapa carregado")).toBeVisible();
    expect(disconnect).toHaveBeenCalled(); view.unmount();
    expect(disconnect).toHaveBeenCalledTimes(2);
  });
  it("works without IntersectionObserver", async () => {
    vi.stubGlobal("IntersectionObserver", undefined); render(<DeferredBrasilMap />);
    expect(await screen.findByLabelText("Mapa carregado")).toBeVisible();
  });
});


it("exposes a named region before the deferred map arrives", () => {
  vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    disconnect() {}
  });
  render(<DeferredBrasilMap />);
  expect(screen.getByRole("region", { name: "Mapa da rede nacional" })).toBeVisible();
  expect(screen.queryByLabelText("Mapa carregado")).toBeNull();
});
