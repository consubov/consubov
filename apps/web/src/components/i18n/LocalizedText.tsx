import { useCallback, useRef } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import type { SiteLanguage } from "@/lib/siteLanguage";
import STATIC_UI_EN from "@/lib/staticUiEnglish.json";

/** Translate only reviewed interface copy, never user-entered, API or database values. */
export function translateStaticUiText(language: SiteLanguage, source: string): string {
  return language === "en-US" && Object.prototype.hasOwnProperty.call(STATIC_UI_EN, source)
    ? STATIC_UI_EN[source as keyof typeof STATIC_UI_EN]
    : source;
}

/** For static JSX attributes such as placeholders, titles and accessible labels. */
export function useStaticUiText() {
  const { language } = useTranslation();
  // A stable translator also works inside long-lived offline and sync callbacks.
  // Updating the ref during render keeps translated attributes current on this render.
  const languageRef = useRef(language);
  languageRef.current = language;
  return useCallback((source: string) => translateStaticUiText(languageRef.current, source), []);
}

/** Translates author-controlled JSX copy only. Never wrap API/user-provided values. */
export function LocalizedText({ source }: { source: string }) {
  const { language } = useTranslation();
  return translateStaticUiText(language, source);
}
