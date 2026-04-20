import { useEffect, useState, useCallback } from "react";

let swRegistration: ServiceWorkerRegistration | null = null;
const listeners = new Set<(waiting: boolean) => void>();
const APP_CACHE_PREFIX = "consubov-";

function notifyListeners(waiting: boolean) {
  listeners.forEach((fn) => fn(waiting));
}

async function clearAppCaches() {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith(APP_CACHE_PREFIX)).map((key) => caches.delete(key)));
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
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update();
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

  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => {
      swRegistration = reg;
      void reg.update();

      if (reg.waiting) {
        notifyListeners(true);
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            notifyListeners(true);
          }
        });
      });
    })
    .catch((err) => console.warn("SW registration failed:", err));

  // NOTE: controllerchange reload removed — was causing infinite reload loop.
  // Updates are now applied only when the user clicks the update banner.
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
