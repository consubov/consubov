import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./pwa-fixtures", timeout: 60000, fullyParallel: false, workers: 1, retries: 0,
  reporter: "list", use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "pwa-chromium", use: { ...devices["Desktop Chrome"], serviceWorkers: "allow" } },
    { name: "pwa-webkit", use: { ...devices["Desktop Safari"], serviceWorkers: "allow" } },
  ],
});
