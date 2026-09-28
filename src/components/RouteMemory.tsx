import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * Memória de tela do Gerente/Admin (não se aplica ao Capataz):
 *  - guarda a última tela (com filtros da URL) e a rolagem de cada tela na sessão;
 *  - ao voltar para uma tela, devolve a rolagem;
 *  - se o app foi aberto do zero (ex.: iPhone descartou da memória) e caiu na
 *    entrada, leva de volta para a última tela.
 */
const LAST_ROUTE_KEY = "consubov:last-route";
const SCROLL_PREFIX = "consubov:scroll:";

const PREFIXES: Record<string, string[]> = {
  gerente: ["/gerente", "/dashboard/", "/conferencia", "/mapa/"],
  administrador: ["/admin", "/dashboard/", "/conferencia", "/mapa/", "/gerente/materias-primas", "/gerente/entrada-materias-primas"],
};

function isTracked(path: string, role: string | null | undefined) {
  if (!role) return false;
  const list = PREFIXES[role];
  return !!list?.some((p) => path.startsWith(p));
}

export function RouteMemory() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, roleResolved } = useAuth();
  const restoredRef = useRef(false);
  const fullPath = location.pathname + location.search;

  // Abertura do zero: restaura a última tela uma única vez.
  useEffect(() => {
    if (restoredRef.current || !roleResolved) return;
    restoredRef.current = true;
    if (location.pathname !== "/" && location.pathname !== "/app") return;
    try {
      const last = sessionStorage.getItem(LAST_ROUTE_KEY);
      if (last && last !== fullPath && isTracked(last.split("?")[0], role)) {
        navigate(last, { replace: true });
      }
    } catch { /* ignore */ }
  }, [roleResolved, role, location.pathname, fullPath, navigate]);

  // Guarda a tela atual e a rolagem; devolve a rolagem ao voltar.
  useEffect(() => {
    if (!isTracked(location.pathname, role)) return;
    try { sessionStorage.setItem(LAST_ROUTE_KEY, fullPath); } catch { /* ignore */ }

    const key = SCROLL_PREFIX + fullPath;
    let saved = 0;
    try { saved = Number(sessionStorage.getItem(key) || 0); } catch { /* ignore */ }

    let cancelled = false;
    let tries = 0;
    let userScrolled = false;
    const onUserScroll = () => { userScrolled = true; };
    window.addEventListener("touchstart", onUserScroll, { passive: true, once: true });
    window.addEventListener("wheel", onUserScroll, { passive: true, once: true });
    // Os dados podem chegar logo depois: tenta por até ~2s até a página ter altura.
    const restore = () => {
      if (cancelled || userScrolled || saved <= 0) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max >= saved || tries > 20) { window.scrollTo(0, Math.min(saved, Math.max(max, 0))); return; }
      tries++;
      window.setTimeout(restore, 100);
    };
    requestAnimationFrame(restore);

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        try { sessionStorage.setItem(key, String(Math.round(window.scrollY))); } catch { /* ignore */ }
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
  }, [fullPath, location.pathname, role]);

  return null;
}
