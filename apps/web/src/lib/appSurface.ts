/**
 * Separação arquitetural entre o Site Institucional (Landing Pages) e o App
 * (subdomínio app.* e execução instalada pelo ícone do dispositivo).
 *
 * Regras de produto (docs/70-separacao-site-e-app-nativo.md):
 * 1. O Site institucional aponta para a página de download do App (/baixar).
 * 2. Nunca mencionar a sigla "PWA" para o usuário final; usar sempre "App" / "Aplicativo".
 * 3. No subdomínio do App (app.*), o login e as rotas protegidas podem ser usados
 *    no navegador comum, sem exigir instalação nem perder autorização por perfil.
 * 4. Quando aberto pelo ícone instalado, a raiz e /baixar continuam enviando o
 *    usuário ao sistema (/app ou /consultor), preservando os dados offline.
 * 5. O Site permanece público, sem rotas privadas ou novos botões de acesso.
 */

export type SurfaceMode = "site" | "app" | "unified";
export type AppBrandId = "consubov" | "relatto";

const STANDALONE_SESSION_KEY = "consubov:standalone-session";
const INSTALL_CHANNEL_NAME = "consubov:install-state";

export interface StandaloneProbeInput {
  standaloneMedia?: boolean;
  navigatorStandalone?: boolean;
  referrer?: string;
  search?: string;
}

export interface SurfaceProbeInput {
  hostname?: string;
  search?: string;
  envMode?: string;
}

export interface RedirectDecisionContext {
  surfaceMode?: SurfaceMode;
  standalone?: boolean;
  relattoProfile?: boolean;
  appBaseUrl?: string;
}

interface NavigatorWithInstalledApps extends Navigator {
  standalone?: boolean;
  getInstalledRelatedApps?: () => Promise<Array<{ id?: string; platform?: string; url?: string }>>;
}

export function getInstalledStorageKey(brand: AppBrandId = "consubov"): string {
  return `consubov:app-installed:${brand}`;
}

export function getInstalledCookieName(brand: AppBrandId = "consubov"): string {
  return `consubov_app_installed_${brand}`;
}

export function activateStandaloneSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STANDALONE_SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.documentElement.classList.add("app-standalone");
  }
}

export function markAppInstalled(brand: AppBrandId = "consubov"): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getInstalledStorageKey(brand), "1");
  } catch {
    /* ignore storage restrictions */
  }
  try {
    document.cookie = `${getInstalledCookieName(brand)}=1; Max-Age=31536000; Path=/; SameSite=Lax`;
  } catch {
    /* ignore cookie restrictions */
  }
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(INSTALL_CHANNEL_NAME);
      channel.postMessage({ type: "INSTALLED", brand });
      channel.close();
    }
  } catch {
    /* ignore BroadcastChannel restrictions */
  }
}

export function clearAppInstalledMark(brand: AppBrandId = "consubov"): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getInstalledStorageKey(brand));
  } catch {
    /* ignore */
  }
  try {
    window.sessionStorage.removeItem(STANDALONE_SESSION_KEY);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${getInstalledCookieName(brand)}=; Max-Age=0; Path=/; SameSite=Lax`;
  } catch {
    /* ignore */
  }
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(INSTALL_CHANNEL_NAME);
      channel.postMessage({ type: "CLEARED", brand });
      channel.close();
    }
  } catch {
    /* ignore */
  }
}

export function isAppInstalledOnDevice(brand: AppBrandId = "consubov"): boolean {
  if (typeof window === "undefined") return false;

  try {
    if (window.localStorage.getItem(getInstalledStorageKey(brand)) === "1") {
      return true;
    }
  } catch {
    /* ignore */
  }

  try {
    const cookieName = getInstalledCookieName(brand);
    const regex = new RegExp(`(?:^|;\\s*)${cookieName}=1(?:;|$)`);
    if (typeof document !== "undefined" && regex.test(document.cookie || "")) {
      return true;
    }
  } catch {
    /* ignore */
  }

  if (isStandaloneApp()) {
    markAppInstalled(brand);
    return true;
  }

  return false;
}

export async function detectInstalledAppAsync(
  brand: AppBrandId = "consubov",
): Promise<boolean> {
  if (isAppInstalledOnDevice(brand)) {
    return true;
  }
  if (typeof window === "undefined") return false;

  try {
    const nav = window.navigator as NavigatorWithInstalledApps;
    if (typeof nav.getInstalledRelatedApps === "function") {
      const related = await nav.getInstalledRelatedApps();
      if (Array.isArray(related) && related.length > 0) {
        markAppInstalled(brand);
        return true;
      }
    }
  } catch {
    /* ignore unsupported browser errors */
  }

  return false;
}

export function getDownloadAppHref(
  brand: AppBrandId = "consubov",
  explicitBaseUrl?: string,
): string {
  const rawBase =
    explicitBaseUrl !== undefined
      ? explicitBaseUrl
      : (import.meta.env.VITE_APP_URL as string | undefined) ?? "";
  const normalizedBase = rawBase.trim().replace(/\/+$/, "");
  const suffix = brand === "relatto" ? "/baixar?app=relatto" : "/baixar";
  return normalizedBase ? `${normalizedBase}${suffix}` : suffix;
}

export function getSurfaceMode(probe?: SurfaceProbeInput): SurfaceMode {
  // Configuração do build vence parâmetros da URL: o site não pode ser
  // transformado em superfície privada com ?surface=app.
  const envMode = (
    probe?.envMode ??
    ((import.meta.env.VITE_SURFACE_MODE as string | undefined) ?? "")
  ).trim().toLowerCase();
  if (envMode === "site" || envMode === "app") return envMode;

  const hostname = (
    probe?.hostname ??
    (typeof window !== "undefined" && window.location
      ? window.location.hostname
      : "")
  ).toLowerCase();
  if (hostname.startsWith("app.")) return "app";

  // Overrides de superfície continuam disponíveis somente nos builds
  // unified/de QA, quando não há um modo de build fixo.
  const search =
    probe?.search ??
    (typeof window !== "undefined" && window.location
      ? window.location.search
      : "");
  const querySurface = new URLSearchParams(search).get("surface")?.toLowerCase();
  if (querySurface === "app") return "app";
  if (querySurface === "site") return "site";
  return "unified";
}

export function isStandaloneApp(probe?: StandaloneProbeInput): boolean {
  if (typeof window === "undefined" && !probe) return false;

  const search =
    probe?.search ??
    (typeof window !== "undefined" && window.location
      ? window.location.search
      : "");
  const params = new URLSearchParams(search);
  if (params.get("standalone") === "0") {
    return false;
  }

  let sessionPersisted = false;
  try {
    sessionPersisted =
      typeof window !== "undefined" &&
      typeof window.sessionStorage?.getItem === "function" &&
      window.sessionStorage.getItem(STANDALONE_SESSION_KEY) === "1";
  } catch {
    /* ignore storage restrictions */
  }

  const standaloneMedia =
    probe?.standaloneMedia ??
    (typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        window.matchMedia("(display-mode: minimal-ui)").matches ||
        window.matchMedia("(display-mode: window-controls-overlay)").matches
      : false);

  const navigatorStandalone =
    probe?.navigatorStandalone ??
    (typeof window !== "undefined" && window.navigator
      ? (window.navigator as NavigatorWithInstalledApps).standalone === true
      : false);

  const referrer =
    probe?.referrer ??
    (typeof document !== "undefined" && document.referrer
      ? document.referrer
      : "");

  const isTwa = referrer.startsWith("android-app://");
  const isQueryStandalone = params.get("standalone") === "1";

  const detected =
    Boolean(standaloneMedia) ||
    Boolean(navigatorStandalone) ||
    isTwa ||
    isQueryStandalone ||
    sessionPersisted;

  if (detected && typeof window !== "undefined") {
    activateStandaloneSession();
    const activeBrand: AppBrandId = isRelattoActiveProfile(search)
      ? "relatto"
      : "consubov";
    markAppInstalled(activeBrand);
  }

  return detected;
}

export function isRelattoHostname(hostname: string): boolean {
  // Site, App and Preview can use distinct hosts while sharing one PWA codebase.
  return /(^|[.-])relatto([.-]|$)/i.test(hostname.trim());
}

export function isRelattoActiveProfile(search = ""): boolean {
  const params = new URLSearchParams(search);
  if (params.get("app") === "relatto" || params.get("pwa") === "relatto") {
    return true;
  }
  if (typeof window !== "undefined") {
    if (isRelattoHostname(window.location.hostname)) return true;
    try {
      if (window.localStorage.getItem("relatto:pwa-profile") === "relatto") {
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  return false;
}

const PUBLIC_SITE_PREFIXES = ["/", "/index", "/landing", "/relatto", "/baixar"];

function isPublicSitePath(pathname: string): boolean {
  const p = pathname.toLowerCase();
  return PUBLIC_SITE_PREFIXES.some(
    (prefix) => p === prefix || (prefix !== "/" && p.startsWith(`${prefix}/`)),
  );
}

export function resolveSurfaceRedirect(
  pathname: string,
  search = "",
  context?: RedirectDecisionContext,
): string | null {
  const normalizedPath = pathname.toLowerCase();
  const standalone = context?.standalone ?? isStandaloneApp({ search });
  const surfaceMode = context?.surfaceMode ?? getSurfaceMode({ search });
  const relatto = context?.relattoProfile ?? isRelattoActiveProfile(search);

  // 1. Dispositivo abrindo pelo ícone instalado (standalone):
  // A Landing Page e a tela /baixar nunca devem aparecer dentro do App instalado;
  // o ícone leva direto para o sistema (/app -> /login se deslogado, ou painel se logado).
  if (standalone) {
    if (
      normalizedPath === "/" ||
      normalizedPath === "/index" ||
      normalizedPath === "/landing" ||
      normalizedPath === "/baixar" ||
      normalizedPath === "/relatto"
    ) {
      return relatto || normalizedPath === "/relatto" ? "/consultor" : "/app";
    }
    return null;
  }

  // 2. O App pode ser aberto no navegador: /login e rotas operacionais
  // não dependem de display-mode: standalone. Login e ProtectedRoute mantêm
  // autenticação e autorização por papel.
  if (surfaceMode === "app") return null;

  // 3. Superfície exclusiva do Site institucional (VITE_SURFACE_MODE=site):
  // Rotas autenticadas não rodam no domínio do site; encaminham para baixar o App.
  if (surfaceMode === "site") {
    if (!isPublicSitePath(normalizedPath)) {
      const brand: AppBrandId =
        relatto || normalizedPath.startsWith("/consultor")
          ? "relatto"
          : "consubov";
      return getDownloadAppHref(brand, context?.appBaseUrl);
    }
    return null;
  }

  return null;
}
