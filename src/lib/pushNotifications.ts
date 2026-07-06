import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

const PUSH_ENABLED_PREF_KEY = "consubov:push-enabled";

type PushSubscriptionPayload = Json & { endpoint?: string };

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getNotificationPermission(): NotificationPermission {
  if (!isPushSupported()) return "denied";
  return Notification.permission;
}

export function getIosStandaloneRequirement() {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
  const isStandalone =
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return { isIos, isStandalone };
}

export function getStoredPushEnabledPreference() {
  try {
    return window.localStorage.getItem(PUSH_ENABLED_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function setStoredPushEnabledPreference(enabled: boolean) {
  try {
    window.localStorage.setItem(PUSH_ENABLED_PREF_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function sameApplicationServerKey(subscription: PushSubscription) {
  if (!VAPID_PUBLIC_KEY) return true;
  const current = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  const existing = subscription.options.applicationServerKey;
  if (!existing) return false;
  const existingBytes = new Uint8Array(existing);
  return current.length === existingBytes.length && current.every((value, index) => value === existingBytes[index]);
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return "denied";
  if (Notification.permission !== "default") return Notification.permission;

  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (permission: NotificationPermission) => {
      if (settled) return;
      settled = true;
      resolve(permission);
    };

    window.setTimeout(() => done(Notification.permission), 15000);

    try {
      const requestPermission = Notification.requestPermission.bind(Notification) as unknown as {
        (callback: (permission: NotificationPermission) => void): Promise<NotificationPermission> | void;
        (): Promise<NotificationPermission>;
      };
      const result = requestPermission(done);
      if (result && typeof result.then === "function") result.then(done).catch(reject);
    } catch (error) {
      try {
        Notification.requestPermission().then(done).catch(reject);
      } catch (fallbackError) {
        reject(fallbackError || error);
      }
    }
  });
}

async function waitForReadyServiceWorker(timeoutMs: number) {
  const timeout = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error("Service worker não ficou pronto")), timeoutMs);
  });
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

export async function getReadyRegistration(): Promise<ServiceWorkerRegistration> {
  try {
    return await waitForReadyServiceWorker(5000);
  } catch {
    const existing = await navigator.serviceWorker.getRegistration();
    const registration = existing ?? (await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }));
    if (registration.active) return registration;

    try {
      return await waitForReadyServiceWorker(8000);
    } catch {
      return registration;
    }
  }
}

export async function getCurrentPushSubscription(registration: ServiceWorkerRegistration) {
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return null;
  if (!sameApplicationServerKey(subscription)) return null;
  return subscription;
}

export async function getFreshSubscription(registration: ServiceWorkerRegistration) {
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameApplicationServerKey(subscription)) {
    await subscription.unsubscribe().catch(() => undefined);
    subscription = null;
  }
  if (!subscription) {
    if (!VAPID_PUBLIC_KEY) throw new Error("Chave VAPID ausente no servidor");
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
    });
  }
  return subscription;
}

export async function savePushSubscription(userId: string, subscription: PushSubscription, enabled: boolean) {
  const subJson = JSON.parse(JSON.stringify(subscription.toJSON())) as PushSubscriptionPayload;
  const endpoint = subJson.endpoint ?? subscription.endpoint;
  if (!endpoint) return new Error("subscription sem endpoint");

  const { error } = await supabase.rpc("register_push_subscription", {
    p_endpoint: endpoint,
    p_subscription: subJson,
    p_enabled: enabled,
  });
  if (!error) return null;

  const payload = { user_id: userId, endpoint, subscription: subJson, enabled };
  const { error: insertError } = await supabase.from("push_subscriptions").insert([payload]);
  if (!insertError) return null;
  if (insertError.code === "23505") {
    const { error: updateError } = await supabase
      .from("push_subscriptions")
      .update({ user_id: userId, subscription: subJson, enabled })
      .eq("endpoint", endpoint)
      .eq("user_id", userId);
    return updateError ?? null;
  }
  return insertError;
}

export async function activatePushNotifications(userId: string) {
  if (!VAPID_PUBLIC_KEY) throw new Error("Chave VAPID ausente no servidor");
  if (!isPushSupported()) throw new Error("Este aparelho ou navegador não permite notificações push neste modo");
  if (Notification.permission !== "granted") throw new Error("Permissão de notificação não concedida");

  const registration = await getReadyRegistration();
  const subscription = await getFreshSubscription(registration);
  const error = await savePushSubscription(userId, subscription, true);
  if (error) throw error;
  setStoredPushEnabledPreference(true);
  return { registration, subscription };
}