import { defineConfig, devices } from "@playwright/test";
import { APP_VERSION } from "./src/lib/appVersion";

// CONSUBOV Fazendas: never run release validation against a downgraded app.
const version = APP_VERSION.match(/^(\d+)\.(\d+)\.(\d+)$/);
if (!version || Number(version[1]) < 2) {
  throw new Error(`CONSUBOV Fazendas 2.0.0 release floor violated: ${APP_VERSION}`);
}

// Separate config keeps the site's E2E suite unchanged and ensures this test
// runs in the APP surface, not the default unified/site development mode.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "browser-login-direct.spec.ts",
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://127.0.0.1:18080",
    channel: "chromium",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "bun run dev -- --host 127.0.0.1 --port 18080 --strictPort",
    url: "http://127.0.0.1:18080/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_SURFACE_MODE: "app" },
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 5"] } },
  ],
});
