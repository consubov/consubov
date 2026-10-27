import type { SiteLanguage } from "@/lib/siteLanguage";

interface SiteLanguageSwitchProps {
  language: SiteLanguage;
  onChange: (next: SiteLanguage) => void;
  mode?: "dark" | "light";
}

const LANGUAGES = [
  { id: "pt-BR", flag: "🇧🇷", title: "Português (Brasil)" },
  { id: "en-US", flag: "🇺🇸", title: "English (United States)" },
] as const;

/** Accessible language switcher. It never reloads the page or changes app state. */
export function SiteLanguageSwitch({
  language,
  onChange,
  mode = "dark",
}: SiteLanguageSwitchProps) {
  const light = mode === "light";
  return (
    <div
      role="group"
      aria-label="Idioma / Language"
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border p-0.5 ${light ? "border-neutral-200 bg-neutral-50" : "border-white/25 bg-black/40"}`}
    >
      {LANGUAGES.map(({ id, flag, title }) => (
        <button
          key={id}
          type="button"
          lang={id}
          aria-label={title}
          aria-pressed={language === id}
          title={title}
          onClick={() => onChange(id)}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500 ${language === id ? (light ? "bg-white shadow-sm ring-1 ring-neutral-300" : "bg-white/25 ring-1 ring-white/50") : "opacity-65 hover:opacity-100"}`}
        >
          <span aria-hidden="true">{flag}</span>
        </button>
      ))}
    </div>
  );
}
