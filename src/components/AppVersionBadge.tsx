import { APP_VERSION } from "@/lib/appVersion";

declare const __APP_BUILD_VERSION__: string;

// Sufixo curto derivado do timestamp do build — muda a cada deploy,
// permitindo conferir visualmente se o usuário está rodando a última versão.
const BUILD_SUFFIX = (() => {
  try {
    return __APP_BUILD_VERSION__.slice(-4);
  } catch {
    return "";
  }
})();

const FULL_VERSION = BUILD_SUFFIX ? `${APP_VERSION}.${BUILD_SUFFIX}` : APP_VERSION;

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
        aria-label={`Versão do app ${FULL_VERSION}`}
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.625rem)" }}
        className={`fixed right-3 z-[100] ${base}`}
      >
        v{FULL_VERSION}
      </div>
    );
  }

  return (
    <div aria-label={`Versão do app ${FULL_VERSION}`} className={base}>
      v{FULL_VERSION}
    </div>
  );
}
