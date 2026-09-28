import { useEffect, useRef } from "react";

/**
 * Cache em memória das telas do Gerente/Admin (não usado pelo Capataz).
 * A chave sempre inclui todos os filtros da busca (fazenda, retiro, mês, ano…)
 * para nunca mostrar dados de um filtro em outro.
 */
const store = new Map<string, unknown>();
const INVALIDATE_EVENT = "consubov:screen-cache-invalidated";

export function screenCacheKey(scope: string, parts: Array<string | number | null | undefined>) {
  return `${scope}|${parts.map((p) => (p == null ? "-" : String(p))).join("|")}`;
}

export function getScreenCache<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function setScreenCache<T>(key: string, value: T) {
  store.set(key, value);
}

/** Chamar depois de qualquer gravação que mude os dados das telas. */
export function invalidateScreenCache() {
  store.clear();
  if (typeof window !== "undefined") window.dispatchEvent(new Event(INVALIDATE_EVENT));
}

/** Telas montadas recarregam em segundo plano quando o cache é invalidado. */
export function useScreenCacheInvalidation(cb: () => void) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    const h = () => ref.current();
    window.addEventListener(INVALIDATE_EVENT, h);
    return () => window.removeEventListener(INVALIDATE_EVENT, h);
  }, []);
}

const RESUME_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Junta focus/visibilitychange/pageshow num único gatilho. Só atualiza se o
 * app ficou mais de 5 minutos em segundo plano.
 */
export function useResumeRefresh(cb: () => void, enabled = true) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!enabled) return;
    let hiddenAt: number | null = document.visibilityState === "hidden" ? Date.now() : null;
    const onHide = () => { if (hiddenAt == null) hiddenAt = Date.now(); };
    const onShow = () => {
      if (document.visibilityState !== "visible" || hiddenAt == null) return;
      const away = Date.now() - hiddenAt;
      hiddenAt = null;
      if (away >= RESUME_THRESHOLD_MS) ref.current();
    };
    const onVis = () => (document.visibilityState === "hidden" ? onHide() : onShow());
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("focus", onShow);
    window.addEventListener("pageshow", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("focus", onShow);
      window.removeEventListener("pageshow", onShow);
    };
  }, [enabled]);
}
