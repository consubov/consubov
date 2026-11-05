export type SupportedLanguage = 'pt-BR' | 'en-US';

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['pt-BR', 'en-US'] as const;

export const DEFAULT_LANGUAGE: SupportedLanguage = 'pt-BR';

export const APP_LANGUAGE_STORAGE_KEY = 'consubov:app-language';

export function normalizeLanguage(value: string | null | undefined): SupportedLanguage {
  return value === 'en-US' ? 'en-US' : 'pt-BR';
}

export type I18nParams = Record<string, string | number>;
