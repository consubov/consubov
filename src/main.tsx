import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "./lib/swRegistration";
import { resetServiceWorkerStateOnFirstLoad } from "./lib/swReset";
import { applyPwaProfile } from "./lib/pwaManifest";

async function bootstrap() {
  // Ajusta manifest/ícone/título antes de qualquer renderização.
  applyPwaProfile(window.location.pathname);

  const didReload = await resetServiceWorkerStateOnFirstLoad();
  if (didReload) return;

  createRoot(document.getElementById("root")!).render(<App />);
  registerSW();
}

void bootstrap();
