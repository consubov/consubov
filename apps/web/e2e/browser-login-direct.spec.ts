import { test, expect } from "@playwright/test";

// P0: abrir app.consubov.com.br/login sem instalar a PWA.
// Usar APP E2E de preview como baseURL, jamais a origem do site institucional.
test.describe("CONSUBOV browser login", () => {
  test("opens the login route in a regular browser tab without redirecting to installer", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login(?:[?#]|$)/);
    await expect(page.locator("body")).not.toContainText("Acesso exclusivo pelo ícone");
    await expect(page.locator("body")).not.toContainText("Já concluí a instalação — Ir para Login");
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("never sends unauthenticated browser login to /baixar", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");
    await expect(page).not.toHaveURL(/\/baixar(?:[?#]|$)/);
  });
});
