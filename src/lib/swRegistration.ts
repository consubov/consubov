import { useEffect, useState, useCallback } from "react";
import { hasCriticalOperations, onCriticalOperationsDrained } from "./criticalOperations";

declare const __APP_BUILD_VERSION__: string;

let drainedUnsub: (() => void) | null = null;

function schedulePostDrainAction(action: () => void) {
  if (drainedUnsub) return; // already waiting
  drainedUnsub = onCriticalOperationsDrained(() => {
    drainedUnsub?.();
    drainedUnsub = null;
    // dá um respiro para a operação concluir efeitos colaterais
    setTimeout(action, 250);
  });
}

let swRegistration: ServiceWorkerRegistration | null = null;
let controllerChangeBound = false;
let reloadingForUpdate = false;
const observedRegistrations = new WeakSet<ServiceWorkerRegistration>();
const listeners = new Set<(waiting: boolean) => void>();
const APP_CACHE_PREFIX = "consubov-";
const SW_SCRIPT_URL = `/sw.js?v=${__APP_BUILD_VERSION__}`;
const VERSION_URL = "/version.json";
const UPDATE_NOTIFICATION_STORAGE_KEY = "consubov:update-notified-version";
const FORCE_RELOAD_STORAGE_KEY = "consubov:forced-reload-version";
let lastKnownRemoteVersion = __APP_BUILD_VERSION__;
const notifiedUpdateVersions = new Set<string>();

function buildReloadUrl(version = lastKnownRemoteVersion) {
  const url = new URL(window.location.href);
  url.searchParams.set("__app_version", version);
  url.searchParams.set("__v", Date.now().toString());
  return url.toString();
}

function getForcedReloadCount(version: string) {
  try {
    const raw = window.sessionStorage.getItem(FORCE_RELOAD_STORAGE_KEY);
    if (!raw) return 0;
    const data = JSON.parse(raw) as { version?: string; count?: number };
    return data.version === version ? data.count ?? 0 : 0;
  } catch {
    return 0;
  }
}

function setForcedReloadCount(version: string, count: number) {
  try {
    window.sessionStorage.setItem(FORCE_RELOAD_STORAGE_KEY, JSON.stringify({ version, count }));
  } catch {
    /* ignore */
  }
}

function hardReloadToLatest(version = lastKnownRemoteVersion) {
  if (hasCriticalOperations()) {
    logSw("Reload adiado — operação crítica em andamento");
    schedulePostDrainAction(() => hardReloadToLatest(version));
    return;
  }

  const reloadCount = getForcedReloadCount(version);
  if (reloadCount >= 3) {
    logSw("Reload automático interrompido para evitar loop", version);
    notifyListeners(true);
    return;
  }

  setForcedReloadCount(version, reloadCount + 1);
  logSw("Reload após update", version);

  // Na 2ª tentativa, limpa caches do app antes de navegar. Isso corrige PWAs
  // instalados no Android/iOS que ficaram presos em um shell antigo.
  if (reloadCount >= 1) {
    void clearAppCaches().finally(() => window.location.replace(buildReloadUrl(version)));
    return;
  }

  window.location.replace(buildReloadUrl(version));
}

function logSw(message: string, ...args: unknown[]) {
  console.log(`[SW] ${message}`, ...args);
}

function notifyListeners(waiting: boolean) {
  listeners.forEach((fn) => fn(waiting));
}

async function clearAppCaches() {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith(APP_CACHE_PREFIX)).map((key) => caches.delete(key)));
}

function bindControllerChangeReload() {
  if (controllerChangeBound) return;
  controllerChangeBound = true;

  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data as { type?: string; version?: string } | undefined;
    if (data?.type === "CONSUBOV_APPLY_UPDATE") {
      void applyPendingUpdateNow();
      return;
    }
    if (data?.type !== "CONSUBOV_SW_ACTIVATED") return;
    if (data.version) lastKnownRemoteVersion = data.version;
    hardReloadToLatest(data.version || lastKnownRemoteVersion);
  });


  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadingForUpdate) return;
    reloadingForUpdate = true;
    hardReloadToLatest();
  });
}

function tryAutoApply(registration: ServiceWorkerRegistration): boolean {
  if (!registration.waiting || !navigator.serviceWorker.controller) return false;
  if (hasCriticalOperations()) {
    logSw("Auto-update adiado — operação crítica em andamento");
    schedulePostDrainAction(() => {
      const reg = swRegistration ?? registration;
      if (reg.waiting) void activateWaitingServiceWorker(reg);
    });
    return false;
  }
  void activateWaitingServiceWorker(registration);
  return true;
}

function getWaitingServiceWorkerVersion(registration: ServiceWorkerRegistration) {
  const scriptUrl = registration.waiting?.scriptURL;
  if (!scriptUrl) return lastKnownRemoteVersion;

  try {
    const url = new URL(scriptUrl);
    return url.searchParams.get("v") || scriptUrl;
  } catch {
    return scriptUrl;
  }
}

async function showUpdateNotificationOnce(registration: ServiceWorkerRegistration) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  const waitingVersion = getWaitingServiceWorkerVersion(registration);

  // Dedupe apenas na sessão atual — assim, se o usuário recarregar sem aplicar
  // a atualização, ele volta a ser notificado em vez de ficar para sempre em
  // silêncio (problema relatado em Android).
  if (notifiedUpdateVersions.has(waitingVersion)) return;

  let storedVersion: string | null = null;
  try {
    storedVersion = window.sessionStorage.getItem(UPDATE_NOTIFICATION_STORAGE_KEY);
  } catch {
    /* sessionStorage pode falhar em modo privado — usa apenas memória */
  }

  if (storedVersion === waitingVersion) {
    notifiedUpdateVersions.add(waitingVersion);
    return;
  }

  try {
    window.sessionStorage.setItem(UPDATE_NOTIFICATION_STORAGE_KEY, waitingVersion);
  } catch {
    /* idem */
  }

  notifiedUpdateVersions.add(waitingVersion);

  // Limpa eventual notificação antiga com o mesmo tag para garantir que o
  // novo alerta apareça (alguns Androids suprimem renotify=false em silêncio).
  try {
    const existing = await registration.getNotifications?.({ tag: "consubov-update" });
    existing?.forEach((n) => n.close());
  } catch {
    /* ignore */
  }

  try {
    await registration.showNotification("CONSUBOV", {
      body: "Nova versão disponível — toque para atualizar",
      icon: "/icon-192.png",
      badge: "/icon-96.png",
      tag: "consubov-update",
      renotify: true,
      data: { url: "/" },
    } as NotificationOptions);
  } catch {
    /* ignore — notificação é best-effort */
  }
}


function notifyWaiting(registration: ServiceWorkerRegistration) {
  if (registration.waiting && navigator.serviceWorker.controller) {
    logSw("Nova versão em espera — aplicando automaticamente");
    notifyListeners(true);
    // Notifica o usuário no dispositivo (mesmo com o app aberto/minimizado)
    // que existe uma nova versão. Funciona em Android e iOS PWA.
    void showUpdateNotificationOnce(registration);
    tryAutoApply(registration);
    return true;
  }
  return false;
}

async function activateWaitingServiceWorker(registration: ServiceWorkerRegistration) {
  if (!registration.waiting) return false;
  logSw("Aplicando atualização (SKIP_WAITING)");
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
  return true;
}

function attachRegistrationListeners(registration: ServiceWorkerRegistration) {
  if (observedRegistrations.has(registration)) return;
  observedRegistrations.add(registration);

  notifyWaiting(registration);

  registration.addEventListener("updatefound", () => {
    const newWorker = registration.installing;
    if (!newWorker) return;

    logSw("Novo Service Worker encontrado");

    newWorker.addEventListener("statechange", () => {
      if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
        notifyWaiting(registration);
      }
    });
  });
}

async function fetchPublishedBuildVersion() {
  try {
    const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "cache-control": "no-cache",
      },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

async function ensureLatestPublishedVersion() {
  const remoteVersion = await fetchPublishedBuildVersion();
  if (!remoteVersion || remoteVersion === lastKnownRemoteVersion) {
    return false;
  }

  lastKnownRemoteVersion = remoteVersion;
  logSw("Versão remota detectada", remoteVersion);

  try {
    const registration = await navigator.serviceWorker.register(`/sw.js?v=${remoteVersion}`, {
      updateViaCache: "none",
    });
    swRegistration = registration;
    bindControllerChangeReload();
    attachRegistrationListeners(registration);
    await registration.update();

    if (registration.waiting && navigator.serviceWorker.controller) {
      notifyWaiting(registration);
      return true;
    }

    // Mesmo sem um worker em waiting, se o build publicado é diferente do JS
    // em execução, força a navegação para o HTML mais recente. É o caso comum
    // de apps instalados no Android/iOS que reabrem uma sessão antiga.
    if (remoteVersion !== __APP_BUILD_VERSION__) {
      notifyListeners(true);
      hardReloadToLatest(remoteVersion);
      return true;
    }
  } catch (error) {
    console.warn("Remote SW version sync failed:", error);
  }

  return false;
}

export async function maybeUpdateActiveServiceWorker() {
  if (!("serviceWorker" in navigator)) return false;

  try {
    if (window.self !== window.top) return false;
  } catch {
    return false;
  }

  if (
    window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com")
  ) {
    return false;
  }

  try {
    await ensureLatestPublishedVersion();
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    swRegistration = registration;
    bindControllerChangeReload();
    attachRegistrationListeners(registration);
    await registration.update();
    if (registration.waiting && navigator.serviceWorker.controller) {
      notifyWaiting(registration);
      return true;
    }
  } catch (err) {
    console.warn("SW update check failed:", err);
  }

  return false;
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

  bindControllerChangeReload();

  // Throttle das checagens: em campo o consultor alterna app/câmera dezenas de
  // vezes por visita; sem isso cada retorno de segundo plano dispara uma
  // verificação (e possível aviso de "nova versão").
  const MIN_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1h
  let lastCheckAt = Date.now();
  const triggerUpdateCheck = (force = false) => {
    const now = Date.now();
    if (!force && now - lastCheckAt < MIN_CHECK_INTERVAL_MS) return;
    lastCheckAt = now;
    void maybeUpdateActiveServiceWorker();
  };

  window.addEventListener("pageshow", () => triggerUpdateCheck());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      triggerUpdateCheck();
    }
  });
  window.addEventListener("online", () => triggerUpdateCheck());

  navigator.serviceWorker
    .register(SW_SCRIPT_URL, { updateViaCache: "none" })
    .then((reg) => {
      swRegistration = reg;
      attachRegistrationListeners(reg);
      void reg.update();
      void maybeUpdateActiveServiceWorker();
      if (reg.waiting && navigator.serviceWorker.controller) {
        notifyWaiting(reg);
      }
    })
    .catch((err) => console.warn("SW registration failed:", err));

  // Verificação periódica de hora em hora (antes: 5 min), suficiente para
  // entregar novas versões sem interromper o usuário em campo.
  setInterval(() => triggerUpdateCheck(true), MIN_CHECK_INTERVAL_MS);
}

export function useSWUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const handler = (waiting: boolean) => setUpdateAvailable(waiting);
    listeners.add(handler);

    const checkWaiting = async () => {
      if (swRegistration?.waiting) {
        setUpdateAvailable(true);
        return;
      }
      if ("serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            swRegistration = reg;
            attachRegistrationListeners(reg);
            if (reg.waiting && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          }
        } catch {
          /* noop */
        }
      }
    };

    void checkWaiting();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void checkWaiting();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", checkWaiting);
    window.addEventListener("pageshow", checkWaiting);

    return () => {
      listeners.delete(handler);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", checkWaiting);
      window.removeEventListener("pageshow", checkWaiting);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (swRegistration?.waiting) {
      void activateWaitingServiceWorker(swRegistration);
      return;
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
