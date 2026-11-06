import { UpdateCoordinator, UpdateCoordinatorOptions } from './UpdateCoordinator';

export interface ServiceWorkerRegistrationCallbacks extends UpdateCoordinatorOptions {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onConnectivityChange?: (isOnline: boolean) => void;
}

let activeCoordinator: UpdateCoordinator | null = null;

export function getUpdateCoordinator(): UpdateCoordinator | null {
  return activeCoordinator;
}

export function registerServiceWorker(callbacks?: ServiceWorkerRegistrationCallbacks): void {
  if (typeof window === 'undefined') return;

  // Monitoramento de conectividade online/offline
  window.addEventListener('online', () => {
    callbacks?.onConnectivityChange?.(true);
  });
  window.addEventListener('offline', () => {
    callbacks?.onConnectivityChange?.(false);
  });

  if ('serviceWorker' in navigator && (import.meta.env.PROD || import.meta.env.VITE_SW_ENABLED === 'true')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Inicializa o coordenador de atualizações silenciosas com quiescência
          activeCoordinator = new UpdateCoordinator({
            ...callbacks,
            onUpdateCurrent: () => {
              window.dispatchEvent(new CustomEvent('consubov:update-current'));
              callbacks?.onUpdateCurrent?.();
            },
            onUpdateAvailable: (version) => {
              window.dispatchEvent(new CustomEvent('consubov:update-available'));
              callbacks?.onUpdate?.(registration);
              callbacks?.onUpdateAvailable?.(version);
            }
          });
          activeCoordinator.initialize(registration);

          if (!registration.waiting && !registration.installing) {
            callbacks?.onSuccess?.(registration);
          }
        })
        .catch((err) => {
          // Registro defensivo: ignora falhas em ambientes sem HTTPS ou em dev
          console.warn('[SW_REGISTRATION_FAILED]', err);
        });
    });
  }
}

export * from './UpdateCoordinator';
