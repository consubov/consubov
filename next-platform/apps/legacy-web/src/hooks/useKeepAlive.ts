import { useEffect } from "react";

/**
 * Holds a Web Lock for as long as the component is mounted.
 *
 * Browsers (especially iOS Safari and Chrome on Android) may discard a
 * Service Worker / page after idle time, which causes offline state and
 * camera permissions to be lost. Holding a shared Web Lock signals to the
 * browser that the tab is still doing meaningful work, reducing the chance
 * of the page being discarded mid-session.
 *
 * Safe no-op when:
 *  - `navigator.locks` is unavailable (older browsers)
 *  - `enabled` is false (e.g. user not logged in offline)
 */
export function useKeepAlive(enabled: boolean, lockName = "consubov-capataz-session") {
  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !("locks" in navigator)) return;

    let release: (() => void) | null = null;
    let cancelled = false;

    const lockHeld = new Promise<void>((resolve) => {
      release = resolve;
    });

    try {
      // Shared mode → multiple tabs can coexist. ifAvailable avoids blocking.
      navigator.locks
        .request(lockName, { mode: "shared", ifAvailable: true }, async (lock) => {
          if (!lock || cancelled) return;
          // Hold the lock until cleanup runs
          await lockHeld;
        })
        .catch((err) => {
          console.warn("[useKeepAlive] lock request failed:", err);
        });
    } catch (err) {
      console.warn("[useKeepAlive] lock setup failed:", err);
    }

    return () => {
      cancelled = true;
      if (release) release();
    };
  }, [enabled, lockName]);
}
