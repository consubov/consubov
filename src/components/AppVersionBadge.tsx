import { APP_VERSION } from "@/lib/appVersion";

/**
 * Etiqueta fixa exibida em todas as telas com o número da versão do app.
 * Posicionada no canto superior direito com alto z-index para ficar sempre
 * visível e permitir que usuários confiram se estão na mesma versão.
 */
export function AppVersionBadge() {
  return (
    <div
      aria-label={`Versão do app ${APP_VERSION}`}
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.625rem)" }}
      className="fixed right-3 z-[100] pointer-events-none select-none rounded-full bg-foreground/90 text-background px-2 py-0.5 text-[11px] font-mono font-semibold shadow-md"
    >
      v{APP_VERSION}
    </div>
  );
}
