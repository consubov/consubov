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

async function saveSubscription(userId: string, subscription: PushSubscription) {
  const payload = {
    user_id: userId,
    subscription: JSON.parse(JSON.stringify(subscription.toJSON())),
  };

  const { error } = await supabase.from("push_subscriptions").insert([payload]);
  if (!error || error.code === "23505") return null;
  return error;
}

/**
 * Registra o usuário para Web Push, sem alterar nada das notificações
 * internas existentes. Faz upsert na tabela push_subscriptions por user_id.
 */
export function usePushNotifications() {
  const { user, session } = useAuth();
  const ranForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session || !user?.id) return;
    if (ranForUserRef.current === user.id) return;

    console.log("[Push] verificando suporte...");
    console.log("[Push] VITE_VAPID_PUBLIC_KEY:", VAPID_PUBLIC_KEY ? `${VAPID_PUBLIC_KEY.slice(0, 12)}...` : "NÃO DEFINIDA");

    if (!isSupported()) {
      console.log("[Push] não suportado neste navegador");
      return;
    }
    console.log("[Push] suporte OK");

    if (!VAPID_PUBLIC_KEY) {
      console.warn("[Push] VITE_VAPID_PUBLIC_KEY ausente — abortando");
      return;
    }

    ranForUserRef.current = user.id;

    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        console.log("[Push] service worker pronto");

        const permission = Notification.permission;
        console.log("[Push] permissão atual = " + permission);
        if (permission === "default") {
          console.log("[Push] aguardando ação do usuário no banner para pedir permissão");
          ranForUserRef.current = null;
          return;
        }
        if (permission !== "granted") {
          console.warn("[Push] permissão não concedida — abortando");
          return;
        }

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          console.log("[Push] criando nova subscription...");
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
          });
        }
        console.log("[Push] subscription obtida:", subscription.endpoint);

        console.log("[Push] salvando no Supabase...");
        const error = await saveSubscription(user.id, subscription);

        if (error) {
          console.error("[Push] erro ao salvar no Supabase:", error.message);
        } else {
          console.log("[Push] salvo com sucesso");
        }
      } catch (err) {
        console.error("[Push] falha no registro:", err);
      }
    })();
  }, [session, user?.id]);
}
