import { test, expect } from "@playwright/test";

// Must run with: bunx playwright test --config playwright.browser-login.config.ts
// This uses VITE_SURFACE_MODE=app and does not touch production accounts.
test.describe("CONSUBOV browser login (APP surface)", () => {
  test("opens /login in a normal browser tab without an installation redirect", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    await expect(page).toHaveURL(/\/login(?:[?#]|$)/);
    await expect(page.locator("body")).not.toContainText("Acesso exclusivo pelo ícone");
    await expect(page.locator("body")).not.toContainText("Já concluí a instalação — Ir para Login");
  });

  test("keeps /login after refresh instead of sending the user to /baixar", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await page.reload();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page).toHaveURL(/\/login(?:[?#]|$)/);
    await expect(page).not.toHaveURL(/\/baixar(?:[?#]|$)/);
  });
});
