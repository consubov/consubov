import { defineConfig, devices } from "@playwright/test";

// Keep the default CI port, but let isolated local runners reserve a free port.
const selectedPort = process.env.CONSUBOV_E2E_PORT === undefined ? 8080 : Number(process.env.CONSUBOV_E2E_PORT);
if (!Number.isSafeInteger(selectedPort) || selectedPort < 1024 || selectedPort > 65535) {
  throw new Error('CONSUBOV_E2E_PORT must be a valid nonprivileged TCP port');
}
const localOrigin = `http://127.0.0.1:${selectedPort}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  // Bound local browser load; each UI scenario keeps its original deadline.
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: localOrigin,
    // Align the full Chromium suite with the installed Chromium channel.
    channel: "chromium",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `bun run dev -- --host 127.0.0.1 --port ${selectedPort} --strictPort`,
    url: `${localOrigin}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: "chromium-mobile", use: { ...devices["Pixel 5"] } },
  ],
});
