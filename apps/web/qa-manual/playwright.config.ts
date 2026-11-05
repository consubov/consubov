import {defineConfig,devices} from "@playwright/test";
export default defineConfig({
  testDir:".",testMatch:"manual-browser.spec.ts",timeout:45000,fullyParallel:false,workers:1,retries:0,reporter:"list",
  use:{baseURL:"http://127.0.0.1:18183",trace:"retain-on-failure",screenshot:"only-on-failure"},
  webServer:{cwd:new URL("../",import.meta.url).pathname,command:"./node_modules/.bin/vite --config qa-manual/vite.config.ts",url:"http://127.0.0.1:18183/qa-manual/harness.html",reuseExistingServer:false,timeout:90000},
  projects:[
    {name:"chromium-desktop",use:{...devices["Desktop Chrome"]}},
    {name:"chromium-mobile",use:{...devices["Pixel 5"]}},
  ],
});
