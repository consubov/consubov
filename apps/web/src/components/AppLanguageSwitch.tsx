import { useLocation } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";

/** App-only selector: no dependency on the public site's interface bundle. */
export function AppLanguageSwitch() {
  const { pathname } = useLocation();
  const { language, setLanguage } = useTranslation();
  if (import.meta.env.VITE_SURFACE_MODE === "site" || ["/", "/landing", "/baixar", "/relatto"].includes(pathname) || pathname.startsWith("/relatto/")) return null;
  return (
    <div role="group" aria-label="Idioma / Language" data-testid="app-language-switch" className="fixed right-2 bottom-[calc(env(safe-area-inset-bottom,0px)+5rem)] z-30 flex gap-1 rounded-full border bg-background p-1 shadow-md sm:bottom-3">
      <button type="button" lang="pt-BR" title="Português (Brasil)" aria-label="Português (Brasil)" aria-pressed={language === "pt-BR"} onClick={() => setLanguage("pt-BR")} className="rounded-full px-2 py-1 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground">🇧🇷</button>
      <button type="button" lang="en-US" title="English (United States)" aria-label="English (United States)" aria-pressed={language === "en-US"} onClick={() => setLanguage("en-US")} className="rounded-full px-2 py-1 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground">🇺🇸</button>
    </div>
  );
}
