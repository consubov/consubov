import { test as base } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export { expect } from "@playwright/test";
export type { Page } from "@playwright/test";

/**
 * Remove com resiliência o diretório de perfil temporário no Windows NTFS.
 * Suporta retries nativos do Node e backoff incremental para mitigar locks
 * assíncronos de antivírus, indexadores e handles residuais de log.
 */
async function safeRemoveProfile(profilePath: string): Promise<void> {
  const maxAttempts = 5;
  const initialDelayMs = 150;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await rm(profilePath, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
      return;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      const isLock = code === "EBUSY" || code === "EPERM" || code === "ENOTEMPTY";
      if (isLock && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, initialDelayMs * attempt));
        continue;
      }
      // Se persistir lock em %TEMP%, registra aviso não-bloqueante;
      // o teste em si já foi validado com sucesso e o SO fará a limpeza do scratch.
      console.warn(`[persistentTest] Temporary profile cleanup deferred for ${profilePath}:`, (err as Error)?.message);
      return;
    }
  }
}

/**
 * Installed-PWA scenarios need a real persistent profile, not an incognito
 * context. WebKit's ephemeral IndexedDB rejects Blob/File writes. Each test
 * still receives its own isolated profile; no real customer storage is opened.
 */
export const test = base.extend({
  context: async ({ playwright, browserName, contextOptions }, provide) => {
    const profile = await mkdtemp(join(tmpdir(), "consubov-pwa-profile-"));
    const chromeArgs = browserName === "chromium"
      ? ["--disable-logging", "--log-level=3"]
      : [];

    const context = await playwright[browserName].launchPersistentContext(profile, {
      ...contextOptions,
      headless: true,
      args: [
        ...(contextOptions?.args ?? []),
        ...chromeArgs,
      ],
    });

    try {
      await provide(context);
    } finally {
      // 1. Fechamento ordenado de abas abertas antes do encerramento do contexto
      try {
        const pages = context.pages();
        for (const page of pages) {
          if (!page.isClosed()) {
            await page.close().catch(() => {});
          }
        }
      } catch {
        // Ignora erros concorrentes de fechamento de páginas no teardown
      }

      // 2. Fechamento seguro do contexto (tolerante a race conditions de traces no Windows)
      try {
        await context.close();
      } catch (closeErr) {
        console.warn("[persistentTest] Warning during context.close:", (closeErr as Error)?.message);
      }

      // 3. Limpeza resiliente do perfil temporário
      await safeRemoveProfile(profile);
    }
  },
});
