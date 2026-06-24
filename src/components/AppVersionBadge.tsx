import { APP_VERSION } from "@/lib/appVersion";

/**
 * Etiqueta fixa exibida em todas as telas com o número da versão do app.
 * Posicionada no canto inferior direito com alto z-index para ficar sempre
 * visível e permitir que usuários confiram se estão na mesma versão.
 */
export function AppVersionBadge() {
  return (
    <div
      aria-label={`Versão do app ${APP_VERSION}`}
      className="fixed bottom-2 right-2 z-[80] pointer-events-none select-none rounded-full bg-foreground/85 text-background px-2 py-0.5 text-[11px] font-mono font-semibold shadow-md"
    >
      v{APP_VERSION}
    </div>
  );
}
