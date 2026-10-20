import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

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
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));

