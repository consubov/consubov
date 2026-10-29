import { SITE_EN, SITE_PHRASES_EN, type SiteLanguage } from "./siteLanguage";

// Expansion plan:
// 1. Create a central dictionary for all app screens.
// 2. Utilize a consistent translation hook across all React components.

export const APP_TRANSLATIONS: Record<SiteLanguage, Record<string, string>> = {
  "pt-BR": {
    "welcome": "Bem-vindo",
    "logout": "Sair",
    "save": "Salvar",
  },
  "en-US": {
    "welcome": "Welcome",
    "logout": "Logout",
    "save": "Save",
  }
};
