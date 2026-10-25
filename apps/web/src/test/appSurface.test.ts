import { describe, expect, it, beforeEach } from "vitest";

// Fallback/polyfill defensivo para ambientes de teste sem DOM completo (ex: bun test / node direto)
if (typeof window === "undefined") {
  const sessionMap = new Map<string, string>();
  const localMap = new Map<string, string>();
  const makeStorage = (store: Map<string, string>) => ({
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  });
  const classListSet = new Set<string>();
  const globalScope = globalThis as unknown as Record<string, unknown>;
  globalScope.window = {
    sessionStorage: makeStorage(sessionMap),
    localStorage: makeStorage(localMap),
    location: {
      search: "",
      hostname: "localhost",
      pathname: "/",
    },
    navigator: {
      standalone: false,
    },
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  };
  globalScope.document = {
    referrer: "",
    documentElement: {
      classList: {
        add: (cls: string) => classListSet.add(cls),
        remove: (cls: string) => classListSet.delete(cls),
        contains: (cls: string) => classListSet.has(cls),
      },
    },
  };
}

import {
  clearAppInstalledMark,
  detectInstalledAppAsync,
  getDownloadAppHref,
  getSurfaceMode,
  isAppInstalledOnDevice,
  isStandaloneApp,
  markAppInstalled,
  resolveSurfaceRedirect,
} from "@/lib/appSurface";

describe("appSurface — separação Site vs App e acesso exclusivo pelo ícone instalado", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    clearAppInstalledMark("consubov");
    clearAppInstalledMark("relatto");
    document.documentElement.classList.remove("app-standalone");
  });

  it("gera o link de download do App Consubov e Relatto sem mencionar PWA", () => {
    expect(getDownloadAppHref("consubov", "")).toBe("/baixar");
    expect(getDownloadAppHref("relatto", "")).toBe("/baixar?app=relatto");
    expect(getDownloadAppHref("consubov", "https://app.consubov.com.br/")).toBe(
      "https://app.consubov.com.br/baixar",
    );
    expect(getDownloadAppHref("relatto", "https://app.consubov.com.br")).toBe(
      "https://app.consubov.com.br/baixar?app=relatto",
    );
  });

  it("detecta o modo de superfície pelo subdomínio app.* ou query ?surface=", () => {
    expect(
      getSurfaceMode({
        hostname: "app.consubov.com.br",
        search: "",
        envMode: "",
      }),
    ).toBe("app");

    expect(
      getSurfaceMode({
        hostname: "consubov.com.br",
        search: "",
        envMode: "site",
      }),
    ).toBe("site");

    expect(
      getSurfaceMode({
        hostname: "localhost",
        search: "?surface=app",
        envMode: "",
      }),
    ).toBe("app");

    expect(
      getSurfaceMode({
        hostname: "127.0.0.1",
        search: "",
        envMode: "",
      }),
    ).toBe("unified");
  });

  it("detecta quando o App foi aberto pelo ícone instalado no dispositivo (standalone)", () => {
    expect(
      isStandaloneApp({
        standaloneMedia: true,
        navigatorStandalone: false,
        referrer: "",
        search: "",
      }),
    ).toBe(true);

    window.sessionStorage.clear();
    expect(
      isStandaloneApp({
        standaloneMedia: false,
        navigatorStandalone: true,
        referrer: "",
        search: "",
      }),
    ).toBe(true);

    window.sessionStorage.clear();
    expect(
      isStandaloneApp({
        standaloneMedia: false,
        navigatorStandalone: false,
        referrer: "android-app://com.consubov.app",
        search: "",
      }),
    ).toBe(true);
  });

  it("identifica quando o App já foi instalado no dispositivo para evitar instalação duplicada", async () => {
    expect(isAppInstalledOnDevice("consubov")).toBe(false);
    expect(isAppInstalledOnDevice("relatto")).toBe(false);

    markAppInstalled("consubov");
    expect(isAppInstalledOnDevice("consubov")).toBe(true);
    expect(isAppInstalledOnDevice("relatto")).toBe(false);
    expect(await detectInstalledAppAsync("consubov")).toBe(true);

    markAppInstalled("relatto");
    expect(isAppInstalledOnDevice("relatto")).toBe(true);

    clearAppInstalledMark("consubov");
    expect(isAppInstalledOnDevice("consubov")).toBe(false);
  });

  it("bloqueia acesso na aba do navegador quando na superfície do App (app.*) e redireciona para /baixar", () => {
    const redirectLogin = resolveSurfaceRedirect("/login", "", {
      surfaceMode: "app",
      standalone: false,
      relattoProfile: false,
    });
    expect(redirectLogin).toBe("/baixar");

    const redirectRoot = resolveSurfaceRedirect("/", "", {
      surfaceMode: "app",
      standalone: false,
      relattoProfile: false,
    });
    expect(redirectRoot).toBe("/baixar");

    const redirectBaixar = resolveSurfaceRedirect("/baixar", "", {
      surfaceMode: "app",
      standalone: false,
      relattoProfile: false,
    });
    expect(redirectBaixar).toBeNull();
  });

  it("abre diretamente no sistema (/app ou /consultor) quando acionado pelo ícone instalado (standalone)", () => {
    const redirectFromRoot = resolveSurfaceRedirect("/", "", {
      surfaceMode: "app",
      standalone: true,
      relattoProfile: false,
    });
    expect(redirectFromRoot).toBe("/app");

    // The explicit /baixar invitation must show the new 2.0 installer,
    // even if an earlier application is already running standalone.
    const redirectFromBaixar = resolveSurfaceRedirect("/baixar", "", {
      surfaceMode: "app",
      standalone: true,
      relattoProfile: false,
    });
    expect(redirectFromBaixar).toBeNull();

    const redirectRelatto = resolveSurfaceRedirect("/", "", {
      surfaceMode: "app",
      standalone: true,
      relattoProfile: true,
    });
    expect(redirectRelatto).toBe("/consultor");

    const allowLoginInStandalone = resolveSurfaceRedirect("/login", "", {
      surfaceMode: "app",
      standalone: true,
      relattoProfile: false,
    });
    expect(allowLoginInStandalone).toBeNull();
  });

  it("bloqueia rotas internas do sistema quando na superfície exclusiva do Site institucional", () => {
    const redirectLoginOnSite = resolveSurfaceRedirect("/login", "", {
      surfaceMode: "site",
      standalone: false,
      relattoProfile: false,
    });
    expect(redirectLoginOnSite).toBe("/baixar");

    const allowLandingOnSite = resolveSurfaceRedirect("/", "", {
      surfaceMode: "site",
      standalone: false,
      relattoProfile: false,
    });
    expect(allowLandingOnSite).toBeNull();
  });
});
