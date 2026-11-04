import React from 'react';
import { useTranslation } from './I18nContext';
import { SupportedLanguage } from '@consubov/contracts';

export interface LanguageSwitchProps {
  className?: string;
  selectClassName?: string;
}

/**
 * Seletor bilingue de idioma para cabeçalhos e menus da plataforma CONSUBOV.
 * Suporta pt-BR e en-US com persistência local e acessibilidade.
 */
export function LanguageSwitch({ className, selectClassName }: LanguageSwitchProps) {
  const { language, setLanguage } = useTranslation();

  return (
    <aside
      aria-label="Idioma / Language"
      data-testid="app-language-switch"
      className={className ?? 'inline-flex items-center'}
    >
      <select
        aria-label="Idioma / Language"
        className={
          selectClassName ??
          'rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm focus:border-green-600 focus:outline-none'
        }
        value={language}
        onChange={e => setLanguage(e.target.value as SupportedLanguage)}
      >
        <option value="pt-BR">🇧🇷 Português</option>
        <option value="en-US">🇺🇸 English</option>
      </select>
    </aside>
  );
}
