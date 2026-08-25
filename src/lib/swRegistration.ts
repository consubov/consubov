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
const FORCE_RELOAD_STORAGE_KEY = "consubov:forced-reload-version";
let lastKnownRemoteVersion = __APP_BUILD_VERSION__;
const notifiedUpdateVersions = new Set<string>();
let explicitUpdateFallbackTimer: number | null = null;

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
  if (reloadCount >= 1 || reloadingForUpdate) {
    logSw("Reload automático interrompido para evitar loop", version);
    notifyListeners(true);
    return;
  }

  reloadingForUpdate = true;
  setForcedReloadCount(version, reloadCount + 1);
  logSw("Reload após update", version);
  window.location.replace(buildReloadUrl(version));
}

function explicitUpdateReload(updateToken = Date.now().toString()) {
  if (hasCriticalOperations()) {
    logSw("Reload explícito adiado — operação crítica em andamento");
    schedulePostDrainAction(() => explicitUpdateReload(updateToken));
    return;
  }

  // O clique do usuário é uma ordem explícita: não pode ser bloqueado pelo
  // limitador usado nas atualizações automáticas. Removemos os gatilhos da URL
  // para que a página nova não reinicie o mesmo ciclo.
  const url = new URL(window.location.href);
  url.searchParams.delete("__sw_update");
  url.searchParams.delete("_update");
  url.searchParams.set("__v", updateToken);
  logSw("Executando reload obrigatório do clique", url.toString());
  window.location.replace(url.toString());
}

function scheduleExplicitUpdateFallback(updateToken?: string) {
  if (explicitUpdateFallbackTimer !== null) {
    window.clearTimeout(explicitUpdateFallbackTimer);
  }
  logSw("Fallback obrigatório agendado para 1500ms");
  explicitUpdateFallbackTimer = window.setTimeout(() => {
    explicitUpdateFallbackTimer = null;
    logSw("Fallback de 1500ms disparado independentemente de controllerchange");
    explicitUpdateReload(updateToken);
  }, 1500);
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
    // A ativação da versão que já está executando não exige nova navegação.
    if (data.version === __APP_BUILD_VERSION__) return;
    hardReloadToLatest(data.version || lastKnownRemoteVersion);
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
    hardReloadToLatest();
  });
}

/**
 * Aplica a atualização pendente imediatamente (clique na notificação).
 * Só recarrega DEPOIS que o novo Service Worker assume o controle — se ele
 * ainda não estiver instalado, aguardamos a instalação antes do skipWaiting.
 */
export async function applyPendingUpdateNow(updateToken?: string) {
  logSw("Iniciando aplicação explícita da atualização", updateToken ?? "sem token");
  if (!("serviceWorker" in navigator)) {
    explicitUpdateReload(updateToken);
    return;
  }
  scheduleExplicitUpdateFallback(updateToken);
  try {
    const registration =
      (await navigator.serviceWorker.getRegistration()) ?? swRegistration ?? undefined;
    if (!registration) {
      logSw("Registro SW ausente; fallback continuará ativo");
      return;
    }
    swRegistration = registration;
    bindControllerChangeReload();
    void registration.update().then(
      () => logSw("registration.update concluído", {
        installing: registration.installing?.state ?? null,
        waiting: registration.waiting?.state ?? null,
        active: registration.active?.state ?? null,
      }),
      (error) => console.warn("[SW] registration.update falhou; fallback continuará", error),
    );

    if (registration.waiting) {
      logSw("Worker waiting encontrado no cliente; tentando SKIP_WAITING");
      await activateWaitingServiceWorker(registration);
      return;
    }

    logSw("Nenhum worker waiting no cliente; fallback obrigatório fará a navegação");
  } catch (error) {
    console.warn("[SW] aplicação explícita falhou; fallback continuará", error);
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
    await clearAppCaches();
    const regs = await navigator.serviceWorker?.getRegistrations();
    if (regs) await Promise.all(regs.map((r) => r.unregister()));
    window.location.reload();
  }, []);

  return { updateAvailable, applyUpdate, forceRefresh };
}
