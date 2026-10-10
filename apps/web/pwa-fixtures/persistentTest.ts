import { test as base } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export { expect } from "@playwright/test";
export type { Page } from "@playwright/test";

/**
 * Installed-PWA scenarios need a real persistent profile, not an incognito
 * context. WebKit's ephemeral IndexedDB rejects Blob/File writes. Each test
 * still receives its own isolated profile; no real customer storage is opened.
 */
export const test = base.extend({
  context: async ({ playwright, browserName, contextOptions }, provide) => {
    const profile = await mkdtemp(join(tmpdir(), "consubov-pwa-profile-"));
    try {
      const context = await playwright[browserName].launchPersistentContext(profile, {
        ...contextOptions, headless: true,
      });
      try {
        // Playwright Test owns trace recording, including persistent contexts.
        await provide(context);
      } finally { await context.close(); }
    } finally { await rm(profile, { recursive: true, force: true }); }
  },
});
