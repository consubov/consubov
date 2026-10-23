import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * Consubov only: restore a route after an authenticated cold start.
 * Never restore a route from another account or from a different product.
 * This does not persist unsaved form contents or authentication credentials.
 */
import { eligible, clearConsubovResumeRoute, rememberConsubovResumeRoute } from "@/lib/consubovRouteResume";

const SCROLL_PREFIX = "consubov:scroll:";

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
    if (role) rememberConsubovResumeRoute(identity, role, fullPath);
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
