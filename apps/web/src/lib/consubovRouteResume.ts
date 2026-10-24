const LAST_ROUTE_KEY = "consubov:resume-route:v2";
const ROLE_PREFIXES: Record<string, string[]> = {
  administrador: ["/admin", "/dashboard/", "/conferencia", "/mapa/"],
  gerente: ["/gerente", "/dashboard/", "/conferencia", "/mapa/"],
  capataz: ["/capataz", "/mapa/"],
  escritorio: ["/escritorio"],
  operador_fabrica: ["/fabrica"],
  consultor: [], // out of scope
  pesador: ["/pesador"],
  pecuarista: ["/pecuarista"],
  syncvet: [], // out of scope
};
type SavedRoute = { userId: string; role: string; path: string };

export function eligible(path: string, role: string | null | undefined): boolean {
  if (!role || !path.startsWith("/") || path.startsWith("//") || path.includes("\\"))
    return false;
  if (path.includes("#") || /[\r\n]/.test(path)) return false;
  const pathname = path.split("?")[0];
  return (ROLE_PREFIXES[role] ?? []).some(prefix =>
    prefix.endsWith("/") ? pathname.startsWith(prefix) :
      pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

export function rememberConsubovResumeRoute(userId: string, role: string, path: string): void {
  if (!userId || !eligible(path, role) || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_ROUTE_KEY, JSON.stringify({ userId, role, path } satisfies SavedRoute));
  } catch { /* unavailable */ }
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

