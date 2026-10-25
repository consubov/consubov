import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BaixarAppPage from "../pages/BaixarAppPage";
import * as appSurface from "@/lib/appSurface";

describe("BaixarAppPage V2 installation requirements", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("always offers V2 installation button on app subdomain even if marked installed", () => {
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      hostname: "app.consubov.com.br",
      pathname: "/baixar",
      search: "",
    } as Location);

    vi.spyOn(appSurface, "isAppInstalledOnDevice").mockReturnValue(true);
    vi.spyOn(appSurface, "getSurfaceMode").mockReturnValue("app");

    render(
      <MemoryRouter initialEntries={["/baixar"]}>
        <BaixarAppPage />
      </MemoryRouter>,
    );

    // O botão principal da v2.0 deve estar visível mesmo com app marcado como instalado
    const installButton = screen.getByRole("button", {
      name: /Baixar e Instalar App Consubov 2\.0/i,
    });
    expect(installButton).toBeDefined();

    // O aviso complementar informando que o app 2.0 é novo deve estar presente
    expect(
      screen.getByText(/O CONSUBOV 2\.0 é um novo aplicativo/i),
    ).toBeDefined();
  });

  it("preserves Relatto install behavior without V2 override", () => {
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      hostname: "app.consubov.com.br",
      pathname: "/baixar",
      search: "?app=relatto",
    } as Location);

    vi.spyOn(appSurface, "isAppInstalledOnDevice").mockReturnValue(false);
    vi.spyOn(appSurface, "getSurfaceMode").mockReturnValue("app");

    render(
      <MemoryRouter initialEntries={["/baixar?app=relatto"]}>
        <BaixarAppPage />
      </MemoryRouter>,
    );

    const relattoButton = screen.getByRole("button", {
      name: /Baixar e Instalar App Relatto/i,
    });
    expect(relattoButton).toBeDefined();
  });
});
