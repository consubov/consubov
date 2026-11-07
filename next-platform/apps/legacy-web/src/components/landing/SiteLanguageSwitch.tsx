import type { SiteLanguage } from "@/lib/siteLanguage";

interface SiteLanguageSwitchProps {
  language: SiteLanguage;
  onChange: (next: SiteLanguage) => void;
  mode?: "dark" | "light";
  compactOnMobile?: boolean;
}

/** Vector flags render consistently even where emoji country flags are unavailable. */
function BrazilianFlag() {
  return (
    <svg
      data-testid="site-flag-br"
      viewBox="0 0 36 24"
      width="26"
      height="18"
      aria-hidden="true"
      focusable="false"
      className="block shrink-0 overflow-hidden rounded-[2px] shadow-sm"
    >
      <rect width="36" height="24" fill="#009739" />
      <path d="M18 2 L34 12 L18 22 L2 12 Z" fill="#FFDF00" />
      <circle cx="18" cy="12" r="7" fill="#002776" />
      <path d="M11.2 10.8 Q17.2 9.5 24.5 14" stroke="#FFFFFF" strokeWidth="1.3" fill="none" />
    </svg>
  );
}

function UnitedStatesFlag() {
  const stripeHeight = 24 / 13;
  return (
    <svg
      data-testid="site-flag-us"
      viewBox="0 0 36 24"
      width="26"
      height="18"
      aria-hidden="true"
      focusable="false"
      className="block shrink-0 overflow-hidden rounded-[2px] shadow-sm"
    >
      <rect width="36" height="24" fill="#FFFFFF" />
      {Array.from({ length: 7 }, (_, index) => (
        <rect key={index} y={index * 2 * stripeHeight} width="36" height={stripeHeight} fill="#B22234" />
      ))}
      <rect width="15.3" height={stripeHeight * 7} fill="#3C3B6E" />
      {Array.from({ length: 9 }, (_, row) =>
        Array.from({ length: row % 2 === 0 ? 6 : 5 }, (_, col) => (
          <circle
            key={row + "-" + col}
            cx={(row % 2 === 0 ? 1.4 : 2.7) + col * 2.5}
            cy={0.8 + row * 1.42}
            r="0.36"
            fill="#FFFFFF"
          />
        )),
      )}
    </svg>
  );
}

const LANGUAGES = [
  { id: "pt-BR", title: "Português (Brasil)", Flag: BrazilianFlag },
  { id: "en-US", title: "English (United States)", Flag: UnitedStatesFlag },
] as const;

/** The same accessible controls in both site brands; colors stay brand-specific. */
export function SiteLanguageSwitch({
  language,
  onChange,
  mode = "dark",
  compactOnMobile = false,
}: SiteLanguageSwitchProps) {
  const light = mode === "light";
  return (
    <div
      role="group"
      aria-label="Idioma / Language"
      className={
        "inline-flex shrink-0 items-center gap-0.5 rounded-full border p-0.5 " +
        (light ? "border-neutral-200 bg-neutral-50" : "border-white/25 bg-black/40")
      }
    >
      {LANGUAGES.map(({ id, title, Flag }) => (
        <button
          key={id}
          type="button"
          lang={id}
          aria-label={title}
          aria-pressed={language === id}
          title={title}
          onClick={() => onChange(id)}
          className={
            (compactOnMobile ? "inline-flex h-6 w-6 min-[375px]:h-7 min-[375px]:w-7 sm:h-8 sm:w-8" : "inline-flex h-8 w-8") +
            " items-center justify-center rounded-full transition-colors " +
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500 " +
            (language === id
              ? (light ? "bg-white shadow-sm ring-1 ring-neutral-300" : "bg-white/25 ring-1 ring-white/50")
              : "opacity-75 hover:opacity-100")
          }
        >
          <Flag />
        </button>
      ))}
    </div>
  );
}
