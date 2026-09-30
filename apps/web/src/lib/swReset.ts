/**
 * One-shot migration helper kept for backward-compat. The aggressive reset
 * that ran on every new session was breaking offline-first behaviour: each
 * time the capataz reopened the PWA, sessionStorage was empty and the
 * function would unregister the SW + nuke all caches, forcing a network
 * round-trip to render anything. That is exactly the opposite of what an
 * offline-first PWA needs.
 *
 * The function now does NOTHING and always returns false. The export is
 * preserved so existing call sites in main.tsx keep working without an
 * extra refactor.
 */
export async function resetServiceWorkerStateOnFirstLoad(): Promise<boolean> {
  return false;
}
