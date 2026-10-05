import { expect, test, type Browser, type Page } from "@playwright/test";

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

type RoleTable = (typeof ROLE_TABLES)[number];

const ROLE_CASES: Array<{ table: RoleTable; home: string }> = [
  { table: "administradores", home: "/admin" },
  { table: "gerentes", home: "/gerente" },
  { table: "capatazes", home: "/capataz" },
  { table: "escritorios", home: "/escritorio" },
  { table: "operadores_fabrica", home: "/fabrica" },
  { table: "consultores", home: "/consultor" },
  { table: "pesadores", home: "/pesador" },
  { table: "pecuaristas", home: "/pecuarista" },
  { table: "syncvet_equipe", home: "/syncvet" },
];

function roleRow(table: RoleTable) {
  if (table === "syncvet_equipe") {
    return { id: "role-1", empresa_id: "empresa-1", perfil: "administrador", ativo: true };
  }
  if (table === "operadores_fabrica") {
    return { id: "role-1", fabrica_id: "fabrica-1", ativo: true };
  }
  if (table === "capatazes") {
    return { id: "role-1", retiro_id: "retiro-1", ativo: true };
  }
  if (table === "gerentes" || table === "escritorios") {
    return { id: "role-1", fazenda_id: "fazenda-1", ativo: true };
  }
  if (table === "consultores") {
    return { id: "role-1", modulo_despesas_ativo: false, is_demo: false, ativo: true };
  }
  return { id: "role-1", ativo: true };
}

async function mockAuthenticatedRole(page: Page, roleTable: RoleTable) {
  const userId = "11111111-1111-4111-8111-111111111111";
  const now = new Date().toISOString();

  await page.route("**/auth/v1/token?grant_type=password", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "phase5-access-token",
        refresh_token: "phase5-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {
          id: userId,
          aud: "authenticated",
          role: "authenticated",
          email: "fase5@example.com",
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

  await page.route("**/auth/v1/logout**", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").pop() ?? "";
    const isRoleProbe =
      ROLE_TABLES.includes(table as RoleTable) &&
      url.searchParams.get("user_id") === `eq.${userId}`;

    if (isRoleProbe && table === roleTable) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(roleRow(roleTable)),
      });
      return;
    }

    if (isRoleProbe) {
      await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
      headers: { "content-range": "0-0/0" },
    });
  });

  await page.route("**/functions/v1/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.route("**/storage/v1/**", async (route) => {
    await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill("fase5@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("senha-local");
  await page.getByRole("button", { name: "Entrar" }).click();
}

async function openAs(browser: Browser, table: RoleTable, path?: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await mockAuthenticatedRole(page, table);
  await login(page);
  if (path) await page.goto(path);
  return { context, page };
}

async function expectHealthySurface(page: Page) {
  await expect(page.locator("body")).toBeVisible();
  await expect(page.getByRole("heading", { name: "404" })).toHaveCount(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);
}

test.describe("@web-ready FASE 5 — autenticação, perfis e superfícies críticas", () => {
  test("todos os nove perfis conhecidos possuem redirect autenticado reproduzível", async ({ browser }) => {
    for (const roleCase of ROLE_CASES) {
      const { context, page } = await openAs(browser, roleCase.table);
      await expect(page).toHaveURL(new RegExp(`${roleCase.home.replace("/", "\\/")}(?:\\/|$)`));
      await expectHealthySurface(page);
      await context.close();
    }
  });

  test("gerente não acessa a área administrativa", async ({ page }) => {
    await mockAuthenticatedRole(page, "gerentes");
    await login(page);
    await page.goto("/admin");
    await expect(page.getByText("Acesso não autorizado")).toBeVisible();
  });

  test("logout explícito limpa a sessão visual e retorna à área pública", async ({ page }) => {
    await mockAuthenticatedRole(page, "administradores");
    await login(page);
    await expect(page).toHaveURL(/\/admin(?:\/|$)/);

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();
  });

  test("admin abre estrutura, QR, nutrição, lançamento e relatórios sem 404/overflow", async ({ page }) => {
    await mockAuthenticatedRole(page, "administradores");
    await login(page);

    for (const path of [
      "/admin/fazendas",
      "/admin/qrcodes",
      "/admin/produtos",
      "/admin/lancamento-manual",
      "/admin/inteligencia",
    ]) {
      await page.goto(path);
      await expectHealthySurface(page);
    }
  });

  test("superfícies de transferência, fábrica, visita e pesagem abrem no papel correto", async ({ browser }) => {
    const cases: Array<{ table: RoleTable; path: string }> = [
      { table: "capatazes", path: "/capataz/transferencia-retiro" },
      { table: "operadores_fabrica", path: "/fabrica" },
      { table: "consultores", path: "/consultor" },
      { table: "pesadores", path: "/pesador/pesagem" },
      { table: "pecuaristas", path: "/pecuarista" },
    ];

    for (const item of cases) {
      const { context, page } = await openAs(browser, item.table, item.path);
      await expectHealthySurface(page);
      await context.close();
    }
  });
});

test.describe("@a11y-smoke @web-ready FASE 5 — acessibilidade e responsividade", () => {
  test("login, recuperação e landing possuem nomes acessíveis e navegação por teclado", async ({ page }) => {
    await page.goto("/login");
    const email = page.getByLabel("E-mail", { exact: true });
    const password = page.getByLabel("Senha", { exact: true });
    const rememberEmail = page.getByRole("checkbox", { name: "Lembrar meu e-mail" });
    const forgot = page.getByRole("link", { name: "Esqueci minha senha" });
    const submit = page.getByRole("button", { name: "Entrar" });

    await expect(email).toHaveAttribute("type", "email");
    await expect(password).toHaveAttribute("type", "password");

    await email.focus();
    await expect(email).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(password).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(rememberEmail).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(forgot).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(submit).toBeFocused();
    await expectHealthySurface(page);

    await page.goto("/recuperar-senha");
    await expect(page.getByLabel("E-mail", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar instruções" })).toBeVisible();
    await expectHealthySurface(page);

    await page.goto("/");
    const loginLink = page.getByRole("link", { name: "Entrar" });
    await loginLink.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("rotas autenticadas prioritárias não criam overflow horizontal em desktop/mobile", async ({ browser }) => {
    const { context, page } = await openAs(browser, "administradores");
    for (const path of ["/admin", "/admin/fazendas", "/admin/produtos", "/admin/qrcodes"]) {
      await page.goto(path);
      await expectHealthySurface(page);
    }
    await context.close();
  });
});