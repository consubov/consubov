import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import {
  SupportedLanguage,
  normalizeLanguage,
  translateKey
} from '@consubov/contracts';

const STORAGE_KEY = 'consubov:app-language';

export interface I18nContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, fallback?: string) => string;
}

export const I18nContext = createContext<I18nContextValue>({
  language: 'pt-BR',
  setLanguage: () => {},
  t: (key, fallback) => translateKey('pt-BR', key, fallback)
});

function getInitialLanguage(): SupportedLanguage {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return normalizeLanguage(window.localStorage.getItem(STORAGE_KEY));
    }
  } catch {
    // Fallback silencioso para ambientes sem localStorage
  }
  return 'pt-BR';
}

export interface I18nProviderProps {
  children: ReactNode;
  defaultLanguage?: SupportedLanguage;
}

export function I18nProvider({ children, defaultLanguage }: I18nProviderProps) {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    return defaultLanguage ?? getInitialLanguage();
  });

  // Sincronização reativa cross-tab via storage event
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        setLanguageState(normalizeLanguage(event.newValue));
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Atualiza atributo lang no HTML da página
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const setLanguage = useCallback((nextLang: SupportedLanguage) => {
    const valid = normalizeLanguage(nextLang);
    setLanguageState(valid);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, valid);
      }
    } catch {
      // Storage opcional
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) => {
      return translateKey(language, key, fallback);
    },
    [language]
  );

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  return useContext(I18nContext);
}
