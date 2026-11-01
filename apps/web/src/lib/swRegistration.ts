import { reloadWhenAuthIdle } from "@/lib/authIdle";
import { APP_VERSION } from "@/lib/appVersion";
import { classifyPublishedRelease, isNewerBuildTimestamp, isWaitingWorkerForPublishedRelease, shouldNotifyPublishedBuild, type PublishedRelease } from "@/lib/publishedUpdate";
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
const VERSION_URL = "/version.json";
const UPDATE_NOTIFICATION_STORAGE_KEY = "consubov:update-notified-version";
let lastKnownRemoteVersion = __APP_BUILD_VERSION__;
const notifiedUpdateVersions = new Set<string>();
let explicitUpdateFallbackTimer: number | null = null;
let userRequestedUpdate = false;
let pendingUpdateToken: string | undefined;
let controllerBeforeUpdate: ServiceWorker | null = null;
const activationRequested = new WeakSet<ServiceWorker>();
// Keep a separate pending guard across the async release verification.
const activationInFlight = new WeakSet<ServiceWorker>();

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
    notifyListeners(false);
    logSw("Atualização não confirmada; versão instalada preservada");
  }, 15_000);
}

function logSw(message: string, ...args: unknown[]) {
  if (import.meta.env.DEV) console.debug(`[SW] ${message}`, ...args);
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
    if (!isNewerBuildTimestamp(data.version, __APP_BUILD_VERSION__)) return;
    if (userRequestedUpdate) finishVerifiedUpdate();
    else {
      notifyListeners(false);
      void maybeUpdateActiveServiceWorker();
    }
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
    else {
      notifyListeners(false);
      void maybeUpdateActiveServiceWorker();
    }
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
  // A notificação ou um worker waiting pode ser de um build ANTIGO.
  // Não iniciar activation, reload ou tentativa de downgrade sem metadata válida.
  const release = await fetchPublishedRelease();
  if (!release || classifyPublishedRelease(APP_VERSION, __APP_BUILD_VERSION__, release) !== "newer") {
    notifyListeners(false);
    logSw("Atualização rejeitada: versão remota não é mais nova");
    return;
  }
  logSw("Iniciando atualização publicada verificada", release.version);
  if (!("serviceWorker" in navigator)) return;
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

  // Persist across app restarts: a given build may notify the device once.
  // The in-app banner/manual refresh remain available for pending updates.
  if (notifiedUpdateVersions.has(waitingVersion)) return;

  let storedVersion: string | null = null;
  try {
    storedVersion = window.localStorage.getItem(UPDATE_NOTIFICATION_STORAGE_KEY);
  } catch {
    /* localStorage pode falhar em modo privado — usa apenas memória */
  }

  if (!shouldNotifyPublishedBuild(waitingVersion, __APP_BUILD_VERSION__, storedVersion)) {
    notifiedUpdateVersions.add(waitingVersion);
    return;
  }

  try {
    window.localStorage.setItem(UPDATE_NOTIFICATION_STORAGE_KEY, waitingVersion);
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
      renotify: false,
      data: { url: "/", type: "update" },
    } as NotificationOptions);
  } catch {
    /* ignore — notificação é best-effort */
  }
}


function notifyWaiting(registration: ServiceWorkerRegistration) {
  if (!registration.waiting || !navigator.serviceWorker.controller) return false;
  // Snapshot before the async check so test cleanup cannot invalidate the build identity.
  const expectedBuildVersion = __APP_BUILD_VERSION__;
  void (async () => {
    const release = await fetchPublishedRelease();
    if (!release || classifyPublishedRelease(APP_VERSION, expectedBuildVersion, release) !== "newer" ||
      !isWaitingWorkerForPublishedRelease(registration.waiting?.scriptURL, release.version as string, window.location.origin)) {
      logSw("Worker waiting antigo/incompatível ignorado");
      notifyListeners(false);
      return;
    }
    logSw("Nova versão verificada, aguardando confirmação do usuário", release.version);
    notifyListeners(true);
    // Avisar somente após confirmar versão e integridade da origem do worker.
    void showUpdateNotificationOnce(registration);
  })().catch(() => {
    logSw("Falha ao verificar o worker waiting; atualização não disponibilizada");
    notifyListeners(false);
  });
  return true;
}

async function activateWaitingServiceWorker(registration: ServiceWorkerRegistration) {
  const worker = registration.waiting;
  if (!worker || !userRequestedUpdate || activationRequested.has(worker) || activationInFlight.has(worker)) return false;
  // Two caller paths (update().then and immediate waiting) can race across await.
  // Claim this worker BEFORE the network preflight, without marking it activated.
  activationInFlight.add(worker);
  try {
    const release = await fetchPublishedRelease();
    if (!release || classifyPublishedRelease(APP_VERSION, __APP_BUILD_VERSION__, release) !== "newer" ||
      !isWaitingWorkerForPublishedRelease(worker.scriptURL, release.version as string, window.location.origin)) {
      logSw("SKIP_WAITING bloqueado: worker e publicação não correspondem ou são antigos");
      userRequestedUpdate = false;
      cancelExplicitUpdateTimer();
      notifyListeners(false);
      return false;
    }
    // Recheck after the async preflight: a field operation could start meanwhile.
    if (hasCriticalOperations()) {
      schedulePostDrainAction(() => {
        if (userRequestedUpdate) void activateWaitingServiceWorker(registration);
      });
      return false;
    }
    // Do not let an obsolete worker activate if the waiting reference changed.
    if (!userRequestedUpdate || registration.waiting !== worker || activationRequested.has(worker)) return false;
    activationRequested.add(worker);
    logSw("Aplicando atualização (SKIP_WAITING)");
    worker.postMessage({ type: "SKIP_WAITING" });
    return true;
  } finally {
    activationInFlight.delete(worker);
  }
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

async function fetchPublishedRelease(): Promise<PublishedRelease | null> {
  try {
    const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "cache-control": "no-cache" },
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return data && typeof data === "object" ? data as PublishedRelease : null;
  } catch {
    return null;
  }
}

async function ensureLatestPublishedVersion(published?: PublishedRelease | null) {
  const release = published ?? await fetchPublishedRelease();
  if (!release || classifyPublishedRelease(APP_VERSION, __APP_BUILD_VERSION__, release) !== "newer") {
    return false;
  }
  const remoteVersion = release.version as string;
  if (remoteVersion === lastKnownRemoteVersion) return false;

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
      // A newer version.json does not mean the offline shell finished installing.
      // Do not advertise an update that cannot be safely applied yet.
      logSw("Aguardando worker de atualização completo", remoteVersion);
      return false;
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
    const release = await fetchPublishedRelease();
    const status = classifyPublishedRelease(APP_VERSION, __APP_BUILD_VERSION__, release);
    if (status !== "newer" && status !== "current") {
      logSw("Sem update: metadata remota inválida ou anterior ao build carregado", status);
      return false;
    }
    await ensureLatestPublishedVersion(release);
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

  // Nunca sequer registrar um SW vindo de uma publicação regressiva.
  // O SW/cache instalado continua intacto caso /version.json esteja offline ou antigo.
  void (async () => {
    const release = await fetchPublishedRelease();
    const status = classifyPublishedRelease(APP_VERSION, __APP_BUILD_VERSION__, release);
    if (!release || (status !== "current" && status !== "newer")) {
      logSw("SW existente preservado: release inválida/mais antiga", status);
      return;
    }
    const reg = await navigator.serviceWorker.register(`/sw.js?v=${release.version as string}`, { updateViaCache: "none" });
    swRegistration = reg;
    attachRegistrationListeners(reg);
    void reg.update();
    void maybeUpdateActiveServiceWorker();
    if (reg.waiting && navigator.serviceWorker.controller) notifyWaiting(reg);
  })().catch((err) => console.warn("SW registration failed:", err));

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
      if (!("serviceWorker" in navigator)) {
        setUpdateAvailable(false);
        return;
      }
      try {
        const reg = swRegistration ?? await navigator.serviceWorker.getRegistration();
        if (!reg || !reg.waiting || !navigator.serviceWorker.controller) {
          setUpdateAvailable(false);
          return;
        }
        swRegistration = reg;
        attachRegistrationListeners(reg);
        // Never trust a waiting worker until metadata and origin/version match.
        notifyWaiting(reg);
      } catch {
        setUpdateAvailable(false);
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
    reloadWhenAuthIdle(() => {
      if (hasCriticalOperations()) {
        schedulePostDrainAction(() => void forceRefresh());
        return;
      }
      window.location.reload();
    });
  }, []);

  return { updateAvailable, applyUpdate, forceRefresh };
}
