import { useEffect, useState, useCallback } from "react";

let swRegistration: ServiceWorkerRegistration | null = null;
let controllerChangeBound = false;
let reloadingForUpdate = false;
const listeners = new Set<(waiting: boolean) => void>();
const APP_CACHE_PREFIX = "consubov-";

function logSw(message: string, ...args: unknown[]) {
  console.log(`[SW] ${message}`, ...args);
}

function notifyListeners(waiting: boolean) {
  listeners.forEach((fn) => fn(waiting));
}

async function clearAppCaches() {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith(APP_CACHE_PREFIX)).map((key) => caches.delete(key)));
}

function bindControllerChangeReload() {
  if (controllerChangeBound) return;
  controllerChangeBound = true;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadingForUpdate) return;
    reloadingForUpdate = true;
    logSw("Reload após update");
    window.location.reload();
  });
}

async function activateWaitingServiceWorker(registration: ServiceWorkerRegistration) {
  if (!registration.waiting || !navigator.serviceWorker.controller) return false;
  logSw("Novo Service Worker encontrado");
  logSw("Atualizando aplicação");
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
  return true;
}

function attachRegistrationListeners(registration: ServiceWorkerRegistration) {
  if (registration.waiting && navigator.serviceWorker.controller) {
    void activateWaitingServiceWorker(registration);
  }

  registration.addEventListener("updatefound", () => {
    const newWorker = registration.installing;
    if (!newWorker) return;

    logSw("Novo Service Worker encontrado");

    newWorker.addEventListener("statechange", () => {
      if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
        void activateWaitingServiceWorker(registration);
      }
    });
  });
}

export async function maybeUpdateActiveServiceWorker() {
  if (!("serviceWorker" in navigator)) return false;

  try {
    if (window.self !== window.top) return false;
  } catch {
    return false;
  }

  if (
    window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com")
  ) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    swRegistration = registration;
    bindControllerChangeReload();
    attachRegistrationListeners(registration);
    await registration.update();
    if (registration.waiting && navigator.serviceWorker.controller) {
      return await activateWaitingServiceWorker(registration);
    }
  } catch (err) {
    console.warn("SW update check failed:", err);
  }

  return false;
}

export function registerSW() {
  if (!("serviceWorker" in navigator)) return;

  try {
    if (window.self !== window.top) return;
  } catch {
    return;
  }

  if (
    window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com")
  ) {
    navigator.serviceWorker.getRegistrations().then((regs) =>
      Promise.all(regs.map((r) => r.unregister())).then(() => clearAppCaches()),
    );
    return;
  }

  bindControllerChangeReload();

  navigator.serviceWorker
    .register("/sw.js", { updateViaCache: "none" })
    .then((reg) => {
      swRegistration = reg;
      attachRegistrationListeners(reg);
      void reg.update();
      if (reg.waiting && navigator.serviceWorker.controller) {
        void activateWaitingServiceWorker(reg);
      }
    })
    .catch((err) => console.warn("SW registration failed:", err));

  setInterval(() => void maybeUpdateActiveServiceWorker(), 60 * 60 * 1000);
}

export function useSWUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const handler = (waiting: boolean) => setUpdateAvailable(waiting);
    listeners.add(handler);

    if (swRegistration?.waiting) {
      setUpdateAvailable(true);
    }

    return () => {
      listeners.delete(handler);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (swRegistration?.waiting) {
      void activateWaitingServiceWorker(swRegistration);
      return;
    }
    window.location.reload();
  }, []);

  const forceRefresh = useCallback(async () => {
    await clearAppCaches();
    const regs = await navigator.serviceWorker?.getRegistrations();
    if (regs) await Promise.all(regs.map((r) => r.unregister()));
    window.location.reload();
  }, []);

  return { updateAvailable, applyUpdate, forceRefresh };
}
