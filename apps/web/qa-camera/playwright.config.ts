import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "photo-capture-browser.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: "list",
  projects: [
    { name: "camera-chromium", use: { ...devices["Pixel 5"] } },
    { name: "camera-webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
