import { expect, test } from "@playwright/test";

test.describe("@smoke FASE 4 — auth público e proteção de navegação", () => {
  test("login expõe campos e recuperação de senha", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Consubov" })).toBeVisible();
    await expect(page.getByLabel("E-mail", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Esqueci minha senha" })).toHaveAttribute("href", "/recuperar-senha");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  });

  test("recuperação de senha é navegável sem sessão", async ({ page }) => {
    await page.goto("/recuperar-senha");
    await expect(page.getByRole("heading", { name: "Recuperar senha" })).toBeVisible();
    await expect(page.getByLabel("E-mail", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar instruções" })).toBeVisible();
  });

  test("rota de redefinição existe para o callback do provider", async ({ page }) => {
    await page.goto("/redefinir-senha");
    await expect(page.getByRole("heading", { name: "Redefinir senha" })).toBeVisible();
    await expect(page.getByLabel("Nova senha", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirmar nova senha", { exact: true })).toBeVisible();
  });

  test("nega rota protegida sem sessão e redireciona para login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Consubov" })).toBeVisible();
  });

  test("rota inexistente continua recuperável", async ({ page }) => {
    await page.goto("/fase4-rota-inexistente");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  });

  test("landing pública mantém entrada para autenticação", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
  });
});

test.describe("@a11y-smoke FASE 4 — teclado e responsividade pública", () => {
  test("login mantém ordem básica de foco e sem overflow horizontal", async ({ page }) => {
    await page.goto("/login");
    const email = page.getByLabel("E-mail", { exact: true });
    const password = page.getByLabel("Senha", { exact: true });
    const rememberEmail = page.getByRole("checkbox", { name: "Lembrar meu e-mail" });
    const forgot = page.getByRole("link", { name: "Esqueci minha senha" });
    await email.focus();
    await expect(email).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(password).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(rememberEmail).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(forgot).toBeFocused();
    const hasHorizontalOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
});
