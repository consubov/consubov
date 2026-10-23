import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * Consubov only: restore a route after an authenticated cold start.
 * Never restore a route from another account or from a different product.
 * This does not persist unsaved form contents or authentication credentials.
 */
const LAST_ROUTE_KEY = "consubov:resume-route:v2";
const SCROLL_PREFIX = "consubov:scroll:";
const ROLE_PREFIXES: Record<string, string[]> = {
  administrador: ["/admin", "/dashboard/", "/conferencia", "/mapa/"],
  gerente: ["/gerente", "/dashboard/", "/conferencia", "/mapa/"],
  capataz: ["/capataz", "/mapa/"],
  escritorio: ["/escritorio"],
  operador_fabrica: ["/fabrica"],
  consultor: [], // Relatto: out of scope
  pesador: ["/pesador"],
  pecuarista: ["/pecuarista"],
  syncvet: [], // Veterinary: out of scope
};
type SavedRoute = { userId: string; role: string; path: string };

function eligible(path: string, role: string | null | undefined): boolean {
  if (!role || !path.startsWith("/") || path.startsWith("//") || path.includes("\\"))
    return false;
  if (path.includes("#") || /[\r\n]/.test(path)) return false;
  const pathname = path.split("?")[0];
  return (ROLE_PREFIXES[role] ?? []).some(prefix =>
    prefix.endsWith("/") ? pathname.startsWith(prefix) :
      pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

export function clearConsubovResumeRoute(): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(LAST_ROUTE_KEY); } catch { /* unavailable */ }
  try { window.sessionStorage.removeItem("consubov:last-route"); } catch { /* legacy */ }
}

export function getConsubovResumeRoute(userId: string, role: string | null): string | null {
  if (!userId || !role || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_ROUTE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as SavedRoute;
    if (value.userId !== userId || value.role !== role || !eligible(value.path, role))
      return null;
    return value.path;
  } catch { return null; }
}

export function RouteMemory() {
  const location = useLocation();
  const { role, roleResolved, user } = useAuth();
  const navType = useNavigationType();
  const fullPath = location.pathname + location.search;
  const identity = user?.id ?? null;
  const previousIdentity = useRef<string | null>(null);

  useEffect(() => {
    if (!roleResolved) return;
    if (!identity) {
      clearConsubovResumeRoute();
      previousIdentity.current = null;
      return;
    }
    if (previousIdentity.current && previousIdentity.current !== identity)
      clearConsubovResumeRoute();
    previousIdentity.current = identity;
    if (!eligible(fullPath, role)) return;
    try {
      window.localStorage.setItem(LAST_ROUTE_KEY, JSON.stringify({
        userId: identity, role, path: fullPath,
      } satisfies SavedRoute));
    } catch { /* storage unavailable */ }
  }, [fullPath, identity, role, roleResolved]);

  // Keep the original scroll restoration behavior without changing the
  // current React page on foreground/background transitions.
  useEffect(() => {
    if (!identity || !eligible(fullPath, role)) return;
    const key = SCROLL_PREFIX + identity + ":" + fullPath;
    let saved = 0;
    if (navType !== "PUSH") {
      try { saved = Number(window.sessionStorage.getItem(key) || 0); } catch { /* unavailable */ }
    }
    let cancelled = false;
    let tries = 0;
    let userScrolled = false;
    const onUserScroll = () => { userScrolled = true; };
    window.addEventListener("touchstart", onUserScroll, { passive: true, once: true });
    window.addEventListener("wheel", onUserScroll, { passive: true, once: true });
    const restore = () => {
      if (cancelled || userScrolled || saved <= 0) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max >= saved || tries > 20) {
        window.scrollTo(0, Math.min(saved, Math.max(max, 0)));
        return;
      }
      tries++;
      window.setTimeout(restore, 100);
    };
    requestAnimationFrame(restore);
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        try { window.sessionStorage.setItem(key, String(Math.round(window.scrollY))); } catch { /* unavailable */ }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchstart", onUserScroll);
      window.removeEventListener("wheel", onUserScroll);
    };
  }, [fullPath, identity, role, navType]);
  return null;
}
