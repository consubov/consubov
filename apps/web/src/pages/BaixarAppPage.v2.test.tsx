import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import BaixarAppPage from "./BaixarAppPage";

const mockSurface = vi.hoisted(() => ({
  standalone: vi.fn(() => false),
  installed: vi.fn(() => true),
  detectInstalled: vi.fn(async () => true),
  mode: vi.fn(() => "app"),
}));

vi.mock("@/lib/appSurface", () => ({
  activateStandaloneSession: vi.fn(),
  clearAppInstalledMark: vi.fn(),
  detectInstalledAppAsync: mockSurface.detectInstalled,
  getInstalledStorageKey: vi.fn(() => "consubov:installed"),
  getSurfaceMode: mockSurface.mode,
  isAppInstalledOnDevice: mockSurface.installed,
  isConsubovV2DownloadRoute: vi.fn((pathname: string, search: string, mode: string) =>
    mode === "app" && pathname === "/baixar" && !search.includes("app=relatto")),
  isStandaloneApp: mockSurface.standalone,
  markAppInstalled: vi.fn(),
}));
vi.mock("@/lib/pwaManifest", () => ({ applyPwaProfile: vi.fn() }));

function mount(entry = "/baixar") {
  // The component intentionally reads the real browser URL, not only Router state.
  window.history.replaceState({}, "", entry);
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/baixar" element={<BaixarAppPage />} />
        <Route path="/login" element={<p>LOGIN_SCREEN</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSurface.mode.mockReturnValue("app");
  mockSurface.standalone.mockReturnValue(false);
  mockSurface.installed.mockReturnValue(true);
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => cleanup());

describe("CONSUBOV 2.0 installation page", () => {
  it("shows the v2 button with an old installed marker", () => {
    mount();
    expect(screen.getByRole("button", { name: /Baixar e Instalar App Consubov 2\.0/i })).toBeTruthy();
    expect(screen.queryByTestId("app-already-installed-banner")).toBeNull();
  });

  it("does not jump to login when the browser reports standalone", () => {
    mockSurface.standalone.mockReturnValue(true);
    mount();
    expect(screen.getByRole("button", { name: /Baixar e Instalar App Consubov 2\.0/i })).toBeTruthy();
    expect(screen.queryByText("LOGIN_SCREEN")).toBeNull();
  });

  it("opens the browser prompt even with the prior installation marker", async () => {
    const prompt = vi.fn(async () => undefined);
    mount();
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt,
      userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
    });
    fireEvent(window, event);
    fireEvent.click(screen.getByRole("button", { name: /Baixar e Instalar App Consubov 2\.0/i }));
    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
  });

  it("provides installation guidance when the native prompt is unavailable", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Baixar e Instalar App Consubov 2\.0/i }));
    expect(await screen.findByText(/Confirme a instalação no seu navegador/i)).toBeTruthy();
  });

  it("keeps the installer visible after the real appinstalled event", async () => {
    mount();
    fireEvent(window, new Event("appinstalled"));
    expect(await screen.findByText(/Abra o novo ícone/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Baixar e Instalar App Consubov 2\\.0/i })).toBeTruthy();
    expect(screen.queryByText("LOGIN_SCREEN")).toBeNull();
  });

  it("does not mark manual instructions as proof of installation or jump to login", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Baixar e Instalar App Consubov 2\\.0/i }));
    const manualButton = await screen.findByRole("button", { name: /Já adicionei à Tela de Início/i });
    fireEvent.click(manualButton);
    expect(await screen.findByText(/Abra o novo ícone/i)).toBeTruthy();
    expect(screen.queryByText("LOGIN_SCREEN")).toBeNull();
  });

  it("preserves the existing installed-app banner for Relatto", () => {
    mount("/baixar?app=relatto");
    expect(screen.getByTestId("app-already-installed-banner")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Baixar e Instalar App Relatto/i })).toBeNull();
  });
});
