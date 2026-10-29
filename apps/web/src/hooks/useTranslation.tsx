import { useContext, createContext } from "react";
import type { SiteLanguage } from "../lib/siteLanguage";

interface I18nContextType {
  language: SiteLanguage;
  t: (key: string) => string;
}

export const I18nContext = createContext<I18nContextType>({
  language: "pt-BR",
  t: (key) => key,
});

export const useTranslation = () => useContext(I18nContext);
