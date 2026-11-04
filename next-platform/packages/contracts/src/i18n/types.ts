export type SupportedLanguage = 'pt-BR' | 'en-US';

export function normalizeLanguage(value: string | null | undefined): SupportedLanguage {
  return value === 'en-US' ? 'en-US' : 'pt-BR';
}
