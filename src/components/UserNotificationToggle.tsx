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

function getIosStandaloneRequirement() {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
  const isStandalone =
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return { isIos, isStandalone };
}

function sameApplicationServerKey(subscription: PushSubscription) {
  if (!VAPID_PUBLIC_KEY) return true;
  const current = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  const existing = subscription.options.applicationServerKey;
  if (!existing) return false;
  const existingBytes = new Uint8Array(existing);
  return current.length === existingBytes.length && current.every((value, index) => value === existingBytes[index]);
}

async function getFreshSubscription(reg: ServiceWorkerRegistration) {
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameApplicationServerKey(sub)) {
    await sub.unsubscribe().catch(() => undefined);
    sub = null;
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as unknown as BufferSource,
    });
  }
  return sub;
}

type State = "loading" | "missing" | "denied" | "enabled" | "disabled" | "unsupported";

async function getReadyRegistration(): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error("Service worker não ficou pronto")), 5000);
  });

  try {
    return await Promise.race([navigator.serviceWorker.ready, timeout]);
  } catch {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    return navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  }
}

async function saveSubscriptionForUser(userId: string, subscription: PushSubscription) {
  const subJson = JSON.parse(JSON.stringify(subscription.toJSON())) as { endpoint?: string };
  const endpoint = subJson.endpoint ?? subscription.endpoint;
  if (!endpoint) return { error: new Error("subscription sem endpoint") };
  const payload = {
    user_id: userId,
    endpoint,
    subscription: subJson,
    enabled: true,
  };

  const { error } = await supabase.from("push_subscriptions").insert([payload]);
  if (!error) return { error: null };

  if (error.code === "23505") {
    return supabase
      .from("push_subscriptions")
      .update({ enabled: true, user_id: userId, subscription: subJson })
      .eq("endpoint", endpoint);
  }

  return { error };
}

interface UserNotificationToggleProps {
  floating?: boolean;
}

/**
 * Botão de notificações por usuário, sempre visível quando logado:
 *  - missing/denied → ativa (pede permissão e inscreve)
 *  - enabled → desativa (mantém inscrição, só marca enabled=false)
 *  - disabled → reativa
 */
export function UserNotificationToggle({ floating = false }: UserNotificationToggleProps) {
  const { user, session } = useAuth();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!session || !user?.id) return;
    if (!isSupported()) { setState("unsupported"); return; }
    if (Notification.permission === "denied") { setState("denied"); return; }
    setState("missing");

    try {
      const reg = await getReadyRegistration();
      const sub = await reg.pushManager.getSubscription();
      if (!sub) { setState("missing"); return; }
      if (!sameApplicationServerKey(sub)) { setState("missing"); return; }
      const { data } = await supabase
        .from("push_subscriptions")
        .select("enabled")
        .eq("user_id", user.id)
        .limit(20);
      if (!data || data.length === 0) { setState("missing"); return; }
      setState(data.some((row) => row.enabled !== false) ? "enabled" : "disabled");
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
      const { isIos, isStandalone } = getIosStandaloneRequirement();
      if (isIos && !isStandalone) {
        toast.error("No iPhone, instale na Tela de Início e abra pelo ícone para ativar notificações.");
        return;
      }
      if (!isSupported()) {
        toast.error("Este aparelho ou navegador não permite notificações push neste modo.");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error(perm === "denied" ? "Permissão negada nas configurações do aparelho" : "Permissão não concedida");
        await refresh();
        return;
      }
      const reg = await getReadyRegistration();
      const sub = await getFreshSubscription(reg);
      const { error } = await saveSubscriptionForUser(user.id, sub);
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

  const visual = floating
    ? state === "enabled"
      ? { Icon: Bell, bg: "bg-primary text-primary-foreground", label: "Notificações ativas (toque para desativar)" }
      : state === "disabled"
      ? { Icon: BellOff, bg: "bg-muted text-muted-foreground", label: "Notificações desativadas (toque para ativar)" }
      : state === "denied"
      ? { Icon: BellOff, bg: "bg-destructive text-destructive-foreground", label: "Bloqueadas — libere nas permissões do app" }
      : { Icon: BellPlus, bg: "bg-secondary text-secondary-foreground", label: "Ativar notificações" }
    : state === "enabled"
      ? { Icon: Bell, bg: "bg-primary-foreground text-primary", label: "Notificações ativas (toque para desativar)" }
      : state === "disabled"
      ? { Icon: BellOff, bg: "bg-primary-foreground/20 text-primary-foreground", label: "Notificações desativadas (toque para ativar)" }
      : state === "denied"
      ? { Icon: BellOff, bg: "bg-destructive text-destructive-foreground", label: "Bloqueadas — libere nas permissões do app" }
      : { Icon: BellPlus, bg: "bg-secondary text-secondary-foreground", label: "Ativar notificações" };

  const { Icon } = visual;
  const base =
    "h-8 w-8 rounded-full shadow-sm flex items-center justify-center border border-border disabled:opacity-60";

  return (
    <button
      onClick={onClick}
      disabled={busy || state === "unsupported"}
      aria-label={visual.label}
      title={visual.label}
      style={
        floating
          ? { top: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }
          : undefined
      }
      className={`${floating ? "fixed right-[4.25rem] z-[100]" : "relative"} ${base} ${visual.bg}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
