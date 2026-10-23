/**
 * Troca dinâmica dos metadados de PWA (manifest, apple-touch-icon, theme-color,
 * title) conforme a rota atual. Apenas apresentação — não altera nenhuma
 * funcionalidade de módulo.
 */

import { isRelattoHostname } from "./appSurface";

export interface PwaProfile {
  id: string;
  title: string;
  manifest: string;
  appleIcon: string;
  themeColor: string;
  appleTitle: string;
}

const PROFILES: Record<string, PwaProfile> = {
  consubov: {
    id: "consubov",
    title: "Consubov.app",
    manifest: "/manifest.json",
    appleIcon: "/icon-192.png",
    themeColor: "#1B4332",
    appleTitle: "Consubov",
  },
  relatto: {
    id: "relatto",
    title: "Relatto",
    manifest: "/manifest-relatto.json",
    appleIcon: "/icon-relatto-192.png",
    themeColor: "#1B4332",
    appleTitle: "Relatto",
  },
  maisarrobas: {
    id: "maisarrobas",
    title: "Mais Arrobas",
    manifest: "/manifest-maisarrobas.json",
    appleIcon: "/icon-maisarrobas-192.png",
    themeColor: "#1B4332",
    appleTitle: "Mais Arrobas",
  },
  syncvet: {
    id: "syncvet",
    title: "SyncVet",
    manifest: "/manifest-syncvet.json",
    appleIcon: "/icon-syncvet-192.png",
    themeColor: "#1B4332",
    appleTitle: "SyncVet",
  },
};

export function profileForPath(
  pathname: string,
  hostname = typeof window !== "undefined" ? window.location.hostname : "",
): PwaProfile {
  const p = pathname.toLowerCase();
  const search = typeof window !== "undefined" ? window.location.search.toLowerCase() : "";
  if (
    isRelattoHostname(hostname) ||
    p === "/relatto" ||
    p.startsWith("/relatto/") ||
    p.startsWith("/consultor") ||
    (p === "/baixar" && search.includes("app=relatto"))
  ) {
    return PROFILES.relatto;
  }
  if (
    p.startsWith("/maisarrobas") ||
    p.startsWith("/mais-arrobas") ||
    p.startsWith("/pecuarista") ||
    p.startsWith("/pesador")
  ) {
    return PROFILES.maisarrobas;
  }
  if (p.startsWith("/syncvet")) return PROFILES.syncvet;
  return PROFILES.consubov;
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  if (el.getAttribute("href") !== href) el.setAttribute("href", href);
}

function setMeta(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.name = name;
    document.head.appendChild(el);
  }
  if (el.content !== content) el.content = content;
}

let applied: string | null = null;

// Perfil derivado da URL de entrada. Rotas protegidas redirecionam para /login
// antes da autenticação; nesses casos mantemos o módulo de origem.
const initialProfile =
  typeof window !== "undefined" ? profileForPath(window.location.pathname) : PROFILES.consubov;

export function applyPwaProfile(pathname: string) {
  let profile = profileForPath(pathname);
  if (profile.id === "consubov" && initialProfile.id !== "consubov") {
    profile = initialProfile;
  }
  if (applied === profile.id) return;
  applied = profile.id;

  document.title = profile.title;
  if (profile.id === "relatto") {
    try {
      window.localStorage.setItem("relatto:pwa-profile", "relatto");
    } catch {
      /* ignore */
    }
    try {
      document.cookie = "relatto_pwa_profile=relatto; Max-Age=31536000; Path=/; SameSite=Lax";
    } catch {
      /* ignore */
    }
  }
  setMeta("apple-mobile-web-app-title", profile.appleTitle);
  setMeta("theme-color", profile.themeColor);
  setLink("apple-touch-icon", profile.appleIcon);

  // Remove e recria o link do manifest para forçar o navegador a re-buscar.
  const old = document.head.querySelector('link[rel="manifest"]');
  if (old) old.remove();
  const link = document.createElement("link");
  link.rel = "manifest";
  link.href = profile.manifest;
  document.head.appendChild(link);
}
