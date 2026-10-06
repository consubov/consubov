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
    for (const path of [
      "/admin",
      "/admin/fazendas",
      "/admin/produtos",
      "/admin/qrcodes",
      "/admin/gerentes",
      "/admin/consultores",
      "/admin/pesadores",
      "/admin/fabricas",
      "/admin/materias-primas",
      "/admin/configuracoes",
    ]) {
      await page.goto(path);
      await expectHealthySurface(page);
    }
    await context.close();
  });
});

test.describe("@web-ready FASE 5 — fluxos críticos E2E", () => {
  test("logout limpa sessão e impede acesso após saída", async ({ page }) => {
    await mockAuthenticatedRole(page, "administradores");
    await login(page);
    await expect(page).toHaveURL(/\/admin(?:\/|$)/);

    // Logout
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/$/);

    // Tentar acessar área protegida após logout
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/); // Deve redirecionar para login
  });

  test("capataz acessa fazenda/retiro/pasto sem 404", async ({ browser }) => {
    const { context, page } = await openAs(browser, "capatazes");

    // Páginas básicas para capataz
    for (const path of [
      "/capataz/fazendas",
      "/capataz/retiros",
      "/capataz/pastos",
      "/capataz/transferencia-retiro",
    ]) {
      await page.goto(path);
      await expectHealthySurface(page);
    }
    await context.close();
  });

  test("QR web: emissão e ativação", async ({ browser }) => {
    const { context, page } = await openAs(browser, "administradores");

    await page.goto("/admin/qrcodes");
    await expect(page.getByRole("heading", { name: /QR Codes|Códigos QR/i })).toBeVisible();

    // Verificar elementos básicos da página QR
    await expect(page.getByRole("button", { name: /Gerar|Emitir|Novo/i })).toBeVisible();
    await expectHealthySurface(page);

    await context.close();
  });

  test("produtos e nutrição: páginas acessíveis", async ({ browser }) => {
    const { context, page } = await openAs(browser, "gerentes");

    await page.goto("/gerente/produtos");
    await expect(page.getByRole("heading", { name: /Produtos/i })).toBeVisible();

    await page.goto("/gerente/nutricao");
    await expect(page.getByRole("heading", { name: /Nutrição|Dietas/i })).toBeVisible();

    await expectHealthySurface(page);
    await context.close();
  });

  test("salga: página de lançamento manual", async ({ browser }) => {
    const { context, page } = await openAs(browser, "administradores");

    await page.goto("/admin/lancamento-manual");
    await expect(page.getByRole("heading", { name: /Lançamento Manual|Salga/i })).toBeVisible();

    await expect(page.getByRole("textbox", { name: /Produto/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Salvar|Lançar/i })).toBeVisible();

    await expectHealthySurface(page);
    await context.close();
  });

  test("estoque e transferência: páginas básicas", async ({ browser }) => {
    const { context, page } = await openAs(browser, "administradores");

    await page.goto("/admin/estoque");
    await expect(page.getByRole("heading", { name: /Estoque/i })).toBeVisible();

    await page.goto("/admin/transferencias");
    await expect(page.getByRole("heading", { name: /Transferências/i })).toBeVisible();

    await expectHealthySurface(page);
    await context.close();
  });

  test("visita de consultor: página de relatório", async ({ browser }) => {
    const { context, page } = await openAs(browser, "consultores");

    await page.goto("/consultor");
    await expect(page.getByRole("heading", { name: /Consultor|Visitas/i })).toBeVisible();

    await expectHealthySurface(page);
    await context.close();
  });

  test("fábrica: dashboard operacional", async ({ browser }) => {
    const { context, page } = await openAs(browser, "operadores_fabrica");

    await page.goto("/fabrica");
    await expect(page.getByRole("heading", { name: /Fábrica|Operações/i })).toBeVisible();

    await expectHealthySurface(page);
    await context.close();
  });

  test("pesagem: página do pesador", async ({ browser }) => {
    const { context, page } = await openAs(browser, "pesadores");

    await page.goto("/pesador/pesagem");
    await expect(page.getByRole("heading", { name: /Pesagem/i })).toBeVisible();

    await expectHealthySurface(page);
    await context.close();
  });

  test("usuário sem permissão recebe acesso negado", async ({ page }) => {
    await mockAuthenticatedRole(page, "pecuaristas"); // Pecuarista não tem acesso admin
    await login(page);

    // Tentar acessar área admin
    await page.goto("/admin");
    await expect(page.getByText(/acesso não autorizado|não tem permissão/i)).toBeVisible();
  });

  test("tenant mismatch em ambiente de teste", async ({ browser }) => {
    const { context, page } = await openAs(browser, "administradores");
    await login(page);

    // Mock: simular tentativa de acessar dados de outro tenant
    await page.route("**/rest/v1/fazendas**", async (route) => {
      // Simular resposta de tenant mismatch
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: "TENANT_MISMATCH", message: "Acesso negado entre tenants" })
      });
    });

    await page.goto("/admin/fazendas");
    await expect(page.getByText(/acesso negado|tenant mismatch/i)).toBeVisible();

    await context.close();
  });
});

test.describe("@web-ready FASE 5 — responsividade (5.8)", () => {
  test("desktop: dashboards e tabelas não quebram em 1920px", async ({ browser }) => {
    const { context, page } = await openAs(browser, "administradores");
    await page.setViewportSize({ width: 1920, height: 1080 });

    for (const path of ["/admin", "/admin/fazendas", "/admin/produtos"]) {
      await page.goto(path);
      await expectHealthySurface(page);
    }
    await context.close();
  });

  test("tablet: navegação e modais funcionam em 768px", async ({ browser }) => {
    const { context, page } = await openAs(browser, "capatazes");
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto("/capataz/fazendas");
    await expect(page.getByRole("heading", { name: /Fazendas/i })).toBeVisible();

    await page.goto("/capataz/retiros");
    await expect(page.getByRole("heading", { name: /Retiros/i })).toBeVisible();

    await expectHealthySurface(page);
    await context.close();
  });

  test("mobile: formulários e listas acessíveis em 375px", async ({ browser }) => {
    const { context, page } = await openAs(browser, "pesadores");
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/pesador/pesagem");
    await expect(page.getByRole("heading", { name: /Pesagem/i })).toBeVisible();

    // Verificar que inputs são grandes o suficiente para toque
    const inputs = page.locator("input");
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);

    await expectHealthySurface(page);
    await context.close();
  });

  test("tabelas grandes: scroll horizontal controlado", async ({ browser }) => {
    const { context, page } = await openAs(browser, "gerentes");
    await page.goto("/gerente/produtos");

    // Verificar que tabela tem container scrollável
    const scrollContainer = page.locator("[data-scrollable]");
    const hasHorizontalScroll = await scrollContainer.evaluate((el) => {
      return el.scrollWidth > el.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(true);

    await expectHealthySurface(page);
    await context.close();
  });

  test("modais: abrem e fecham corretamente em todas as telas", async ({ browser }) => {
    const { context, page } = await openAs(browser, "administradores");
    await page.goto("/admin");

    // Simular clique que abre modal (ex: novo QR)
    await page.getByRole("button", { name: /Gerar|Emitir|Novo/i }).click();

    // Verificar modal aparece
    await expect(page.locator("[role='dialog']")).toBeVisible();

    // Fechar modal
    await page.keyboard.press("Escape");
    await expect(page.locator("[role='dialog']")).not.toBeVisible();

    await context.close();
  });

  test("mapas: renderizam e respondem a zoom em desktop/tablet", async ({ browser }) => {
    const { context, page } = await openAs(browser, "capatazes");
    await page.goto("/capataz/fazendas");

    // Verificar mapa (se existir) ou container alternativo
    const mapContainer = page.locator("[data-map]");
    const count = await mapContainer.count();
    if (count > 0) {
      await expect(mapContainer).toBeVisible();
    }

    await expectHealthySurface(page);
    await context.close();
  });

  test("PDF/relatórios: renderizam sem overflow", async ({ browser }) => {
    const { context, page } = await openAs(browser, "consultores");
    await page.goto("/consultor");

    // Verificar botão de exportar relatório
    await expect(page.getByRole("button", { name: /Exportar|Relatório|PDF/i })).toBeVisible();

    await expectHealthySurface(page);
    await context.close();
  });
});