import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { execFileSync } from "node:child_process";

// GitHub Actions only tests artifacts; re-running the same SHA must not change
// bundle gzip sizes. Shipped builds keep their time-based PWA cache version.
const buildTimestamp = (() => {
  if (process.env.GITHUB_ACTIONS !== "true") return Date.now().toString();
  // Pull requests are checked out at a synthetic merge commit on GitHub Actions.
  // Its timestamp changes on reruns; use the actual reviewed PR HEAD instead.
  let sourceCommit = "HEAD";
  if (process.env.GITHUB_EVENT_NAME === "pull_request") {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (!eventPath) throw new Error("Missing GitHub pull request event file");
    const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    const headSha = event?.pull_request?.head?.sha;
    if (typeof headSha !== "string" || !/^[a-f0-9]{40}$/.test(headSha)) {
      throw new Error("Invalid GitHub pull request head SHA");
    }
    sourceCommit = headSha;
  }
  const seconds = execFileSync("git", ["log", "-1", "--format=%ct", sourceCommit], {
    cwd: path.resolve(__dirname, "../.."), encoding: "utf8",
  }).trim();
  if (!/^\d{10}$/.test(seconds)) throw new Error("Invalid CI commit timestamp");
  return seconds + "000";
})();

// Exposed for hermetic CI provenance tests; no timestamp is embedded in hashed JS.
export const resolvedBuildTimestamp = buildTimestamp;

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
      // Recovery is INLINE in the built HTML. Even if the Vite entrypoint is 404,
      // the installed PWA can verify and safely activate a complete new shell.
      const indexPath = path.resolve(__dirname, "dist/index.html");
      const repairSourcePath = path.resolve(__dirname, "src/lib/pwaBootRepair.inline.js");
      const marker = "<!-- CONSUBOV_BOOT_REPAIR_INLINE -->";
      const indexHtml = fs.readFileSync(indexPath, "utf-8");
      const repairSource = fs.readFileSync(repairSourcePath, "utf-8");
      if (!indexHtml.includes(marker) || repairSource.includes("</script")) {
        throw new Error("PWA inline recovery injection missing or unsafe");
      }
      const repairScript = repairSource
        .replace(/__CONSUBOV_BUILD_TIMESTAMP__/g, buildTimestamp)
        .replace(/__CONSUBOV_APP_VERSION__/g, readAppVersion());
      // Keep the dynamic version in HTML, outside content-hashed JS chunks.
      // This preserves a unique PWA version without randomizing gzip budgets.
      // Inline scripts execute before the HTML module entry is evaluated.
      const injectedScripts =
        `<script data-consubov-build-version>globalThis.__CONSUBOV_RUNTIME_BUILD_VERSION__=${JSON.stringify(buildTimestamp)};</script>\n` +
        `<script data-consubov-boot-repair>\n${repairScript}\n</script>`;
      fs.writeFileSync(indexPath, indexHtml.replace(marker, injectedScripts));

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
        JSON.stringify({ version: buildTimestamp, appVersion: readAppVersion() }, null, 2),
      );
    },
  };
}

// Dev pages do not run closeBundle: seed the same global before app modules.
function injectDevBuildTimestamp(): Plugin {
  return {
    name: "inject-dev-build-timestamp",
    apply: "serve",
    transformIndexHtml(html) {
      const marker = "<!-- CONSUBOV_BOOT_REPAIR_INLINE -->";
      if (!html.includes(marker)) throw new Error("PWA dev build marker missing");
      return html.replace(marker,
        `<script data-consubov-build-version>globalThis.__CONSUBOV_RUNTIME_BUILD_VERSION__=${JSON.stringify(buildTimestamp)};</script>\n${marker}`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  // Environment files live at the monorepo root so web/API tooling shares one source.
  envDir: path.resolve(__dirname, "../.."),
  define: {
    // Same runtime global is used by Vitest stubs and the generated HTML.
    __APP_BUILD_VERSION__: 'globalThis.__CONSUBOV_RUNTIME_BUILD_VERSION__',
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
    injectDevBuildTimestamp(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
