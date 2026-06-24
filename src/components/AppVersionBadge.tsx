import { APP_VERSION } from "@/lib/appVersion";

/**
 * Pequena etiqueta fixa exibida em todas as telas com o número da versão do app.
 * Permite que todos os usuários verifiquem rapidamente se estão na mesma versão.
 */
export function AppVersionBadge() {
  return (
    <div
      aria-label={`Versão do app ${APP_VERSION}`}
      className="fixed bottom-1 left-1 z-[40] pointer-events-none select-none rounded-md bg-background/70 backdrop-blur px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/80 border border-border/50"
    >
      v{APP_VERSION}
    </div>
  );
}
