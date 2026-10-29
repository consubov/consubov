import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import type { SiteLanguage } from "@/lib/siteLanguage";

interface BackToTopButtonProps {
  language: SiteLanguage;
  mode?: "dark" | "light";
}

/** Shared behavior for the logo and floating control; respects reduced motion. */
export function scrollToSiteTop() {
  const reducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
}

export function BackToTopButton({ language, mode = "dark" }: BackToTopButtonProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let pendingFrame = 0;
    const onScroll = () => {
      if (pendingFrame) return;
      pendingFrame = window.requestAnimationFrame(() => {
        pendingFrame = 0;
        setVisible(window.scrollY > 400);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (pendingFrame) window.cancelAnimationFrame(pendingFrame);
    };
  }, []);

  if (!visible) return null;

  const label = language === "en-US" ? "Back to top" : "Voltar ao topo";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={scrollToSiteTop}
      className={
        "fixed bottom-5 right-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full " +
        "border shadow-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
        "sm:bottom-7 sm:right-7 " +
        (mode === "light"
          ? "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-100 focus-visible:outline-neutral-900"
          : "border-[#22FF88]/50 bg-[#07150F] text-[#22FF88] hover:bg-[#11271B] focus-visible:outline-[#22FF88]")
      }
    >
      <ArrowUp className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
