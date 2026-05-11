import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

function isSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Registra o usuário para Web Push, sem alterar nada das notificações
 * internas existentes. Faz upsert na tabela push_subscriptions por user_id.
 * É seguro chamar várias vezes — só executa uma vez por sessão por usuário.
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const ranForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    if (ranForUserRef.current === user.id) return;
    if (!isSupported() || !VAPID_PUBLIC_KEY) return;

    // Não pedir permissão dentro de iframes (preview do editor).
    try {
      if (window.self !== window.top) return;
    } catch {
      return;
    }

    ranForUserRef.current = user.id;

    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;

        let permission = Notification.permission;
        if (permission === "default") {
          permission = await Notification.requestPermission();
        }
        if (permission !== "granted") return;

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
          });
        }

        const { error } = await supabase
          .from("push_subscriptions")
          .upsert(
            [
              {
                user_id: user.id,
                subscription: JSON.parse(JSON.stringify(subscription.toJSON())),
              },
            ],
            { onConflict: "user_id" },
          );

        if (error) console.warn("[push] upsert subscription failed:", error.message);
      } catch (err) {
        console.warn("[push] register failed:", err);
      }
    })();
  }, [user?.id]);
}
