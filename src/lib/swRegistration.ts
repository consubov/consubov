import { useEffect, useState, useCallback } from "react";

let swRegistration: ServiceWorkerRegistration | null = null;
const listeners = new Set<(waiting: boolean) => void>();
const APP_CACHE_PREFIX = "consubov-";
const SW_AUTO_RELOAD_KEY = "consubov-sw-auto-reload-v1";

let autoUpdateRequested = false;
let controllerChangeListenerBound = false;

function notifyListeners(waiting: boolean) {
  listeners.forEach((fn) => fn(waiting));
}

async function clearAppCaches() {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith(APP_CACHE_PREFIX)).map((key) => caches.delete(key)));
}

function resetPendingReloadFlag() {
  try {
    if (sessionStorage.getItem(SW_AUTO_RELOAD_KEY) === "pending") {
      sessionStorage.removeItem(SW_AUTO_RELOAD_KEY);
    }
  } catch {
    /* ignore sessionStorage failures */
  }
}

function reloadOnceAfterUpdate() {
  try {
    if (sessionStorage.getItem(SW_AUTO_RELOAD_KEY) === "pending") return;
    sessionStorage.setItem(SW_AUTO_RELOAD_KEY, "pending");
  } catch {
    /* ignore sessionStorage failures */
  }

  window.location.reload();
}

function applyWaitingServiceWorker(worker: ServiceWorker | null | undefined) {
  if (!worker) return;

  autoUpdateRequested = true;
  notifyListeners(false);
  worker.postMessage({ type: "SKIP_WAITING" });
}

function bindControllerChangeReload() {
  if (controllerChangeListenerBound || !("serviceWorker" in navigator)) return;

  controllerChangeListenerBound = true;
  resetPendingReloadFlag();

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!autoUpdateRequested) return;

    autoUpdateRequested = false;
    reloadOnceAfterUpdate();
  });
}

function attachRegistrationListeners(registration: ServiceWorkerRegistration) {
  if (registration.waiting && navigator.serviceWorker.controller) {
    applyWaitingServiceWorker(registration.waiting);
  }

  registration.addEventListener("updatefound", () => {
    const newWorker = registration.installing;
    if (!newWorker) return;

    newWorker.addEventListener("statechange", () => {
      if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
        applyWaitingServiceWorker(registration.waiting ?? newWorker);
      }
    });
  });
}

export async function maybeUpdateActiveServiceWorker() {
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
    return;
  }

  try {
    bindControllerChangeReload();
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update();
      if (registration.waiting && navigator.serviceWorker.controller) {
        applyWaitingServiceWorker(registration.waiting);
      }
    }
  } catch (err) {
    console.warn("SW update check failed:", err);
  }
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
      Promise.all(regs.map((r) => r.unregister())).then(() => clearAppCaches())
    );
    return;
  }

  bindControllerChangeReload();

  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => {
      swRegistration = reg;

      attachRegistrationListeners(reg);
      void reg.update().then(() => {
        if (reg.waiting && navigator.serviceWorker.controller) {
          applyWaitingServiceWorker(reg.waiting);
        }
      });
    })
    .catch((err) => console.warn("SW registration failed:", err));
}

export function useSWUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const handler = (waiting: boolean) => setUpdateAvailable(waiting);
    listeners.add(handler);

    if (swRegistration?.waiting && !autoUpdateRequested) {
      setUpdateAvailable(true);
    }

    return () => {
      listeners.delete(handler);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (swRegistration?.waiting) {
      swRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  }, []);

  const forceRefresh = useCallback(async () => {
    await clearAppCaches();
    const regs = await navigator.serviceWorker?.getRegistrations();
    if (regs) await Promise.all(regs.map((r) => r.unregister()));
    window.location.reload();
  }, []);

  return { updateAvailable, applyUpdate, forceRefresh };
}
