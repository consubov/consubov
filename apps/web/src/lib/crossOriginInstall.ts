/**
 * Instala o aplicativo no domínio do App a partir do site institucional.
 * Não tenta instalar a PWA do próprio site e não redireciona automaticamente.
 * API experimental: só executa quando o navegador oferece navigator.install.
 */
export const CONSUBOV_INSTALL_MANIFEST =
  "https://app.consubov.com.br/manifest-consubov-v2.json";
export const CONSUBOV_INSTALL_ID = "https://app.consubov.com.br/";

export type CrossOriginInstallResult =
  | "installed"
  | "dismissed"
  | "unsupported"
  | "failed";

export interface CrossOriginInstallNavigator {
  install?: (options: {
    manifest: string;
    manifestId: string;
  }) => Promise<unknown>;
}

export async function requestConsubovCrossOriginInstall(
  browser: CrossOriginInstallNavigator,
): Promise<CrossOriginInstallResult> {
  if (typeof browser.install !== "function") return "unsupported";

  try {
    // Deve ser invocado diretamente a partir do clique para manter a ativação do usuário.
    await browser.install({
      manifest: CONSUBOV_INSTALL_MANIFEST,
      manifestId: CONSUBOV_INSTALL_ID,
    });
    return "installed";
  } catch (error) {
    // Cancelar o diálogo não é falha e nunca deve abrir outra página.
    if (
      error !== null &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "AbortError"
    ) return "dismissed";
    return "failed";
  }
}
