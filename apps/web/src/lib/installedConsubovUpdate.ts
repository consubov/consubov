/**
 * Show the in-place update action inside the installed Consubov App.
 * Not a cross-origin migration or installation detector.
 */
export function shouldShowInstalledConsubovUpdate(
  pathname: string,
  standalone: boolean,
  relattoProfile = false,
): boolean {
  if (!standalone) return false;
  const path = pathname.toLowerCase();
  if (["/", "/index", "/landing", "/baixar", "/relatto"].includes(path)) return false;
  if (
    path.startsWith("/relatto/") ||
    path === "/consultor" || path.startsWith("/consultor/") ||
    path === "/syncvet" || path.startsWith("/syncvet/")
  ) return false;
  // /app and /login can be shared with Relatto while it is the active profile.
  if (relattoProfile && (path === "/app" || path === "/login")) return false;
  return true;
}
