import { APP_VERSION } from "@/lib/appVersion";

interface AppVersionBadgeProps {
  floating?: boolean;
}

/**
 * Etiqueta exibida com o número da versão do app.
 * Modo floating: canto superior direito fixo sobre a tela.
 * Modo inline (padrão): entra no fluxo do header sem sobrepor outros elementos.
 */
export function AppVersionBadge({ floating = false }: AppVersionBadgeProps) {
  const base =
    "pointer-events-none select-none rounded-full bg-foreground/90 text-background px-2 py-0.5 text-[11px] font-mono font-semibold shadow-md";

  if (floating) {
    return (
      <div
        aria-label={`Versão do app ${APP_VERSION}`}
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.625rem)" }}
        className={`fixed right-3 z-[100] ${base}`}
      >
        v{APP_VERSION}
      </div>
    );
  }

  return (
    <div aria-label={`Versão do app ${APP_VERSION}`} className={base}>
      v{APP_VERSION}
    </div>
  );
}
