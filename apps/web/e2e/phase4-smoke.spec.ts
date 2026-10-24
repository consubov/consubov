import { expect, test, type BrowserContext } from "@playwright/test";

function isLoopback(hostname: string): boolean {
  return ["127.0.0.1", "localhost", "[::1]"].includes(hostname);
}

async function isolateLocalNetwork(context: BrowserContext) {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL || !isLoopback(new URL(baseURL).hostname)) {
    throw new Error("Phase 5 smoke tests require a loopback baseURL, never a customer environment");
  }
  // Specific page mocks take precedence over this final network boundary.
  await context.route("**/*", route => isLoopback(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort("blockedbyclient"));
  await context.routeWebSocket(/.*/, socket => {
    if (isLoopback(new URL(socket.url()).hostname)) socket.connectToServer();
    else socket.close();
  });
}

test.beforeEach(async ({ context }) => { await isolateLocalNetwork(context); });

const ROLE_TABLES = [
  "syncvet_equipe",
  "consultores",
  "pesadores",
  "pecuaristas",
  "operadores_fabrica",
  "capatazes",
  "gerentes",
  "escritorios",
  "administradores",
] as const;

async function mockAuthenticatedRole(
  page: import("@playwright/test").Page,
  roleTable: (typeof ROLE_TABLES)[number],
) {
  const userId = "11111111-1111-4111-8111-111111111111";
  const now = new Date().toISOString();

  await page.route("**/auth/v1/token?grant_type=password", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "phase4-access-token",
        refresh_token: "phase4-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {
          id: userId,
          aud: "authenticated",
          role: "authenticated",
          email: "fase4@example.com",
          email_confirmed_at: now,
          confirmed_at: now,
          last_sign_in_at: now,
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: {},
          identities: [],
          created_at: now,
          updated_at: now,
        },
      }),
    });
  });

  await page.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").pop() ?? "";
    const isRoleProbe =
      ROLE_TABLES.includes(table as (typeof ROLE_TABLES)[number]) &&
      url.searchParams.get("user_id") === `eq.${userId}`;

    if (isRoleProbe && table === roleTable) {
      const body =
        table === "gerentes"
          ? { id: "role-1", fazenda_id: "fazenda-1" }
          : { id: "role-1" };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      return;
    }

    if (isRoleProbe) {
      await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

test.describe("@smoke FASE 4 — auth público e proteção de navegação", () => {
  test("login expõe campos e recuperação de senha", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Consubov" })).toBeVisible();
    await expect(page.getByLabel("E-mail", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Esqueci minha senha" })).toHaveAttribute("href", "/recuperar-senha");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  });


  test("login de administrador resolve o redirect do perfil", async ({ page }) => {
    await mockAuthenticatedRole(page, "administradores");
    await page.goto("/login");
    await page.getByLabel("E-mail", { exact: true }).fill("fase4@example.com");
    await page.getByLabel("Senha", { exact: true }).fill("senha-local");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/admin(?:\/|$)/);
  });

  test("Consubov: reabrir o App mantém a última tela autorizada do administrador", async ({ page }) => {
    await mockAuthenticatedRole(page, "administradores");
    await page.goto("/login?standalone=1");
    await page.getByLabel("E-mail", { exact: true }).fill("fase4@example.com");
    await page.getByLabel("Senha", { exact: true }).fill("senha-local");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/admin(?:\/|$)/);

    await page.goto("/admin/inteligencia");
    await expect(page).toHaveURL(/\/admin\/inteligencia$/);
    await expect.poll(() => page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("consubov:resume-route:v2") || "null")?.path
    )).toBe("/admin/inteligencia");

    await page.goto("/app?standalone=1");
    await expect(page).toHaveURL(/\/admin\/inteligencia$/);
  });

  test("login de gerente resolve o redirect do perfil", async ({ page }) => {
    await mockAuthenticatedRole(page, "gerentes");
    await page.goto("/login");
    await page.getByLabel("E-mail", { exact: true }).fill("fase4@example.com");
    await page.getByLabel("Senha", { exact: true }).fill("senha-local");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/gerente(?:\/|$)/);
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

  test("landing pública direciona para baixar o App sem mencionar PWA", async ({ page }) => {
    await page.goto("/");
    const downloadLink = page.getByRole("link", { name: "Baixar App" });
    await expect(downloadLink).toHaveAttribute("href", "/baixar");
    await downloadLink.click();
    await expect(page).toHaveURL(/\/baixar$/);
    await expect(page.getByRole("heading", { name: "Baixar App Consubov" })).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/\bPWA\b/i);
  });

  test("subdomínio do App bloqueia uso na aba do navegador e exige abertura pelo ícone instalado", async ({ page }) => {
    await page.goto("/login?surface=app");
    await expect(page).toHaveURL(/\/baixar$/);
    await expect(page.getByRole("heading", { name: "Baixar App Consubov" })).toBeVisible();
  });

  test("abertura pelo ícone instalado no dispositivo (standalone) leva direto ao sistema sem Landing Page", async ({ page }) => {
    await page.goto("/?standalone=1");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Consubov" })).toBeVisible();
  });

  test("identifica quando o App já foi instalado e bloqueia segunda instalação", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("consubov:app-installed:consubov", "1");
    });
    await page.goto("/baixar");
    await expect(page.getByTestId("app-already-installed-banner")).toContainText("App Consubov já está instalado neste dispositivo");
    await expect(page.getByRole("button", { name: /Baixar e Instalar App/i })).toHaveCount(0);
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
