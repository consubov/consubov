import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { fieldFixtures, selectFixtureRows, localPdfFixture, type FixtureRows } from "./fixtures/phase5-data";

// UI contract tests use intercepted HTTP. Real SW/offline tests live in pwa-fixtures.
// Full Chromium uses the native PDF viewer; headless-shell downloads iframe PDFs.
test.use({ serviceWorkers: "block", channel: "chromium" });

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
  for (const roleCase of ROLE_CASES) {
    test(`perfil ${roleCase.table}: redirect autenticado reproduzível`, async ({ browser }) => {
      const { context, page } = await openAs(browser, roleCase.table, undefined, fieldFixtures());
      try {
        await expect(page).toHaveURL(new RegExp(`${roleCase.home.replace("/", "\\/")}(?:\\/|$)`));
        await expectHealthySurface(page);
      } finally { await context.close(); }
    });
  }

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

async function captureAccessibility(page: Page, state: string) {
  await expect.poll(() => page.evaluate(() => document.getAnimations()
    .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
    .every(animation => animation.playState !== "running"))).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  const sanitize = (findings: typeof results.violations) => findings.map(({ id, impact, description, help, helpUrl, nodes }) => ({
    id, impact, description, help, helpUrl,
    nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
  }));
  const contrastPasses = (results.passes.find(finding => finding.id === "color-contrast")?.nodes ?? []).map(node => ({
    target: node.target,
    checks: node.any.filter(check => check.id === "color-contrast").map(check => ({
      foreground: check.data?.fgColor,
      background: check.data?.bgColor,
      ratio: check.data?.contrastRatio,
      required: check.data?.expectedContrastRatio,
    })),
  }));
  await test.info().attach(`${state}-accessibility`, {
    body: Buffer.from(JSON.stringify({ violations: sanitize(results.violations), incomplete: sanitize(results.incomplete), contrastPasses })),
    contentType: "application/json",
  });
  await page.screenshot({ path: test.info().outputPath(`${state}.png`) });
  // Continue the keyboard/retry checks while retaining every Axe failure.
  expect.soft(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([]);
  return contrastPasses;
}

async function captureErrorThemes(page: Page, state: string, errors: Locator[], themes = [false, true]) {
  const originallyDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  try {
    for (const dark of themes) {
      await page.evaluate(enabled => document.documentElement.classList.toggle("dark", enabled), dark);
      for (const error of errors) await expect(error).toBeVisible();
      const measured = await captureAccessibility(page, `${state}-${dark ? "dark" : "light"}`);
      const selectors = measured.map(node => typeof node.target[0] === "string" ? node.target[0] : "");
      for (const error of errors) {
        await expect(error).toBeVisible();
        const index = await error.evaluate((element, targets) => targets.findIndex(target => target !== "" && element.matches(target)), selectors);
        expect(index, "Axe must measure the intended visible error text").toBeGreaterThanOrEqual(0);
        expect(measured[index].checks.length).toBeGreaterThan(0);
        for (const check of measured[index].checks) {
          expect(Number.isFinite(check.ratio)).toBe(true);
          expect(check.ratio).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  } finally {
    await page.evaluate(enabled => document.documentElement.classList.toggle("dark", enabled), originallyDark);
  }
}

async function expectDialogKeyboard(page: Page, dialog: Locator, opener: Locator, description: string) {
  await expect(dialog).toBeVisible();
  await expect.soft(dialog).toHaveAttribute("aria-modal", "true");
  await expect.soft(dialog).toHaveAccessibleDescription(description);
  await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  const focusable = dialog.locator('button:not([disabled]), input:not([disabled]):not([type="hidden"]), [tabindex="0"]');
  const visible: Locator[] = [];
  for (const element of await focusable.all()) if (await element.isVisible()) visible.push(element);
  expect(visible.length).toBeGreaterThan(1);
  await visible[visible.length - 1].focus();
  await page.keyboard.press("Tab");
  await expect(visible[0]).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(visible[visible.length - 1]).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect.soft(opener).toBeFocused();
}

// A valid, synthetic one-pixel PNG; never read a customer file or external asset.
const fixtureLogo = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNg+A8AAQIBAEK+vGgAAAAASUVORK5CYII=", "base64");
const localSupabaseOrigin = "http://127.0.0.1:54321";
const pesadoresApiPath = new URL("rest/v1/pesadores", localSupabaseOrigin).pathname;
const fazendasApiPath = new URL("rest/v1/fazendas", localSupabaseOrigin).pathname;
const logoUploadPrefix = new URL("storage/v1/object/relatorios/", localSupabaseOrigin).pathname;
const fixtureUserId = "11111111-1111-4111-8111-111111111111";

async function openLogoFixture(browser: Browser, failure?: "storage" | "patch") {
  const { context, page } = await openAs(browser, "pesadores");
  const oldLogo = `${localSupabaseOrigin}/storage/v1/object/public/relatorios/pesador-logos/role-1-old.png`;
  const uploads: Array<{ path: string; bytes: Buffer; mime: string; filename: string; upsert: string | undefined }> = [];
  const patches: Array<{ id: string | null; body: unknown }> = [];
  const unexpectedMutations: string[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method()) && /\/(?:rest|storage)\/v1\//.test(url.pathname)) {
      const upload = request.method() === "POST" && /^\/storage\/v1\/object\/relatorios\/pesador-logos\/role-1-\d+\.png$/.test(url.pathname);
      const patch = request.method() === "PATCH" && url.pathname === pesadoresApiPath && url.searchParams.get("id") === "eq.role-1";
      if (!(url.origin === localSupabaseOrigin && (upload || patch))) unexpectedMutations.push(`${request.method()} ${url.pathname}`);
    }
  });
  await page.route(`${localSupabaseOrigin}/rest/v1/pesadores?**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.searchParams.get("user_id") === `eq.${fixtureUserId}` &&
        ["id,logo_url", "logo_url,nome_empresa"].includes(url.searchParams.get("select") ?? "")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "role-1", user_id: fixtureUserId, ativo: true, logo_url: oldLogo, nome_empresa: "Empresa de teste" }) });
    } else if (request.method() === "PATCH" && url.searchParams.get("id") === "eq.role-1") {
      patches.push({ id: url.searchParams.get("id"), body: request.postDataJSON() });
      await route.fulfill(failure === "patch"
        ? { status: 403, contentType: "application/json", body: JSON.stringify({ code: "42501", message: "Atualização da logo não autorizada." }) }
        : { status: 204, body: "" });
    } else await route.fallback();
  });
  await page.route(`${localSupabaseOrigin}/storage/v1/object/relatorios/pesador-logos/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "POST" || !/^\/storage\/v1\/object\/relatorios\/pesador-logos\/role-1-\d+\.png$/.test(url.pathname)) {
      await route.fallback();
      return;
    }
    const body = request.postDataBuffer();
    if (!body) throw new Error("Expected actual multipart upload bytes");
    const form = await new Response(body, { headers: { "content-type": request.headers()["content-type"] } }).formData();
    const file = form.get("");
    if (!file || typeof file === "string") throw new Error("Expected actual uploaded File part");
    const path = url.pathname.slice(logoUploadPrefix.length);
    uploads.push({ path, bytes: Buffer.from(await file.arrayBuffer()), mime: file.type, filename: file.name, upsert: request.headers()["x-upsert"] });
    await route.fulfill(failure === "storage"
      ? { status: 403, contentType: "application/json", body: JSON.stringify({ statusCode: "403", message: "Envio da logo não autorizado." }) }
      : { status: 200, contentType: "application/json", body: JSON.stringify({ Id: "synthetic-upload-1", Key: `relatorios/${path}` }) });
  });
  await page.route(`${localSupabaseOrigin}/storage/v1/object/public/relatorios/pesador-logos/**`, async route => {
    const url = route.request().url();
    const uploaded = uploads[0] && `${localSupabaseOrigin}/storage/v1/object/public/relatorios/${uploads[0].path}`;
    if (route.request().method() === "GET" && (url === oldLogo || url === uploaded)) {
      await route.fulfill({ status: 200, contentType: "image/png", body: fixtureLogo });
    } else await route.fallback();
  });
  await page.goto("/pesador/pesagem");
  const opener = page.getByRole("button", { name: "Configurações", exact: true });
  await opener.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Configurações", exact: true });
  await expect(dialog.getByRole("img", { name: "Logo", exact: true })).toHaveAttribute("src", oldLogo);
  await expect(dialog.getByRole("button", { name: "Substituir", exact: true })).toBeEnabled();
  return { context, page, dialog, opener, oldLogo, uploads, patches, unexpectedMutations };
}

test.describe("@phase5-ui-contract @web-ready FASE 5 — upload, acessibilidade e recuperação", () => {
  test("fazendas autenticadas: Axe com linha carregada", async ({ browser }) => {
    const { context, page } = await openAs(browser, "administradores", "/admin/fazendas", fieldFixtures());
    try {
      await expect(page.getByRole("row").filter({ hasText: "Fazenda de teste" })).toBeVisible();
      await captureAccessibility(page, "fazendas-loaded");
    } finally { await context.close(); }
  });

  test("produto: Axe no diálogo real e navegação de foco", async ({ browser }) => {
    const { context, page } = await openAs(browser, "administradores", "/admin/produtos");
    try {
      const opener = page.getByRole("button", { name: "Cadastrar Produto", exact: true });
      await opener.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Cadastrar Produto", exact: true });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("combobox").click();
      await page.getByRole("option", { name: "Outro", exact: true }).click();
      await captureAccessibility(page, "produto-dialog");
      await expectDialogKeyboard(page, dialog, opener, "Preencha os dados do produto.");
    } finally { await context.close(); }
  });

  test("pesador: Axe na página e no diálogo, teclado e cancelamento sem escrita", async ({ browser }) => {
    const fixture = await openLogoFixture(browser);
    try {
      await fixture.dialog.getByRole("button", { name: "Fechar", exact: true }).click();
      await expect(fixture.dialog).toHaveCount(0);
      await captureAccessibility(fixture.page, "pesador-page-before-dialog");
      await fixture.opener.focus();
      await fixture.page.keyboard.press("Enter");
      await expect(fixture.dialog.getByRole("button", { name: "Substituir", exact: true })).toBeEnabled();
      await captureAccessibility(fixture.page, "pesador-dialog");
      await expectDialogKeyboard(fixture.page, fixture.dialog, fixture.opener, "A logo aparecerá no canto direito dos relatórios em PDF.");
      await captureAccessibility(fixture.page, "pesador-page");
      expect(fixture.uploads).toEqual([]);
      expect(fixture.patches).toEqual([]);
      expect(fixture.unexpectedMutations).toEqual([]);
    } finally { await fixture.context.close(); }
  });

  test("logo: bytes PNG reais, MIME, upsert e PATCH correspondente", async ({ browser }) => {
    const fixture = await openLogoFixture(browser);
    try {
      await fixture.dialog.locator('input[type="file"]').setInputFiles({ name: "fixture-logo.png", mimeType: "image/png", buffer: fixtureLogo });
      await expect(fixture.page.getByText("Logo atualizada", { exact: true })).toBeVisible();
      expect(fixture.uploads).toHaveLength(1);
      expect(fixture.uploads[0]).toMatchObject({ bytes: fixtureLogo, mime: "image/png", filename: "fixture-logo.png", upsert: "true" });
      const uploadedUrl = `${localSupabaseOrigin}/storage/v1/object/public/relatorios/${fixture.uploads[0].path}`;
      expect(fixture.patches).toEqual([{ id: "eq.role-1", body: { logo_url: uploadedUrl } }]);
      const image = fixture.dialog.getByRole("img", { name: "Logo", exact: true });
      await expect(image).toHaveAttribute("src", uploadedUrl);
      await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      expect(fixture.unexpectedMutations).toEqual([]);
      await captureAccessibility(fixture.page, "logo-success");
    } finally { await fixture.context.close(); }
  });

  for (const failure of ["storage", "patch"] as const) {
    test(`logo: ${failure}403 exibe erro e conserva imagem anterior`, async ({ browser }) => {
      const fixture = await openLogoFixture(browser, failure);
      try {
        await fixture.dialog.locator('input[type="file"]').setInputFiles({ name: "fixture-logo.png", mimeType: "image/png", buffer: fixtureLogo });
        await expect(fixture.page.getByText("Erro ao enviar logo", { exact: true })).toBeVisible();
        // Radix pauses the real closing timer while the pointer stays over the toast.
        await fixture.page.getByText("Erro ao enviar logo", { exact: true }).hover();
        await expect(fixture.page.getByText(failure === "storage" ? "Envio da logo não autorizado." : "Atualização da logo não autorizada.", { exact: true })).toBeVisible();
        await expect(fixture.page.getByText("Logo atualizada", { exact: true })).toHaveCount(0);
        await expect(fixture.dialog.getByRole("img", { name: "Logo", exact: true })).toHaveAttribute("src", fixture.oldLogo);
        await expect(fixture.dialog.getByRole("button", { name: "Substituir", exact: true })).toBeEnabled();
        expect(fixture.uploads).toHaveLength(1);
        expect(fixture.patches).toHaveLength(failure === "storage" ? 0 : 1);
        if (failure === "patch") {
          expect(fixture.patches[0]).toEqual({ id: "eq.role-1", body: { logo_url: `${localSupabaseOrigin}/storage/v1/object/public/relatorios/${fixture.uploads[0].path}` } });
        }
        expect(fixture.unexpectedMutations).toEqual([]);
        await captureErrorThemes(fixture.page, `logo-${failure}403`, [
          fixture.page.getByText("Erro ao enviar logo", { exact: true }),
          fixture.page.getByText(failure === "storage" ? "Envio da logo não autorizado." : "Atualização da logo não autorizada.", { exact: true }),
        ]);
      } finally { await fixture.context.close(); }
    });
  }

  for (const status of [401, 403, 503]) {
    for (const dark of [false, true]) {
      test(`fazendas: ${status} tema ${dark ? "dark" : "light"} sem dados rejeitados e retry pelo teclado`, async ({ browser }) => {
        const { context, page } = await openAs(browser, "administradores");
        let reads = 0;
        let retrying = false;
        const writes: string[] = [];
        page.on("request", request => {
          if (new URL(request.url()).pathname === fazendasApiPath && !["GET", "HEAD", "OPTIONS"].includes(request.method())) writes.push(request.method());
        });
      try {
        await page.route(`${localSupabaseOrigin}/rest/v1/fazendas?**`, async route => {
          if (route.request().method() !== "GET") { await route.fallback(); return; }
          reads++;
          await route.fulfill({ status: retrying ? 200 : status, contentType: "application/json", body: JSON.stringify(!retrying
            ? { code: status === 503 ? "TEMPORARY" : "42501", message: "Synthetic rejected row", data: [{ id: "other", nome: "PRIVATE-TENANT" }] }
            : fieldFixtures().fazendas) });
        });
        await page.goto("/admin/fazendas");
        const alert = page.getByRole("alert");
        // The installed SDK retries503 after1s+2s+4s before returning its error.
        await expect(alert).toContainText(status === 503 ? "Erro ao carregar fazendas. Tente novamente." : "Acesso não autorizado para carregar fazendas.", { timeout: status === 503 ? 10_000 : 5_000 });
        await expect(page.getByText("PRIVATE-TENANT")).toHaveCount(0);
        await expect(page.getByText("Nenhuma fazenda cadastrada.", { exact: true })).toHaveCount(0);
        await page.evaluate(enabled => document.documentElement.classList.toggle("dark", enabled), dark);
        await captureErrorThemes(page, `fazendas-${status}`, [alert.locator("p")], [dark]);
        const retry = alert.getByRole("button", { name: "Tentar novamente", exact: true });
        await retry.focus();
        const failedReads = reads;
        retrying = true;
        await page.keyboard.press("Enter");
        await expect(page.getByRole("row").filter({ hasText: "Fazenda de teste" })).toBeVisible();
        await expect(alert).toHaveCount(0);
        expect(reads).toBe(failedReads + 1);
        expect(writes).toEqual([]);
        await expect(page.getByText("PRIVATE-TENANT")).toHaveCount(0);
        await captureAccessibility(page, `fazendas-${status}-${dark ? "dark" : "light"}-recovered`);
      } finally { await context.close(); }
    });
    }
  }
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
      // Exclude the admin header view-mode selector.
      const selectors = page.getByRole("main").getByRole("combobox");
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
      // The iframe preview can itself emit a headless-browser download.
      const previewUrl = await dialog.locator("iframe").getAttribute("src");
      const downloaded = page.waitForEvent("download", { predicate: file => file.url() !== previewUrl });
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
