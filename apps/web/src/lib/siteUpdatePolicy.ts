/** Keep the institutional site independent from the installed App update channel. */
export async function cleanupSiteServiceWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const origin = window.location.origin;
    await Promise.all(registrations.map(async (registration) => {
      const scriptURLs = [registration.active?.scriptURL, registration.waiting?.scriptURL, registration.installing?.scriptURL];
      const ownsAppWorker = scriptURLs.some((scriptURL) => {
        if (!scriptURL) return false;
        const url = new URL(scriptURL);
        return url.origin === origin && url.pathname === "/sw.js";
      });
      if (ownsAppWorker && new URL(registration.scope).origin === origin && new URL(registration.scope).pathname === "/") {
        await registration.unregister();
      }
    }));
  } catch (error) {
    console.warn("Falha ao remover SW legado do site:", error);
  }
}
