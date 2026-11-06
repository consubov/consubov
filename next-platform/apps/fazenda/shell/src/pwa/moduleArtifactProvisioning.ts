import type { PinnedModuleGeneration } from '@consubov/module-release';

const PROVISION_TIMEOUT_MS = 45_000;
let persistenceRequested = false;
let persistenceGranted: boolean | null = null;
export function getStoragePersistenceResult(): boolean | null { return persistenceGranted; }
async function requestStoragePersistenceOnce(): Promise<void> {
  if (persistenceRequested) return;
  persistenceRequested = true;
  try { persistenceGranted = navigator.storage?.persist ? await navigator.storage.persist() : false; }
  catch { persistenceGranted = false; }
  window.dispatchEvent(new CustomEvent('consubov:storage-persistence', { detail: { granted: persistenceGranted } }));
}
async function releaseOperation(type: string, moduleId: string, expected: Partial<PinnedModuleGeneration> & { reason?: string }, isCurrent: () => boolean): Promise<PinnedModuleGeneration> {
  if (!isCurrent()) throw new Error('Authorized module context ended.');
  if (!['capataz', 'gerente', 'escritorio', 'fabrica'].includes(moduleId) || !('serviceWorker' in navigator)) throw new Error('Module provisioning unavailable.');
  let controller = navigator.serviceWorker.controller;
  if (!controller) {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => { cleanup(); reject(new Error('Service worker is not controlling this page.')); }, 10000);
      const changed = () => { if (navigator.serviceWorker.controller) { cleanup(); resolve(); } };
      const cleanup = () => { clearTimeout(timeout); navigator.serviceWorker.removeEventListener('controllerchange', changed); };
      navigator.serviceWorker.addEventListener('controllerchange', changed); changed();
    });
    controller = navigator.serviceWorker.controller;
  }
  if (!controller || !isCurrent()) throw new Error('Authorized module context ended.');
  return new Promise<PinnedModuleGeneration>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => { channel.port1.close(); reject(new Error('Module release operation timed out.')); }, PROVISION_TIMEOUT_MS);
    channel.port1.onmessage = event => {
      clearTimeout(timeout); channel.port1.close();
      const d = event.data?.descriptor;
      if (!isCurrent()) { reject(new Error('Authorized module context ended.')); return; }
      if (event.data?.complete !== true || event.data.moduleId !== moduleId || !d || d.moduleId !== moduleId || !/^[a-f0-9]{64}$/.test(d.generation) || d.manifestDigest !== d.generation || typeof d.cacheName !== 'string' || !d.cacheName.startsWith(`consubov-module-${moduleId}-`) || !['candidate', 'healthy'].includes(d.health)) { reject(new Error('Verified module generation unavailable.')); return; }
      resolve(d as PinnedModuleGeneration);
    };
    if (!isCurrent()) { clearTimeout(timeout); channel.port1.close(); reject(new Error('Authorized module context ended.')); return; }
    controller!.postMessage({ type, moduleId, generation: expected.generation, cacheName: expected.cacheName, reason: expected.reason }, [channel.port2]);
  });
}
export async function provisionModuleArtifact(moduleId: string, entryUrl: string, isCurrent: () => boolean = () => true): Promise<PinnedModuleGeneration> {
  const entry = new URL(entryUrl, window.location.href);
  if (entry.origin !== window.location.origin || entry.pathname !== `/modules/${moduleId}/current/index.html`) throw new Error('Module route is not authorized for verified provisioning.');
  const descriptor = await releaseOperation('PROVISION_AUTHORIZED_MODULE', moduleId, {}, isCurrent);
  void requestStoragePersistenceOnce();
  return descriptor;
}
export async function confirmModuleArtifact(descriptor: PinnedModuleGeneration, isCurrent: () => boolean = () => true): Promise<PinnedModuleGeneration> {
  return releaseOperation('MARK_MODULE_HEALTHY', descriptor.moduleId, descriptor, isCurrent);
}
export async function rollbackModuleArtifact(descriptor: PinnedModuleGeneration, isCurrent: () => boolean = () => true, reason: 'runtime' | 'handshake' | 'integrity' | 'compatibility' = 'runtime'): Promise<PinnedModuleGeneration> {
  return releaseOperation('ROLLBACK_MODULE', descriptor.moduleId, { ...descriptor, reason }, isCurrent);
}
