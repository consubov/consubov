import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { ensureBuildVersion } from "../../scripts/qa/check-application-governance.mjs";

const buildTimestamp = Date.now().toString();

function readAppVersion(): string {
  const src = fs.readFileSync(path.resolve(__dirname, "src/lib/appVersion.ts"), "utf-8");
  const catalog = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../config/application-releases.json"), "utf-8"));
  return ensureBuildVersion(src, catalog);
}

// Replaces __BUILD_TIMESTAMP__ in public/sw.js so each deploy invalidates caches.
function injectSwBuildTimestamp(): Plugin {
  let validatedAppVersion: string;
  return {
    name: "inject-sw-build-timestamp",
    apply: "build",
    buildStart() {
      validatedAppVersion = readAppVersion();
    },
    closeBundle() {
      const swPath = path.resolve(__dirname, "dist/sw.js");
      if (!fs.existsSync(swPath)) return;
      // Route-level lazy chunks must also be present before offline update.
      // All built assets are included instead of guessing import graphs.
      const assetRoot = path.resolve(__dirname, "dist/assets");
      const builtAssets: string[] = [];
      const visitAssets = (directory: string, relative = "") => {
        if (!fs.existsSync(directory)) return;
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          const rel = relative ? relative + "/" + entry.name : entry.name;
          if (entry.isDirectory()) visitAssets(path.join(directory, entry.name), rel);
          else if (entry.isFile() && /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|svg|gif|wasm)$/i.test(rel)) {
            builtAssets.push("/assets/" + rel);
          }
        }
      };
      visitAssets(assetRoot);
      builtAssets.sort();
      if (!builtAssets.some((name) => name.endsWith(".js"))) {
        throw new Error("PWA offline build without JavaScript assets");
      }
      const content = fs.readFileSync(swPath, "utf-8");
      if (!content.includes("'__PRECACHE_ASSETS__'")) {
        throw new Error("PWA precache placeholder missing from service worker");
      }
      fs.writeFileSync(
        swPath,
        content.replace(/'__PRECACHE_ASSETS__'/g, JSON.stringify(builtAssets))
          .replace(/__BUILD_TIMESTAMP__/g, buildTimestamp),
      );

      fs.writeFileSync(
        path.resolve(__dirname, "dist/version.json"),
        JSON.stringify({ version: buildTimestamp, appVersion: validatedAppVersion }, null, 2),
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
}));