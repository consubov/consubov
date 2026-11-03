import { useTranslation } from "@/hooks/useTranslation";
import STATIC_UI_EN from "@/lib/staticUiEnglish.json";

/** Translates author-controlled JSX copy only. Never wrap API/user-provided values. */
export function LocalizedText({ source }: { source: string }) {
  const { language } = useTranslation();
  if (language !== "en-US") return source;
  return Object.prototype.hasOwnProperty.call(STATIC_UI_EN, source)
    ? STATIC_UI_EN[source as keyof typeof STATIC_UI_EN]
    : source;
}
