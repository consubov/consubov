import React from 'react';
import { useTranslation } from './I18nContext';
import { SupportedLanguage } from '@consubov/contracts';
import { colorTokens } from '../tokens/colors';
import { spacingTokens } from '../tokens/spacing';

export interface LanguageSwitchProps {
  className?: string;
  style?: React.CSSProperties;
}

export const LanguageSwitch: React.FC<LanguageSwitchProps> = ({ className, style }) => {
  const { language, setLanguage, t } = useTranslation();

  return (
    <aside
      aria-label={t('shell.header.languageAria', 'Idioma / Language')}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        ...style
      }}
    >
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
        aria-label={t('shell.header.languageAria', 'Idioma / Language')}
        style={{
          minHeight: spacingTokens.touch.inputHeightPx,
          minWidth: 120,
          padding: '6px 12px',
          borderRadius: 8,
          border: `1px solid ${colorTokens.surface.borderStrong}`,
          backgroundColor: colorTokens.surface.card,
          color: colorTokens.text.primary,
          fontSize: '0.875rem',
          fontWeight: 600,
          cursor: 'pointer',
          outline: 'none',
          touchAction: 'manipulation'
        }}
      >
        <option value="pt-BR">🇧🇷 Português</option>
        <option value="en-US">🇺🇸 English</option>
      </select>
    </aside>
  );
};
