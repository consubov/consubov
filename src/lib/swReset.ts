const SW_RESET_KEY = "consubov-sw-reset-v1";

async function unregisterAllServiceWorkers() {
  if (!("serviceWorker" in navigator)) return false;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  return registrations.length > 0;
}

async function clearAllCaches() {
  if (!("caches" in window)) return false;

  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));

  return keys.length > 0;
}

export async function resetServiceWorkerStateOnFirstLoad() {
  if (typeof window === "undefined") return false;
  if (sessionStorage.getItem(SW_RESET_KEY) === "done") return false;

  sessionStorage.setItem(SW_RESET_KEY, "done");

  try {
    const [hadRegistrations, hadCaches] = await Promise.all([
      unregisterAllServiceWorkers(),
      clearAllCaches(),
    ]);

    if (hadRegistrations || hadCaches) {
      window.location.replace(window.location.href);
      return true;
    }
  } catch (error) {
    console.warn("SW reset on boot failed:", error);
  }

  return false;
}