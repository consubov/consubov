import { useEffect, useState, useCallback } from "react";

let swRegistration: ServiceWorkerRegistration | null = null;
const listeners = new Set<(waiting: boolean) => void>();

function notifyListeners(waiting: boolean) {
  listeners.forEach((fn) => fn(waiting));
}

export function registerSW() {
  if (!("serviceWorker" in navigator)) return;

  // Don't register in iframes or preview hosts
  try {
    if (window.self !== window.top) return;
  } catch {
    return;
  }
  if (
    window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com")
  ) {
    // Unregister any existing SW in preview
    navigator.serviceWorker.getRegistrations().then((regs) =>
      regs.forEach((r) => r.unregister())
    );
    return;
  }

  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => {
      swRegistration = reg;

      // Check for waiting SW
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

  // Reload on controller change
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

export function useSWUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const handler = (waiting: boolean) => setUpdateAvailable(waiting);
    listeners.add(handler);

    // Check current state
    if (swRegistration?.waiting) {
      setUpdateAvailable(true);
    }

    return () => { listeners.delete(handler); };
  }, []);

  const applyUpdate = useCallback(() => {
    if (swRegistration?.waiting) {
      swRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  }, []);

  const forceRefresh = useCallback(async () => {
    // Clear all caches
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    // Unregister SW and reload
    const regs = await navigator.serviceWorker?.getRegistrations();
    if (regs) await Promise.all(regs.map((r) => r.unregister()));
    window.location.reload();
  }, []);

  return { updateAvailable, applyUpdate, forceRefresh };
}
