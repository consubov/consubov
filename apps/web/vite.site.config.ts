import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { writeFileSync } from "node:fs";

const buildTimestamp = Date.now().toString();

/**
 * Configuração de build dedicado do Site Institucional (consubov.com.br).
 * Gera o artefato estático isolado em `apps/web/dist-site`, separado do build
 * do App (`apps/web/dist` para o subdomínio `app.consubov.com.br`).
 */
export default defineConfig(() => ({
  envDir: path.resolve(__dirname, "../.."),
  define: {
    __APP_BUILD_VERSION__: JSON.stringify(buildTimestamp),
    "import.meta.env.VITE_SURFACE_MODE": JSON.stringify("site"),
  },
  build: {
    outDir: "dist-site",
    emptyOutDir: true,
  },
  plugins: [
    react(),
    {
      name: "retire-legacy-service-worker-on-site-only",
      transformIndexHtml() {
        // Only the SITE build gets this early listener. An old CSS hash can
        // fail before the main React module mounts.
        return [{
          tag: "script",
          injectTo: "head-prepend" as const,
          children: `(() => {
            let retrying = false;
            window.addEventListener("error", async (event) => {
              const element = event.target;
              if (retrying || !(element instanceof HTMLLinkElement) ||
                  element.rel !== "stylesheet" || !element.href.includes("/assets/")) return;
              const key = "consubov:site-css-retry-at";
              const now = Date.now();
              try {
                if (now - Number(sessionStorage.getItem(key) || 0) < 60000) return;
                sessionStorage.setItem(key, String(now));
              } catch { return; }
              retrying = true;
              try {
                if ("serviceWorker" in navigator) {
                  const registrations = await navigator.serviceWorker.getRegistrations();
                  const origin = location.origin;
                  await Promise.all(registrations.filter((registration) => {
                    const script = registration.active?.scriptURL || registration.waiting?.scriptURL || "";
                    return registration.scope === origin + "/" &&
                      script.startsWith(origin + "/sw.js");
                  }).map((registration) => registration.unregister()));
                }
              } catch { /* do not block CSS recovery */ }
              const next = new URL(location.href);
              next.searchParams.set("__site_asset_retry", String(now));
              location.replace(next.toString());
            }, true);
          })();`,
        }];
      },
      closeBundle() {
        // Site and App have different build configs and deployment projects.
        // Never modify public/sw.js: it powers the installed offline App.
        // A waiting legacy worker sees changed bytes, activates, then allows
        // fresh network navigation instead of pinning stale HTML/CSS.
        // No Cache API, localStorage or IndexedDB records are deleted.
        const retirementWorker = [
          'self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));',
          'self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));',
          "",
        ].join("\n");
        writeFileSync(path.resolve(__dirname, "dist-site/sw.js"), retirementWorker, "utf8");
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));

