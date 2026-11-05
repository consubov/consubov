export interface ServiceWorkerRegistrationCallbacks {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onConnectivityChange?: (isOnline: boolean) => void;
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

  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (!installingWorker) return;

            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  callbacks?.onUpdate?.(registration);
                } else {
                  callbacks?.onSuccess?.(registration);
                }
              }
            };
          };
        })
        .catch(() => {
          // Registro defensivo: ignora falhas em testes ou dev
        });
    });
  }
}
