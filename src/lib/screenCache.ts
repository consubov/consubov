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

/** Escopos que dependem de pastos.num_animais (Painel da Fazenda). */
const PASTOS_SCOPES = ["gerente", "painelExtra"];

/** Remove de imediato as entradas desses escopos (próxima abertura busca do banco). */
export function dropScreenCacheScopes(scopes: string[]) {
  for (const k of Array.from(store.keys())) {
    if (scopes.some((sc) => k.startsWith(`${sc}|`))) store.delete(k);
  }
}

/**
 * Chamar depois de qualquer gravação. As telas abertas buscam de novo em
 * segundo plano; as demais sempre revalidam ao abrir, então os dados
 * guardados servem só para mostrar algo na hora, sem piscar.
 */
let invalidateTimer: number | null = null;
export function invalidateScreenCache() {
  if (typeof window === "undefined") return;
  if (invalidateTimer !== null) window.clearTimeout(invalidateTimer);
  invalidateTimer = window.setTimeout(() => {
    invalidateTimer = null;
    window.dispatchEvent(new Event(INVALIDATE_EVENT));
  }, 300);
}

/**
 * Detecta qualquer gravação no banco (POST/PATCH/PUT/DELETE em /rest/v1, exceto
 * consultas rpc) e invalida o cache. Não altera a requisição em si.
 */
let writeHookInstalled = false;
export function installWriteInvalidation() {
  if (writeHookInstalled || typeof window === "undefined" || typeof window.fetch !== "function") return;
  writeHookInstalled = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await original(input, init);
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (res.ok && method !== "GET" && method !== "HEAD" && url.includes("/rest/v1/") && !url.includes("/rest/v1/rpc/")) {
        if (url.includes("/rest/v1/pastos")) dropScreenCacheScopes(PASTOS_SCOPES);
        invalidateScreenCache();
      }
    } catch { /* ignore */ }
    return res;
  };
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
