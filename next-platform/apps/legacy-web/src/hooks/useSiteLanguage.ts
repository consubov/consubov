import { useCallback, useEffect, useState } from "react";
import { normalizeSiteLanguage, type SiteLanguage } from "@/lib/siteLanguage";

const STORAGE_KEY = "consubov:site-language";

function readPreferredLanguage(): SiteLanguage {
  try {
    return normalizeSiteLanguage(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return "pt-BR";
  }
}

/** Language preference belongs to the public site, not the installed app. */
export function useSiteLanguage() {
  const [language, setLanguageState] = useState<SiteLanguage>(readPreferredLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY) setLanguageState(normalizeSiteLanguage(event.newValue));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLanguage = useCallback((next: SiteLanguage) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing and blocked storage still allow switching language.
    }
  }, []);

  return { language, setLanguage };
}
