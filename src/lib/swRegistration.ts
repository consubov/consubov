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

function attachRegistrationListeners(registration: ServiceWorkerRegistration) {
  // SW already waiting on load → notify immediately.
  if (registration.waiting && navigator.serviceWorker.controller) {
    notifyListeners(true);
  }

  registration.addEventListener("updatefound", () => {
    const newWorker = registration.installing;
    if (!newWorker) return;

    newWorker.addEventListener("statechange", () => {
      if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
        // New version available — surface to the user via toast.
        notifyListeners(true);
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
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update();
      if (registration.waiting && navigator.serviceWorker.controller) {
        notifyListeners(true);
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
      Promise.all(regs.map((r) => r.unregister())).then(() => clearAppCaches()),
    );
    return;
  }

  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => {
      swRegistration = reg;
      attachRegistrationListeners(reg);
      void reg.update();
    })
    .catch((err) => console.warn("SW registration failed:", err));

  // Periodic background check so long-lived sessions still pick up new versions.
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
    // Tell waiting SW to take over, then reload so the user gets the fresh shell.
    if (swRegistration?.waiting) {
      swRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
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
