import { useEffect, useState, useCallback } from "react";
import { Bell, BellOff, BellPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

type State = "loading" | "missing" | "denied" | "enabled" | "disabled" | "unsupported";

/**
 * Botão flutuante por usuário, sempre visível quando logado:
 *  - missing/denied → ativa (pede permissão e inscreve)
 *  - enabled → desativa (mantém inscrição, só marca enabled=false)
 *  - disabled → reativa
 */
export function UserNotificationToggle() {
  const { user, session } = useAuth();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!session || !user?.id) return;
    if (!isSupported()) { setState("unsupported"); return; }
    if (Notification.permission === "denied") { setState("denied"); return; }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) { setState("missing"); return; }
      const { data } = await supabase
        .from("push_subscriptions")
        .select("enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) { setState("missing"); return; }
      setState((data as { enabled?: boolean }).enabled === false ? "disabled" : "enabled");
    } catch {
      setState("missing");
    }
  }, [session, user?.id]);

  useEffect(() => {
    if (!session || !user?.id) { setState("loading"); return; }
    void refresh();
  }, [session, user?.id, refresh]);

  if (!session || !user?.id) return null;
  if (state === "loading") return null;

  const enableFlow = async () => {
    if (!VAPID_PUBLIC_KEY) { toast.error("VAPID ausente no servidor"); return; }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error(perm === "denied" ? "Permissão negada nas configurações do aparelho" : "Permissão não concedida");
        await refresh();
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
        });
      }
      const { error } = await supabase.from("push_subscriptions").upsert(
        [{ user_id: user.id, subscription: JSON.parse(JSON.stringify(sub.toJSON())), enabled: true }],
        { onConflict: "user_id" },
      );
      if (error) { toast.error("Falha ao salvar: " + error.message); return; }
      toast.success("Notificações ativadas");
      setState("enabled");
    } catch (e) {
      toast.error("Falha: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const toggleEnabled = async (novo: boolean) => {
    setBusy(true);
    const { error } = await supabase
      .from("push_subscriptions")
      .update({ enabled: novo })
      .eq("user_id", user.id);
    setBusy(false);
    if (error) { toast.error("Falha ao salvar preferência"); return; }
    setState(novo ? "enabled" : "disabled");
    toast.success(novo ? "Notificações ativadas" : "Notificações desativadas");
  };

  const onClick = () => {
    if (busy) return;
    if (state === "missing" || state === "denied" || state === "unsupported") return void enableFlow();
    if (state === "enabled") return void toggleEnabled(false);
    if (state === "disabled") return void toggleEnabled(true);
  };

  const visual =
    state === "enabled"
      ? { Icon: Bell, bg: "bg-primary text-primary-foreground", label: "Notificações ativas (toque para desativar)" }
      : state === "disabled"
      ? { Icon: BellOff, bg: "bg-muted text-muted-foreground", label: "Notificações desativadas (toque para ativar)" }
      : state === "denied"
      ? { Icon: BellOff, bg: "bg-destructive text-destructive-foreground", label: "Bloqueadas — libere nas permissões do app" }
      : { Icon: BellPlus, bg: "bg-secondary text-secondary-foreground", label: "Ativar notificações" };

  const { Icon } = visual;

  return (
    <button
      onClick={onClick}
      disabled={busy || state === "unsupported"}
      aria-label={visual.label}
      title={visual.label}
      className={`fixed bottom-2 right-14 z-[80] h-9 w-9 rounded-full shadow-md flex items-center justify-center border border-border ${visual.bg} disabled:opacity-60`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
