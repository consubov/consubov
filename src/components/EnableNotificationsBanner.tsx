import { useEffect, useState } from "react";
import { Bell, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

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

function isLovablePreview() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com") || h.includes("lovable.app");
}

function isIosStandaloneRequired() {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
  const isStandalone =
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return { isIos, isStandalone };
}

type Status = "needs-enable" | "denied" | "preview" | "unsupported" | "hidden";

export function EnableNotificationsBanner() {
  const { user, session } = useAuth();
  const [status, setStatus] = useState<Status>("hidden");
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !user?.id) return;
    if (dismissedThisSession) return;
    if (!isSupported()) {
      setStatus("unsupported");
      return;
    }
    if (isLovablePreview()) {
      setStatus("preview");
      return;
    }
    const perm = Notification.permission;

    if (perm === "granted") {
      // already granted — verify subscription exists in DB
      (async () => {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (!sub) {
            setStatus("needs-enable");
            return;
          }
          const { data } = await supabase
            .from("push_subscriptions")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (!data) {
            // re-save
            await supabase.from("push_subscriptions").upsert(
              [{ user_id: user.id, subscription: JSON.parse(JSON.stringify(sub.toJSON())) }],
              { onConflict: "user_id" },
            );
          }
          setStatus("hidden");
        } catch {
          setStatus("needs-enable");
        }
      })();
      return;
    }
    if (perm === "denied") {
      // Always show denied banner, ignore dismiss
      setStatus("denied");
      return;
    }
    // Não persistir "Agora não": reinstalar o PWA no Android pode manter o
    // localStorage do navegador, e isso escondia o pedido de permissão.
    setStatus("needs-enable");
  }, [dismissedThisSession, session, user?.id]);

  const dismiss = () => {
    setDismissedThisSession(true);
    setStatus("hidden");
  };

  const enable = async () => {
    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      const { isIos, isStandalone } = isIosStandaloneRequired();
      if (isIos && !isStandalone) {
        setError("No iPhone: toque em Compartilhar → Adicionar à Tela de Início e abra pelo ícone.");
        setBusy(false);
        return;
      }
      if (!VAPID_PUBLIC_KEY) {
        setError("Chave VAPID ausente no servidor.");
        setBusy(false);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setStatus("denied");
        setBusy(false);
        return;
      }
      if (permission !== "granted") {
        setError("Toque em Permitir quando o aparelho solicitar a permissão de notificação.");
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
      const { error: upErr } = await supabase
        .from("push_subscriptions")
        .upsert(
          [{ user_id: user!.id, subscription: JSON.parse(JSON.stringify(subscription.toJSON())) }],
          { onConflict: "user_id" },
        );
      if (upErr) {
        console.error("[Push] upsert error", upErr);
        setError("Falha ao salvar inscrição: " + upErr.message);
        setBusy(false);
        return;
      }
      // Show local test notification to confirm it works
      try {
        await registration.showNotification("CONSUBOV", {
          body: "Notificações ativadas com sucesso ✓",
          icon: "/icon-192.png",
          badge: "/icon-96.png",
          tag: "consubov-welcome",
        });
      } catch {
        /* ignore */
      }
      setOkMsg("Notificações ativadas!");
      setTimeout(() => setStatus("hidden"), 1500);
    } catch (err) {
      console.error("[Push] enable failed", err);
      setError("Falha: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  if (status === "hidden") return null;

  const wrapper =
    "fixed bottom-4 inset-x-3 z-[55] mx-auto max-w-md rounded-2xl bg-card border border-border shadow-xl";

  if (status === "preview") {
    return (
      <div className={wrapper}>
        <div className="flex items-start gap-3 p-3">
          <div className="shrink-0 h-11 w-11 rounded-xl bg-amber-100 flex items-center justify-center">
            <AlertCircle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Notificações só funcionam no app publicado</p>
              <button onClick={dismiss} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Abra <strong>consubov.com.br</strong> no celular para ativar as notificações push do sistema.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "unsupported") {
    return (
      <div className={wrapper}>
        <div className="flex items-start gap-3 p-3">
          <div className="shrink-0 h-11 w-11 rounded-xl bg-muted flex items-center justify-center">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Navegador sem suporte a push</p>
              <button onClick={dismiss} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Use Chrome, Edge ou Samsung Internet em Android para receber notificações.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className={wrapper}>
        <div className="flex items-start gap-3 p-3">
          <div className="shrink-0 h-11 w-11 rounded-xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Notificações bloqueadas</p>
              <button onClick={dismiss} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Você bloqueou as notificações. Para reativar no <strong>Android Chrome</strong>:
            </p>
            <ol className="text-xs text-muted-foreground mt-1 list-decimal pl-4 space-y-0.5">
              <li>Toque no <strong>cadeado</strong> ao lado da URL</li>
              <li>Toque em <strong>Permissões</strong> → <strong>Notificações</strong></li>
              <li>Selecione <strong>Permitir</strong> e recarregue a página</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // needs-enable
  return (
    <div role="status" aria-live="polite" className={wrapper}>
      <div className="flex items-start gap-3 p-3">
        <div className="shrink-0 h-11 w-11 rounded-xl overflow-hidden bg-primary flex items-center justify-center">
          <img src="/icon-192.png" alt="Consubov" className="h-full w-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Ative as notificações</p>
            <button onClick={dismiss} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Receba alertas em tempo real, mesmo com o app fechado ou celular bloqueado.
          </p>
          {error && <p className="text-xs text-destructive mt-1.5">{error}</p>}
          {okMsg && <p className="text-xs text-emerald-600 mt-1.5">{okMsg}</p>}
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={enable}
              disabled={busy}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Bell className="h-4 w-4 mr-1.5" />
              {busy ? "Ativando..." : "Ativar notificações"}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Agora não
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
