import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Contrato estatico de UX para bloquear regressao de CTAs de login no instalador.
// Nao substitui testes E2E de instalacao nem teste do popup nativo do navegador.
const installerSource = readFileSync(
  new URL("../pages/BaixarAppPage.tsx", import.meta.url),
  "utf8",
);
const landingSource = readFileSync(
  new URL("../pages/LandingPage.tsx", import.meta.url),
  "utf8",
);

describe("installer: access remains URL-only and install is not faked", () => {
  it("does not show an extra login action or declare manual installation completed", () => {
    expect(installerSource).not.toContain("handleConfirmManualInstall");
    expect(installerSource).not.toContain("Ja conclui a instalacao");
    expect(installerSource).not.toContain("Já concluí a instalação — Ir para Login");
    expect(installerSource).not.toContain("Installation complete — Go to Login");
  });

  it("does not claim exclusive access through the installed icon", () => {
    expect(installerSource).not.toContain("Acesso exclusivo pelo ícone");
    expect(installerSource).not.toContain("Use the App icon to sign in:");
    expect(installerSource).toContain("O sistema permite acesso autenticado pelo navegador");
  });

  it("keeps the existing installation CTA and the offline field instructions", () => {
    expect(installerSource).toContain("Baixar e Instalar App");
    expect(installerSource).toContain("100% Offline no campo");
  });
  it("sends the site CONSUBOV install button to the official App origin", () => {
    expect(installerSource).toContain('const CONSUBOV_APP_INSTALL_URL = "https://app.consubov.com.br/baixar"');
    expect(installerSource).toContain("window.location.assign(CONSUBOV_APP_INSTALL_URL)");
    expect(installerSource).not.toContain("requestConsubovCrossOriginInstall(");
    expect(installerSource).not.toContain("siteInstallIssue");
    expect(installerSource).not.toContain("cross-origin-install-fallback");
    expect(installerSource).not.toContain("Este navegador não oferece o popup de instalação entre domínios.");
  });

  it("preserves the separate Relatto install flow", () => {
    expect(installerSource).toContain("const siteCrossOriginInstall = isSiteBuild && !isRelatto");
    expect(installerSource).toContain("${externalAppOrigin}/baixar?app=relatto");
  });

  it("uses official app installer directly from the site homepage", () => {
    expect(landingSource).toContain('const CONSUBOV_INSTALL_HREF = "https://app.consubov.com.br/baixar";');
    expect(landingSource).toContain('href={import.meta.env.VITE_SURFACE_MODE === "site" ? CONSUBOV_INSTALL_HREF : "/baixar"}');
    expect(landingSource).not.toContain('to="/baixar"');
  });

});
