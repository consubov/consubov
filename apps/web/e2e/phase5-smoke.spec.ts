import { expect, test } from "@playwright/test";

test.describe("@smoke FASE 5 — superfícies públicas e proteção de rota", () => {
  test("renderiza a tela de login sem credencial real", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Consubov" })).toBeVisible();
    await expect(page.getByLabel("E-mail", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasHorizontalOverflow).toBe(false);
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

    const hasHorizontalOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
});

test.describe("@a11y-smoke FASE 5 — acessibilidade básica pública", () => {
  test("login preserva nomes acessíveis, tipos de campo e navegação por teclado", async ({ page }) => {
    await page.goto("/login");

    const email = page.getByLabel("E-mail", { exact: true });
    const password = page.getByLabel("Senha", { exact: true });
    const submit = page.getByRole("button", { name: "Entrar" });

    await expect(email).toHaveAttribute("type", "email");
    await expect(password).toHaveAttribute("type", "password");

    await email.focus();
    await expect(email).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(password).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(submit).toBeFocused();
  });

  test("landing permite ativar o acesso ao login somente por teclado", async ({ page }) => {
    await page.goto("/");
    const loginLink = page.getByRole("link", { name: "Entrar" });
    await loginLink.focus();
    await expect(loginLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/login$/);
  });
});
