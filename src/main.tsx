import { reloadWhenAuthIdle } from "./lib/authIdle";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { hasCriticalOperations } from "./lib/criticalOperations";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { registerSW } from "./lib/swRegistration";
import { resetServiceWorkerStateOnFirstLoad } from "./lib/swReset";
import { applyPwaProfile } from "./lib/pwaManifest";
import { installWriteInvalidation } from "./lib/screenCache";

/**
 * Tela branca por chunk quebrado: quando o HTML novo aponta para um asset que
 * não existe mais (ou vice-versa), o import dinâmico falha e nada renderiza.
 * Neste caso limpamos os caches do app e recarregamos UMA única vez.
 */
const CHUNK_RECOVERY_KEY = "consubov:chunk-recovery";

function isChunkLoadError(message: string) {
  const msg = message.toLowerCase();
  return (
    msg.includes("dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    msg.includes("chunkloaderror") ||
    (msg.includes("unexpected token") && msg.includes("<"))
  );
}

async function recoverFromChunkError() {
  // Pesagem (ou outra operação crítica) em andamento: não recarrega a página
  // inteira — a tela tenta de novo carregar só a parte que falhou.
  if (hasCriticalOperations()) {
    console.warn("[chunk] falha de carregamento durante operação crítica — sem recarregar a página");
    return;
  }
  try {
    if (sessionStorage.getItem(CHUNK_RECOVERY_KEY)) return;
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, "1");
  } catch {
    return;
  }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("consubov-")).map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
  reloadWhenAuthIdle(() => window.location.reload());
}

function installChunkErrorRecovery() {
  window.addEventListener("error", (event) => {
    if (event?.message && isChunkLoadError(String(event.message))) void recoverFromChunkError();
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = (event as PromiseRejectionEvent).reason;
    const message = reason instanceof Error ? reason.message : String(reason ?? "");
    if (isChunkLoadError(message)) void recoverFromChunkError();
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
  installChunkErrorRecovery();
  installWriteInvalidation();
  // App abriu bem: libera uma nova recuperação futura (no máximo 1 reload seguido).
  window.setTimeout(() => {
    try { sessionStorage.removeItem(CHUNK_RECOVERY_KEY); } catch { /* ignore */ }
  }, 10000);

  // Nada aqui pode impedir a renderização — se falhar, o app abre mesmo assim.
  try {
    applyPwaProfile(window.location.pathname);
    const didReload = await resetServiceWorkerStateOnFirstLoad();
    if (didReload) return;
  } catch (err) {
    console.warn("Bootstrap pré-render falhou:", err);
  }

  render();

  try {
    registerSW();
  } catch (err) {
    console.warn("registerSW falhou:", err);
  }
}

void bootstrap();
