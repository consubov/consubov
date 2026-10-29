import { useContext, createContext } from "react";
<<<<<<< HEAD
import type { SiteLanguage } from "../lib/siteLanguage";
=======
import type { SiteLanguage } from "@/lib/siteLanguage";
>>>>>>> origin/fix/site-language-type-import-20261029

interface I18nContextType {
  language: SiteLanguage;
  t: (key: string) => string;
}

export const I18nContext = createContext<I18nContextType>({
  language: "pt-BR",
  t: (key) => key,
});

export const useTranslation = () => useContext(I18nContext);
