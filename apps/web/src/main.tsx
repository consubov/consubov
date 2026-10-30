import { reloadWhenAuthIdle } from "./lib/authIdle";
import { isStandaloneApp } from "./lib/appSurface";
import { cleanupSiteServiceWorker, isSiteBrowserSurface } from "./lib/siteUpdatePolicy";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { hasCriticalOperations, onCriticalOperationsDrained } from "./lib/criticalOperations";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { registerSW } from "./lib/swRegistration";
import { resetServiceWorkerStateOnFirstLoad } from "./lib/swReset";
import { applyPwaProfile } from "./lib/pwaManifest";
import { installWriteInvalidation } from "./lib/screenCache";

/**
 * The inline boot rescue runs before any Vite module. It can recover an installed
 * app even if its entrypoint is missing. Never delete offline shell caches here.
 */
declare global {
  interface Window {
    __consubovBootRepair?: {
      markStarted(): void;
      recover(): void;
      setGuards(guards: {
        isCritical: typeof hasCriticalOperations;
        whenIdle: typeof onCriticalOperationsDrained;
        whenAuthIdle: typeof reloadWhenAuthIdle;
      }): void;
    };
  }
}

function isChunkLoadError(message: string) {
  const msg = message.toLowerCase();
  return (
    msg.includes("dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    msg.includes("chunkloaderror") ||
    (msg.includes("unexpected token") && msg.includes("<"))
  );
}

function recoverFromChunkError() {
  // Critical operations are checked again by the boot rescue after async waits.
  window.__consubovBootRepair?.recover();
}

function installChunkErrorRecovery() {
  window.addEventListener("error", (event) => {
    if (event?.message && isChunkLoadError(String(event.message))) recoverFromChunkError();
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = (event as PromiseRejectionEvent).reason;
    const message = reason instanceof Error ? reason.message : String(reason ?? "");
    if (isChunkLoadError(message)) recoverFromChunkError();
  });
}

function render() {
  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary autoResetOnVisibility>
      <App />
    </ErrorBoundary>,
  );
}

async function bootstrap() {
  window.__consubovBootRepair?.setGuards({
    isCritical: hasCriticalOperations,
    whenIdle: onCriticalOperationsDrained,
    whenAuthIdle: reloadWhenAuthIdle,
  });
  installChunkErrorRecovery();
  installWriteInvalidation();

  // O build de site nao deve iniciar SW do App, mesmo com ?surface=app na URL.
  const isPublicSite = isSiteBrowserSurface(import.meta.env.VITE_SURFACE_MODE, isStandaloneApp());

  // Nada aqui pode impedir a renderização — se falhar, o app abre mesmo assim.
  try {
    applyPwaProfile(window.location.pathname);
    const didReload = isPublicSite
      ? false
      : await resetServiceWorkerStateOnFirstLoad();
    if (didReload) return;
  } catch (err) {
    console.warn("Bootstrap pré-render falhou:", err);
  }

  render();
  window.__consubovBootRepair?.markStarted();

  try {
    if (isPublicSite) {
      void cleanupSiteServiceWorker();
    } else {
      registerSW();
    }
  } catch (err) {
    console.warn("registerSW falhou:", err);
  }
}

void bootstrap();
