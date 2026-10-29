import { useEffect, useState, useCallback } from "react";
import { Bell, BellOff, BellPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  activatePushNotifications,
  getCurrentPushSubscription,
  getIosStandaloneRequirement,
  getReadyRegistration,
  getStoredPushEnabledPreference,
  isPushSupported,
  requestPushPermission,
  savePushSubscription,
  setStoredPushEnabledPreference,
  isVapidConfigured,
} from "@/lib/pushNotifications";

type State = "loading" | "missing" | "denied" | "enabled" | "disabled" | "unsupported";

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
    if (!isVapidConfigured()) { setState("unsupported"); return; }
    if (!isPushSupported()) { setState("unsupported"); return; }
    if (Notification.permission === "denied") { setState("denied"); return; }
    setState("missing");

    try {
      const reg = await getReadyRegistration();
      const sub = await getCurrentPushSubscription(reg);
      if (!sub) { setState("missing"); return; }
      const { data } = await supabase
        .from("push_subscriptions")
        .select("enabled")
        .eq("user_id", user.id)
        .eq("endpoint", sub.endpoint)
        .maybeSingle();
      if (!data) {
        const enabled = getStoredPushEnabledPreference();
        await savePushSubscription(user.id, sub, enabled);
        setState(enabled ? "enabled" : "disabled");
        return;
      }
      const enabled = data.enabled !== false;
      setStoredPushEnabledPreference(enabled);
      setState(enabled ? "enabled" : "disabled");
    } catch {
      setState("missing");
    }
  }, [session, user?.id]);

  useEffect(() => {
    if (!session || !user?.id) { setState("loading"); return; }
    void refresh();
  }, [session, user?.id, refresh]);

  if (!session || !user?.id) return null;
  if (state === "loading" || !isVapidConfigured()) return null;

  const enableFlow = async () => {
    if (!isVapidConfigured()) { toast.error("Notificações temporariamente indisponíveis"); return; }
    setBusy(true);
    try {
      const { isIos, isStandalone } = getIosStandaloneRequirement();
      if (isIos && !isStandalone) {
        toast.error("No iPhone, instale na Tela de Início e abra pelo ícone para ativar notificações.");
        return;
      }
      if (!isPushSupported()) {
        toast.error("Este aparelho ou navegador não permite notificações push neste modo.");
        return;
      }
      const perm = await requestPushPermission();
      if (perm !== "granted") {
        toast.error(perm === "denied" ? "Permissão negada nas configurações do aparelho" : "Permissão não concedida");
        await refresh();
        return;
      }
      const { registration } = await activatePushNotifications(user.id);
      try {
        await registration.showNotification("CONSUBOV", {
          body: "Notificações ativadas com sucesso ✓",
          icon: "/icon-192.png",
          badge: "/icon-96.png",
          tag: `consubov-ativado-${Date.now()}`,
        });
      } catch {
        /* ignore */
      }
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
    setStoredPushEnabledPreference(novo);
    setState(novo ? "enabled" : "disabled");
    toast.success(novo ? "Notificações ativadas" : "Notificações desativadas");
  };

  const onClick = () => {
    if (busy) return;
    if (state === "missing" || state === "denied" || state === "unsupported") return void enableFlow();
    if (state === "enabled") return void toggleEnabled(false);
    if (state === "disabled") return void enableFlow();
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
