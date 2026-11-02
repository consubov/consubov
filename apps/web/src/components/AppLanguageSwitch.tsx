import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";

/** Keep language controls within a named landmark for screen readers. */
export function AppLanguageSwitch() {
  const { pathname } = useLocation();
  const { language, setLanguage } = useTranslation();
  const hidden = import.meta.env.VITE_SURFACE_MODE === "site" || ["/", "/landing", "/baixar", "/relatto"].includes(pathname) || pathname.startsWith("/relatto/");
  useEffect(() => {
    if (hidden) return;
    const previous = document.documentElement.lang;
    document.documentElement.lang = language;
    return () => { document.documentElement.lang = previous; };
  }, [hidden, language]);
  if (hidden) return null;
  return <aside aria-label="Idioma / Language" data-testid="app-language-switch" className="sticky top-0 z-[60] flex min-h-10 w-full items-center justify-end border-b border-border bg-background/95 px-3 py-1 pt-[calc(env(safe-area-inset-top,0px)+0.25rem)] text-foreground shadow-sm backdrop-blur">
    <select aria-label="Idioma / Language" className="rounded border bg-background p-2 text-xs" value={language} onChange={event => setLanguage(event.target.value === "en-US" ? "en-US" : "pt-BR")}>
      <option value="pt-BR">🇧🇷 Português</option>
      <option value="en-US">🇺🇸 English</option>
    </select>
  </aside>;
}
