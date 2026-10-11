import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fieldFixtures, selectFixtureRows, localPdfFixture, type FixtureRows } from "./fixtures/phase5-data";

// UI contract tests use intercepted HTTP. Real SW/offline tests live in pwa-fixtures.
test.use({ serviceWorkers: "block" });

function isLoopback(hostname: string): boolean {
  return ["127.0.0.1", "localhost", "[::1]"].includes(hostname);
}

async function isolateLocalNetwork(context: BrowserContext) {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL || !isLoopback(new URL(baseURL).hostname)) {
    throw new Error("Phase 5 UI tests require a loopback baseURL, never a customer environment");
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

async function mockAuthenticatedRole(page: Page, roleTable: RoleTable, fixtures: FixtureRows = {}) {
  const userId = "11111111-1111-4111-8111-111111111111";
  const now = new Date().toISOString();

  await page.route("**/auth/v1/user", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      id: userId, aud: "authenticated", role: "authenticated", email: "fase5@example.com",
      app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: now,
    }) });
  });

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

    // These scenarios do not certify writes; unexpected mutations fail explicitly.
    if (!["GET", "HEAD"].includes(route.request().method())) {
      await route.fulfill({ status: 405, contentType: "application/json", body: JSON.stringify({ code: "UNMOCKED_MUTATION" }) });
      return;
    }
    const rows = selectFixtureRows(fixtures[table] ?? [], url.searchParams);
    const singleton = (route.request().headers()["accept"] ?? "").includes("vnd.pgrst.object+json");
    await route.fulfill({
      status: singleton && rows.length !== 1 ? 406 : 200,
      contentType: "application/json",
      body: JSON.stringify(singleton ? rows.length === 1 ? rows[0] : { code: "PGRST116", message: "No unique fixture row" } : rows),
      headers: { "content-range": rows.length ? `0-${rows.length - 1}/${rows.length}` : "*/0" },
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
  await page.waitForURL(url => ROLE_CASES.some(({ home }) => url.pathname === home || url.pathname.startsWith(`${home}/`)));
}

async function openAs(browser: Browser, table: RoleTable, path?: string, fixtures: FixtureRows = {}) {
  const { baseURL, viewport, hasTouch, isMobile, deviceScaleFactor, userAgent } = test.info().project.use;
  const context = await browser.newContext({
    baseURL, viewport, hasTouch, isMobile, deviceScaleFactor, userAgent, serviceWorkers: "block",
  });
  try {
    await isolateLocalNetwork(context);
    const page = await context.newPage();
    await mockAuthenticatedRole(page, table, fixtures);
    await login(page);
    if (path) await page.goto(path);
    return { context, page };
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function expectHealthySurface(page: Page) {
  await expect(page.locator("#root")).toContainText(/\S/);
  await expect.poll(() => page.locator("#root").innerText()).not.toMatch(/^\s*(?:C|Carregando[^\n]*)\s*$/);
  await expect(page.getByRole("heading", { name: "404", exact: true })).toHaveCount(0);
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);
}

test.describe("@web-ready FASE 5 — autenticação, perfis e superfícies críticas", () => {
  test("todos os nove perfis conhecidos possuem redirect autenticado reproduzível", async ({ browser }) => {
    for (const roleCase of ROLE_CASES) {
      const { context, page } = await openAs(browser, roleCase.table, undefined, fieldFixtures());
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
      const { context, page } = await openAs(browser, item.table, item.path, fieldFixtures());
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

  test("capataz consulta o retiro e os pastos pelo painel existente", async ({ browser }) => {
    const { context, page } = await openAs(browser, "capatazes", undefined, fieldFixtures());
    try {
      await expect(page).toHaveURL(/\/capataz$/);
      await expect(page.getByRole("button", { name: /Iniciar Salga/ })).toBeVisible();
      await expect(page.getByText("Pasto de teste", { exact: true })).toBeVisible();
      await expectHealthySurface(page);
      await page.goto("/capataz/transferencia-retiro");
      await expect(page.getByRole("heading", { name: "Transferência entre Retiros" })).toBeVisible();
    } finally { await context.close(); }
  });

  test("QR web: gera pre-visualizacao local a partir de uma fazenda selecionada", async ({ browser }) => {
    const { context, page } = await openAs(browser, "administradores", "/admin/qrcodes", fieldFixtures());
    try {
      await expect(page.getByRole("heading", { name: "Gerar QR Codes", exact: true })).toBeVisible();
      await page.getByRole("tab", { name: "Por Fazenda", exact: true }).click();
      const pane = page.getByRole("tabpanel");
      const generate = pane.getByRole("button", { name: "Gerar QR Codes da Fazenda", exact: true });
      await expect(generate).toBeDisabled();
      await pane.getByRole("combobox").click();
      await page.getByRole("option", { name: "Fazenda de teste", exact: true }).click();
      await generate.click();
      await expect(page.getByRole("heading", { name: "1 QR Code gerado", exact: true })).toBeVisible();
      await expect(page.locator('[data-qr-preview-page="true"]')).toHaveCount(1);
      await expect(page.getByRole("button", { name: "Baixar PDF (1)", exact: true })).toBeEnabled();
      await expectHealthySurface(page);
    } finally { await context.close(); }
  });

  test("produtos do gerente: alterna Produtos e Onde usar na rota existente", async ({ browser }) => {
    const { context, page } = await openAs(browser, "gerentes", "/gerente/produtos", fieldFixtures());
    try {
      await expect(page.getByRole("tab", { name: "Produtos", exact: true })).toHaveAttribute("aria-selected", "true");
      await page.getByRole("tab", { name: "Onde usar", exact: true }).click();
      await expect(page).toHaveURL(/aba=onde-usar/);
      await expect(page.getByRole("tab", { name: "Onde usar", exact: true })).toHaveAttribute("aria-selected", "true");
      await page.getByRole("tab", { name: "Produtos", exact: true }).click();
      await expect(page).toHaveURL(/\/gerente\/produtos$/);
      await expectHealthySurface(page);
    } finally { await context.close(); }
  });

  test("salga: seleciona fazenda e retiro e edita uma linha sem enviar", async ({ browser }) => {
    const { context, page } = await openAs(browser, "administradores", "/admin/lancamento-manual", fieldFixtures());
    try {
      await expect(page.getByRole("heading", { name: "Lançamento Manual", exact: true })).toBeVisible();
      const selectors = page.getByRole("combobox");
      await expect(selectors).toHaveCount(4);
      await expect(selectors.nth(1)).toBeDisabled();
      await selectors.nth(0).click();
      await page.getByRole("option", { name: "Fazenda de teste", exact: true }).click();
      await selectors.nth(1).click();
      await page.getByRole("option", { name: "Retiro de teste", exact: true }).click();
      const row = page.getByRole("row").filter({ hasText: "Pasto de teste" });
      await expect(row).toBeVisible();
      const sacks = row.getByRole("spinbutton").nth(2);
      await sacks.fill("1");
      await expect(sacks).toHaveValue("1");
      await expect(page.getByRole("button", { name: "Salvar e Enviar", exact: true })).toBeEnabled();
      await expectHealthySurface(page);
    } finally { await context.close(); }
  });

  test("transferencia entre retiros: formulario e abas reais sem movimentar animais", async ({ browser }) => {
    const { context, page } = await openAs(browser, "capatazes", "/capataz/transferencia-retiro", fieldFixtures());
    try {
      await expect(page.getByRole("heading", { name: "Transferência entre Retiros" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Solicitar Transferência", exact: true })).toBeDisabled();
      await page.getByRole("tab", { name: "Pendentes", exact: true }).click();
      await expect(page.getByText("Nenhuma transferência pendente", { exact: true })).toBeVisible();
      await page.getByRole("tab", { name: "Histórico", exact: true }).click();
      await expect(page.getByText("Nenhuma transferência no histórico", { exact: true })).toBeVisible();
      await page.getByRole("tab", { name: "Nova", exact: true }).click();
      await expect(page.getByRole("button", { name: "Solicitar Transferência", exact: true })).toBeDisabled();
      await expectHealthySurface(page);
    } finally { await context.close(); }
  });

  test("consultor: historico apresenta estado vazio sem fabricar visitas", async ({ browser }) => {
    const { context, page } = await openAs(browser, "consultores", "/consultor/historico");
    try {
      await expect(page.getByRole("heading", { name: "Histórico de Visitas", exact: true })).toBeVisible();
      await expect(page.getByText("Nenhuma visita registrada ainda.", { exact: true })).toBeVisible();
      await expectHealthySurface(page);
    } finally { await context.close(); }
  });

  test("fábrica: mostra dashboard quando a fabrica do perfil existe", async ({ browser }) => {
    const { context, page } = await openAs(browser, "operadores_fabrica", "/fabrica", fieldFixtures());
    try {
      await expect(page.getByRole("heading", { name: "Operador de Fábrica", exact: true })).toBeVisible();
      await expect(page.getByText("Estoque Atual", { exact: true })).toBeVisible();
      await expect(page.getByText("Nenhuma fábrica vinculada ao seu perfil. Contate o administrador.")).toHaveCount(0);
      await expectHealthySurface(page);
    } finally { await context.close(); }
  });

  test("pesador: filtra o historico de pesagens e informa ausencia de resultado", async ({ browser }) => {
    const { context, page } = await openAs(browser, "pesadores", "/pesador/pesagem");
    try {
      await expect(page.getByRole("heading", { name: "Histórico", exact: true })).toBeVisible();
      await expect(page.getByText("Pesagens finalizadas.", { exact: true })).toBeVisible();
      await expect(page.getByText("Nenhuma pesagem finalizada ainda.", { exact: true })).toBeVisible();
      await page.getByPlaceholder("Buscar por produtor...", { exact: true }).fill("inexistente");
      await expect(page.getByText("Nenhum resultado.", { exact: true })).toBeVisible();
      await expectHealthySurface(page);
    } finally { await context.close(); }
  });

  test("usuário sem permissão recebe acesso negado", async ({ page }) => {
    await mockAuthenticatedRole(page, "pecuaristas"); // Pecuarista não tem acesso admin
    await login(page);

    // Tentar acessar área admin
    await page.goto("/admin");
    await expect(page.getByText(/acesso não autorizado|não tem permissão/i)).toBeVisible();
  });

  test("tenant mismatch em ambiente de teste: recusa dados e permite nova tentativa", async ({ browser }) => {
    const { context, page } = await openAs(browser, "administradores");
    try {
      await page.route("**/rest/v1/fazendas**", async (route) => {
        await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({
          code: "42501", message: "TENANT_MISMATCH", data: [{ id: "other", nome: "PRIVATE-TENANT" }],
        }) });
      });
      await page.goto("/admin/fazendas");
      await expect(page.getByRole("alert")).toContainText("Acesso não autorizado para carregar fazendas.");
      await expect(page.getByText("PRIVATE-TENANT")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Tentar novamente", exact: true })).toBeEnabled();
      await expect(page.getByText("Nenhuma fazenda cadastrada.", { exact: true })).toHaveCount(0);
    } finally { await context.close(); }
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

  test("tablet: formulario real de produto abre e fecha em 768px", async ({ browser }) => {
    const { context, page } = await openAs(browser, "administradores", "/admin/produtos");
    try {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.getByRole("button", { name: "Cadastrar Produto", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Cadastrar Produto", exact: true });
      await expect(dialog).toBeVisible();
      await dialog.getByPlaceholder("Ex: Vaccinar, Tortuga, Minerax").fill("Marca de teste");
      await expect(dialog.getByPlaceholder("Ex: Vaccinar, Tortuga, Minerax")).toHaveValue("Marca de teste");
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expectHealthySurface(page);
    } finally { await context.close(); }
  });

  test("mobile: busca de pesagem permanece utilizavel em 375px", async ({ browser }) => {
    const { context, page } = await openAs(browser, "pesadores", "/pesador/pesagem");
    try {
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(page.getByRole("heading", { name: "Histórico", exact: true })).toBeVisible();
      const search = page.getByPlaceholder("Buscar por produtor...", { exact: true });
      await search.fill("teste mobile");
      await expect(search).toHaveValue("teste mobile");
      await expect(page.getByText("Nenhum resultado.", { exact: true })).toBeVisible();
      await expectHealthySurface(page);
    } finally { await context.close(); }
  });

  test("tabela de produtos: rolagem contida sem exigir overflow artificial", async ({ browser }) => {
    const { context, page } = await openAs(browser, "administradores", "/admin/produtos", fieldFixtures());
    try {
      await expect(page.getByRole("cell", { name: "Produto de teste", exact: true })).toBeVisible();
      const table = page.getByRole("table");
      const contained = await table.evaluate(el => {
        let parent = el.parentElement;
        while (parent && parent !== document.body) {
          if (["auto", "scroll"].includes(getComputedStyle(parent).overflowX)) return true;
          parent = parent.parentElement;
        }
        return false;
      });
      expect(contained).toBe(true);
      await expectHealthySurface(page);
    } finally { await context.close(); }
  });

  test("modais: cancelar cadastro de produto nao envia escrita", async ({ browser }) => {
    const { context, page } = await openAs(browser, "administradores", "/admin/produtos");
    const writes: string[] = [];
    page.on("request", request => {
      if (/\/rest\/v1\/produtos$/.test(new URL(request.url()).pathname) && !["GET", "HEAD", "OPTIONS"].includes(request.method())) writes.push(request.method());
    });
    try {
      await page.getByRole("button", { name: "Cadastrar Produto", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Cadastrar Produto", exact: true });
      await dialog.getByPlaceholder("Ex: Vaccinar, Tortuga, Minerax").fill("Nao salvar");
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      expect(writes).toEqual([]);
      await expectHealthySurface(page);
    } finally { await context.close(); }
  });

  test("mapas: rota de retiro informa mapa ausente sem renderizacao ficticia", async ({ browser }) => {
    const { context, page } = await openAs(browser, "capatazes", undefined, fieldFixtures());
    try {
      await page.goto("/mapa/retiro/retiro-1");
      await expect(page.getByRole("heading", { name: "Mapa — Retiro de teste", exact: true })).toBeVisible();
      await expect(page.getByText("Este retiro ainda não possui mapa cadastrado.", { exact: true })).toBeVisible();
      await expectHealthySurface(page);
      await page.getByRole("button", { name: "Voltar", exact: true }).click();
      await expect(page).toHaveURL(/\/capataz$/);
    } finally { await context.close(); }
  });

  test("PDF: abre e baixa os bytes de um relatorio sintetico no historico", async ({ browser }) => {
    const { context, page } = await openAs(browser, "consultores");
    const pdf = localPdfFixture();
    try {
      const pdfUrl = new URL("test-report.pdf", page.url()).href;
      await page.route(pdfUrl, route => route.fulfill({ status: 200, contentType: "application/pdf", body: pdf }));
      await page.route("**/rest/v1/visitas_tecnicas**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{
        id: "visita-1", tipo: "rotina", status: "finalizada", hora_inicio: "2026-01-01T12:00:00Z", consultor_id: "role-1",
        fazenda_consultor_id: "fazenda-1", pdf_url: pdfUrl, deleted_at: null, fazendas_consultor: { nome_fazenda: "Fazenda de teste" },
      }]) }));
      await page.goto("/consultor/historico");
      await page.getByRole("button", { name: "Ver / Baixar PDF", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Relatório — Fazenda de teste", exact: true });
      await expect(dialog.locator("iframe")).toHaveAttribute("src", /^blob:/);
      const downloaded = page.waitForEvent("download");
      await dialog.getByRole("button", { name: "Baixar", exact: true }).click();
      const download = await downloaded;
      expect(download.suggestedFilename()).toBe("visita-Fazenda de teste.pdf");
      expect(await download.failure()).toBeNull();
      const file = await download.path();
      expect(file).not.toBeNull();
      expect(await readFile(file!)).toEqual(pdf);
      await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expectHealthySurface(page);
    } finally { await context.close(); }
  });
});
