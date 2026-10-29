import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { BackToTopButton, scrollToSiteTop } from "./BackToTopButton";

const originalScrollY = Object.getOwnPropertyDescriptor(window, "scrollY");

describe("BackToTopButton", () => {
  beforeEach(() => {
    Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: 0 });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      window.setTimeout(() => callback(performance.now()), 0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    if (originalScrollY) Object.defineProperty(window, "scrollY", originalScrollY);
  });

  it("appears only after scrolling and returns to the top", async () => {
    render(<BackToTopButton language="pt-BR" />);
    expect(screen.queryByRole("button", { name: "Voltar ao topo" })).toBeNull();

    Object.defineProperty(window, "scrollY", { configurable: true, value: 470 });
    fireEvent.scroll(window);
    const button = await screen.findByRole("button", { name: "Voltar ao topo" });
    fireEvent.click(button);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });

    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    fireEvent.scroll(window);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Voltar ao topo" })).toBeNull());
  });

  it("respects reduced motion and renders the light Relatto variant", async () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    render(<BackToTopButton language="en-US" mode="light" />);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 600 });
    fireEvent.scroll(window);
    const button = await screen.findByRole("button", { name: "Back to top" });
    expect(button.className).toContain("bg-white");
    fireEvent.click(button);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
    vi.unstubAllGlobals();
  });

  it("uses the same reduced-motion logic when the brand logo is clicked", () => {
    scrollToSiteTop();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});
