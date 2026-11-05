import {defineConfig,devices} from "@playwright/test";
export default defineConfig({
  testDir:".",testMatch:"pwa-auto-registration.spec.ts",timeout:60000,workers:1,retries:0,reporter:"list",
  use:{baseURL:"http://127.0.0.1:18184",serviceWorkers:"allow",trace:"retain-on-failure"},
  webServer:{cwd:process.env.PWA_PREVIEW_DIR||new URL("../",import.meta.url).pathname,command:"./node_modules/.bin/vite preview --host 127.0.0.1 --port 18184 --strictPort",url:"http://127.0.0.1:18184/baixar",reuseExistingServer:false,timeout:90000},
  projects:[{name:"installed-chromium-mobile",use:{...devices["Pixel 5"]}}],
});
