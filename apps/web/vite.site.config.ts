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
        ].join("\\n");
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

