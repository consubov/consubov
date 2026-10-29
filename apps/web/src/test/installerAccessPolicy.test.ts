import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Contrato estatico de UX para bloquear regressao de CTAs de login no instalador.
// Nao substitui testes E2E de instalacao nem teste do popup nativo do navegador.
const installerSource = readFileSync(
  new URL("../pages/BaixarAppPage.tsx", import.meta.url),
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
});
