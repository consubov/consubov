import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const DISMISS_KEY = "consubov_push_dismissed_until";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

function isSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isIosStandaloneRequired() {
  // iOS Safari only supports Web Push when installed to Home Screen
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
  const isStandalone =
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return { isIos, isStandalone };
}

/**
 * Banner amigável que pede ao usuário para ativar as notificações.
 * Em iOS exige PWA instalado — mostramos instruções se ainda não estiver.
 */
export function EnableNotificationsBanner() {
  const { user, session } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !user?.id) return;
    if (!isSupported()) return;
    const dismissedUntil = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() < dismissedUntil) return;
    if (Notification.permission === "granted") return;
    if (Notification.permission === "denied") return;
    setShow(true);
  }, [session, user?.id]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 1000 * 60 * 60 * 24 * 3));
    setShow(false);
  };

  const enable = async () => {
    setError(null);
    setBusy(true);
    try {
      const { isIos, isStandalone } = isIosStandaloneRequired();
      if (isIos && !isStandalone) {
        setError("Para receber notificações no iPhone, adicione o app à Tela de Início (Compartilhar → Adicionar à Tela Inicial) e abra-o pelo ícone.");
        setBusy(false);
        return;
      }
      if (!VAPID_PUBLIC_KEY) {
        setError("Notificações não configuradas no servidor.");
        setBusy(false);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Permissão negada. Ative em Ajustes do navegador.");
        setBusy(false);
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
        });
      }
      await supabase
        .from("push_subscriptions")
        .upsert(
          [{ user_id: user!.id, subscription: JSON.parse(JSON.stringify(subscription.toJSON())) }],
          { onConflict: "user_id" },
        );
      setShow(false);
    } catch (err) {
      console.error("[Push] enable failed", err);
      setError("Falha ao ativar notificações. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 inset-x-3 z-[55] mx-auto max-w-md rounded-2xl bg-card border border-border shadow-xl"
    >
      <div className="flex items-start gap-3 p-3">
        <div className="shrink-0 h-11 w-11 rounded-xl overflow-hidden bg-primary flex items-center justify-center">
          <img src="/icon-192.png" alt="Consubov" className="h-full w-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Ative as notificações</p>
            <button
              onClick={dismiss}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Receba alertas em tempo real sobre salgas, pesagens e atividades do rebanho — como no WhatsApp.
          </p>
          {error && <p className="text-xs text-destructive mt-1.5">{error}</p>}
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={enable} disabled={busy} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Bell className="h-4 w-4 mr-1.5" />
              {busy ? "Ativando..." : "Ativar notificações"}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>Agora não</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
