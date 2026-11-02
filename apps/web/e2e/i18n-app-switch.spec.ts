import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const ROLE_TABLES = [
  "syncvet_equipe", "consultores", "pesadores", "pecuaristas",
  "operadores_fabrica", "capatazes", "gerentes", "escritorios", "administradores",
];

test.beforeEach(async ({ context }) => {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1") throw new Error("E2E must run against local fixtures only");
  await context.route("**/*", route =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort("blockedbyclient"));
  await context.routeWebSocket(/.*/, socket => {
    if (new URL(socket.url()).hostname === "127.0.0.1") socket.connectToServer();
    else socket.close();
  });
});

async function mockAdmin(page: Page) {
  const id = "11111111-1111-4111-8111-111111111111";
  const now = new Date().toISOString();
  await page.route("**/auth/v1/token?grant_type=password", async route => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        access_token: "i18n-local-token", refresh_token: "i18n-local-refresh",
        token_type: "bearer", expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {
          id, aud: "authenticated", role: "authenticated", email: "i18n@example.test",
          email_confirmed_at: now, confirmed_at: now, last_sign_in_at: now,
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: {}, identities: [], created_at: now, updated_at: now,
        },
      }),
    });
  });
  await page.route("**/rest/v1/**", async route => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").pop() ?? "";
    const roleProbe = ROLE_TABLES.includes(table) && url.searchParams.get("user_id") === "eq." + id;
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: roleProbe && table === "administradores" ? JSON.stringify({ id: "role-1" }) : (roleProbe ? "null" : "[]"),
    });
  });
}

test("language switch stays at screen top on mobile and translates login without changing Site", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  const lang = page.getByRole("combobox", { name: "Idioma / Language" });
  await expect(lang).toBeVisible();
  const rect = await lang.boundingBox();
  expect(rect?.y).toBeLessThan(65);
  expect((rect?.x ?? 500) + (rect?.width ?? 0)).toBeLessThanOrEqual(390);
  await page.evaluate(() => localStorage.setItem("consubov:site-language", "pt-BR"));
  await lang.selectOption("en-US");
  await expect(page.getByText("Livestock Management System")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  expect(await page.evaluate(() => localStorage.getItem("consubov:site-language"))).toBe("pt-BR");
  await page.reload();
  await expect(lang).toHaveValue("en-US");
  await expect(page.getByText("Livestock Management System")).toBeVisible();
  await lang.selectOption("pt-BR");
  await expect(page.getByText("Sistema de Gestão Pecuária")).toBeVisible();
});

test("switching to English updates the real authenticated admin UI", async ({ page }) => {
  await mockAdmin(page);
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill("i18n@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("local-password");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin(?:\/|$)/);
  await expect(page.getByText("Visualizar como:")).toBeVisible();

  const lang = page.getByRole("combobox", { name: "Idioma / Language" });
  await lang.selectOption("en-US");
  await expect(page.getByText("View as:")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("Administrator", { exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");

  await page.locator('[data-sidebar="trigger"]').click();
  await expect(page.getByRole("navigation", { name: "Administration navigation" })
    .getByText("Ranches", { exact: true })).toBeVisible();

  // On mobile, the off-canvas sidebar is a modal dialog. Close it before
  // interacting with controls outside the dialog (focus/ARIA isolation).
  const mobileDrawer = await page.getByRole("dialog").count() > 0;
  if (mobileDrawer) {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await lang.selectOption("pt-BR");
  await expect(page.getByText("Visualizar como:")).toBeVisible();
  if (mobileDrawer) await page.locator('[data-sidebar="trigger"]').click();
  await expect(page.getByRole("navigation", { name: "Navegação administrativa" })
    .getByText("Fazendas", { exact: true })).toBeVisible();
});
