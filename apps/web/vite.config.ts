import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

const buildTimestamp = Date.now().toString();

function readAppVersion(): string {
  try {
    const src = fs.readFileSync(path.resolve(__dirname, "src/lib/appVersion.ts"), "utf-8");
    const m = src.match(/APP_VERSION\s*=\s*"([^"]+)"/);
    return m?.[1] ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

// Replaces __BUILD_TIMESTAMP__ in public/sw.js so each deploy invalidates caches.
function injectSwBuildTimestamp(): Plugin {
  return {
    name: "inject-sw-build-timestamp",
    apply: "build",
    closeBundle() {
      const swPath = path.resolve(__dirname, "dist/sw.js");
      if (!fs.existsSync(swPath)) return;
      const content = fs.readFileSync(swPath, "utf-8");
      fs.writeFileSync(swPath, content.replace(/__BUILD_TIMESTAMP__/g, buildTimestamp));

      fs.writeFileSync(
        path.resolve(__dirname, "dist/version.json"),
        JSON.stringify({ version: buildTimestamp, appVersion: readAppVersion() }, null, 2),
      );
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  // Environment files live at the monorepo root so web/API tooling shares one source.
  envDir: path.resolve(__dirname, "../.."),
  define: {
    __APP_BUILD_VERSION__: JSON.stringify(buildTimestamp),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    injectSwBuildTimestamp(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },

  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
}));
