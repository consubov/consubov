import { expect, test } from "@playwright/test";

test.describe("@smoke FASE 5 — superfícies públicas e proteção de rota", () => {
  test("renderiza a tela de login sem credencial real", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Consubov" })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  });

  test("nega rota protegida sem sessão e redireciona para login", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Consubov" })).toBeVisible();
  });

  test("rota inexistente expõe 404 recuperável", async ({ page }) => {
    await page.goto("/qualidade-fase5-rota-inexistente");

    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Return to Home" })).toHaveAttribute("href", "/");
  });

  test("landing pública expõe navegação para login", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("CONSUBOV", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
  });
});
