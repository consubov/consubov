import { reloadWhenAuthIdle } from "@/lib/authIdle";
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
let ignoreFirstControllerChange =
  typeof navigator !== "undefined" && "serviceWorker" in navigator && !navigator.serviceWorker.controller;
const observedRegistrations = new WeakSet<ServiceWorkerRegistration>();
const listeners = new Set<(waiting: boolean) => void>();
const APP_CACHE_PREFIX = "consubov-";
const SW_SCRIPT_URL = `/sw.js?v=${__APP_BUILD_VERSION__}`;
const VERSION_URL = "/version.json";
const UPDATE_NOTIFICATION_STORAGE_KEY = "consubov:update-notified-version";
let lastKnownRemoteVersion = __APP_BUILD_VERSION__;
const notifiedUpdateVersions = new Set<string>();
let explicitUpdateFallbackTimer: number | null = null;
let userRequestedUpdate = false;
let pendingUpdateToken: string | undefined;
let controllerBeforeUpdate: ServiceWorker | null = null;
const activationRequested = new WeakSet<ServiceWorker>();

function cancelExplicitUpdateTimer() {
  if (explicitUpdateFallbackTimer !== null) {
    window.clearTimeout(explicitUpdateFallbackTimer);
    explicitUpdateFallbackTimer = null;
  }
}

function explicitUpdateReload(updateToken = Date.now().toString()) {
  if (hasCriticalOperations()) {
    logSw("Reload explícito adiado — operação crítica em andamento");
    schedulePostDrainAction(() => explicitUpdateReload(updateToken));
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.delete("__sw_update");
  url.searchParams.delete("_update");
  url.searchParams.set("__v", updateToken);
  logSw("Reload após ativação comprovada do Service Worker", url.toString());
  reloadWhenAuthIdle(() => window.location.replace(url.toString()));
}

/** Never claim an update succeeded before an activated worker controls the page. */
function finishVerifiedUpdate() {
  if (!userRequestedUpdate || reloadingForUpdate) return;
  const controller = navigator.serviceWorker?.controller;
  if (!controller || controller === controllerBeforeUpdate) return;
  cancelExplicitUpdateTimer();
  reloadingForUpdate = true;
  userRequestedUpdate = false;
  explicitUpdateReload(pendingUpdateToken);
}

function scheduleExplicitUpdateTimeout() {
  cancelExplicitUpdateTimer();
  // A slow/offline download may not finish. Stay on the intact installed shell
  // rather than reloading into an old worker or a mixed-version page.
  explicitUpdateFallbackTimer = window.setTimeout(() => {
    explicitUpdateFallbackTimer = null;
    finishVerifiedUpdate();
    if (reloadingForUpdate) return;
    userRequestedUpdate = false;
    notifyListeners(true);
    logSw("Atualização não confirmada; versão instalada preservada");
  }, 15_000);
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
    const data = event.data as { type?: string; version?: string; updateToken?: string } | undefined;
    if (data?.type === "CONSUBOV_APPLY_UPDATE") {
      logSw("Mensagem CONSUBOV_APPLY_UPDATE recebida", data.updateToken ?? "sem token");
      void applyPendingUpdateNow(data.updateToken);
      return;
    }
    if (data?.type !== "CONSUBOV_SW_ACTIVATED") return;
    if (data.version) lastKnownRemoteVersion = data.version;
    if (data.version === __APP_BUILD_VERSION__) return;
    if (userRequestedUpdate) finishVerifiedUpdate();
    else notifyListeners(true);
  });


  navigator.serviceWorker.addEventListener("controllerchange", () => {
    logSw("Evento controllerchange disparado", {
      controller: navigator.serviceWorker.controller?.scriptURL ?? null,
      explicitFallbackPending: explicitUpdateFallbackTimer !== null,
    });
    // Primeira instalação em um navegador limpo: o bundle atual já é o mais
    // novo, portanto recarregar aqui apenas atrasa a abertura inicial.
    if (ignoreFirstControllerChange) {
      ignoreFirstControllerChange = false;
      return;
    }
    if (reloadingForUpdate) return;
    if (userRequestedUpdate) finishVerifiedUpdate();
    else notifyListeners(true);
  });
}

/**
 * Aplica a atualização pendente imediatamente (clique na notificação).
 * Só recarrega DEPOIS que o novo Service Worker assume o controle — se ele
 * ainda não estiver instalado, aguardamos a instalação antes do skipWaiting.
 */
export async function applyPendingUpdateNow(updateToken?: string) {
  if (hasCriticalOperations()) {
    schedulePostDrainAction(() => void applyPendingUpdateNow(updateToken));
    return;
  }
  logSw("Iniciando aplicação explícita da atualização", updateToken ?? "sem token");
  if (!("serviceWorker" in navigator)) {
    explicitUpdateReload(updateToken);
    return;
  }
  userRequestedUpdate = true;
  pendingUpdateToken = updateToken;
  controllerBeforeUpdate = navigator.serviceWorker.controller;
  scheduleExplicitUpdateTimeout();
  try {
    const registration =
      (await navigator.serviceWorker.getRegistration()) ?? swRegistration ?? undefined;
    if (!registration) {
      logSw("Registro SW ausente; versão atual preservada");
      return;
    }
    swRegistration = registration;
    bindControllerChangeReload();
    attachRegistrationListeners(registration);
    // updatefound/statechange may install the worker after this click.
    void registration.update().then(
      () => {
        if (userRequestedUpdate && registration.waiting) {
          void activateWaitingServiceWorker(registration);
        }
      },
      (error) => console.warn("[SW] registration.update falhou; versão atual preservada", error),
    );

    if (registration.waiting) {
      logSw("Worker waiting encontrado no cliente; tentando SKIP_WAITING");
      await activateWaitingServiceWorker(registration);
      return;
    }

    logSw("Aguardando instalação completa do novo Service Worker");
  } catch (error) {
    console.warn("[SW] aplicação explícita falhou; versão atual preservada", error);
  }
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
      data: { url: "/", type: "update" },
    } as NotificationOptions);
  } catch {
    /* ignore — notificação é best-effort */
  }
}


function notifyWaiting(registration: ServiceWorkerRegistration) {
  if (registration.waiting && navigator.serviceWorker.controller) {
    logSw("Nova versão instalada e pronta, aguardando ação do usuário");
    notifyListeners(true);
    // Notifica o usuário no dispositivo (mesmo com o app aberto/minimizado)
    // que existe uma nova versão. Funciona em Android e iOS PWA.
    void showUpdateNotificationOnce(registration);
    return true;
  }
  return false;
}

async function activateWaitingServiceWorker(registration: ServiceWorkerRegistration) {
  const worker = registration.waiting;
  if (!worker || activationRequested.has(worker)) return false;
  activationRequested.add(worker);
  logSw("Aplicando atualização (SKIP_WAITING)");
  worker.postMessage({ type: "SKIP_WAITING" });
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
        if (userRequestedUpdate) void activateWaitingServiceWorker(registration);
        else notifyWaiting(registration);
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

    // A published version can be newer without having an installed worker.
    // Report availability, but never reload the cached shell automatically.
    if (remoteVersion !== __APP_BUILD_VERSION__) {
      notifyListeners(true);
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

  if (!import.meta.env.PROD) {
    navigator.serviceWorker.getRegistrations().then((regs) =>
      Promise.all(regs.map((r) => r.unregister())).then(() => clearAppCaches()),
    );
    return;
  }

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

  // Aberto a partir do clique na notificação sem nenhuma aba viva: aplica já.
  try {
    const updateParams = new URLSearchParams(window.location.search);
    const updateToken = updateParams.get("_update") ?? undefined;
    if (updateParams.has("__sw_update") || updateToken) {
      logSw("Página aberta pelo clique da notificação", updateToken ?? "sem token");
      void applyPendingUpdateNow(updateToken);
    }
  } catch {
    /* ignore */
  }

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
    logSw("Atualização solicitada pelo banner");
    void applyPendingUpdateNow();
  }, []);

  const forceRefresh = useCallback(async () => {
    // "Atualizar app" is NOT an authorization to delete the installed offline
    // shell. A cache purge could strand a field worker without connectivity.
    if (hasCriticalOperations()) {
      schedulePostDrainAction(() => void forceRefresh());
      return;
    }
    if ("serviceWorker" in navigator) {
      await maybeUpdateActiveServiceWorker();
      const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
      if (reg?.waiting && navigator.serviceWorker.controller) {
        await applyPendingUpdateNow();
        return;
      }
    }
    // Normal navigation is safely pinned by the existing worker while offline.
    reloadWhenAuthIdle(() => window.location.reload());
  }, []);

  return { updateAvailable, applyUpdate, forceRefresh };
}
