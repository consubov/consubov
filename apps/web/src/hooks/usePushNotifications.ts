import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getCurrentPushSubscription,
  getReadyRegistration,
  getStoredPushEnabledPreference,
  isPushSupported,
  savePushSubscription,
  isVapidConfigured,
} from "@/lib/pushNotifications";

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

    if (!isPushSupported()) {
      return;
    }

    if (!isVapidConfigured()) {
      // Não solicita permissão, não altera inscrição existente e não mostra erro técnico.
      return;
    }

    ranForUserRef.current = user.id;

    (async () => {
      try {
        const registration = await getReadyRegistration();

        const permission = Notification.permission;
        if (permission === "default") {
          ranForUserRef.current = null;
          return;
        }
        if (permission !== "granted") {
          console.warn("[Push] permissão não concedida — abortando");
          return;
        }

        const subscription = await getCurrentPushSubscription(registration);
        if (!subscription) {
          ranForUserRef.current = null;
          return;
        }

        const error = await savePushSubscription(user.id, subscription, getStoredPushEnabledPreference());

        if (error) {
          console.error("[Push] erro ao salvar no Supabase:", error.message);
        }
      } catch (err) {
        console.error("[Push] falha no registro:", err);
      }
    })();
  }, [session, user?.id]);
}
