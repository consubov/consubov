import { useEffect, useState } from "react";
import { Bell, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  activatePushNotifications,
  getCurrentPushSubscription,
  getIosStandaloneRequirement,
  getReadyRegistration,
  getStoredPushEnabledPreference,
  isPushSupported,
  requestPushPermission,
  savePushSubscription,
  isVapidConfigured,
} from "@/lib/pushNotifications";

function isLovablePreview() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com") || h.includes("lovable.app");
}

const BANNER_DECISION_KEY = "consubov_notif_banner_decision";

function getBannerDecision(): "enabled" | "later" | null {
  try {
    const v = window.localStorage.getItem(BANNER_DECISION_KEY);
    return v === "enabled" || v === "later" ? v : null;
  } catch {
    return null;
  }
}

function saveBannerDecision(decision: "enabled" | "later") {
  try {
    window.localStorage.setItem(BANNER_DECISION_KEY, decision);
  } catch {
    /* ignore */
  }
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
    if (!isVapidConfigured()) {
      setStatus("hidden");
      return;
    }
    if (getBannerDecision()) {
      setStatus("hidden");
      return;
    }
    if (!isPushSupported()) {
      setStatus("unsupported");
      return;
    }
    if (isLovablePreview()) {
      setStatus("preview");
      return;
    }
    // Verifica se admin desativou notificações globalmente
    (async () => {
      const { data: cfg } = await supabase
        .from("configuracoes_gerais")
        .select("valor")
        .eq("chave", "notificacoes_globais_ativas")
        .maybeSingle();
      if (cfg && Number(cfg.valor) === 0) {
        setStatus("hidden");
        return;
      }
      continueCheck();
    })();
    function continueCheck() {
      const perm = Notification.permission;

      if (perm === "granted") {
        (async () => {
          try {
            const reg = await getReadyRegistration();
            const sub = await getCurrentPushSubscription(reg);
            if (!sub) {
              setStatus("needs-enable");
              return;
            }
            const { data } = await supabase
              .from("push_subscriptions")
              .select("id, enabled")
              .eq("user_id", user!.id)
              .eq("endpoint", sub.endpoint)
              .maybeSingle();
            if (!data) {
              await savePushSubscription(user!.id, sub, getStoredPushEnabledPreference());
              setStatus(getStoredPushEnabledPreference() ? "hidden" : "needs-enable");
              return;
            }
            if (data.enabled === false) {
              setStatus("needs-enable");
              return;
            }
            setStatus("hidden");
          } catch {
            setStatus("needs-enable");
          }
        })();
        return;
      }
      if (perm === "denied") {
        setStatus("denied");
        return;
      }
      setStatus("needs-enable");
    }
  }, [dismissedThisSession, session, user?.id]);


  const dismiss = () => {
    setDismissedThisSession(true);
    setStatus("hidden");
  };

  const dismissLater = () => {
    saveBannerDecision("later");
    setDismissedThisSession(true);
    setStatus("hidden");
  };

  const enable = async () => {
    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      const { isIos, isStandalone } = getIosStandaloneRequirement();
      if (isIos && !isStandalone) {
        setError("No iPhone: toque em Compartilhar → Adicionar à Tela de Início e abra pelo ícone.");
        setBusy(false);
        return;
      }
      if (!isVapidConfigured()) {
        setError("Notificações temporariamente indisponíveis. Tente mais tarde.");
        setBusy(false);
        return;
      }
      const permission = await requestPushPermission();
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
      const { registration } = await activatePushNotifications(user!.id);
      // Show local test notification to confirm it works
      try {
        await registration.showNotification("CONSUBOV", {
          body: "Notificações ativadas com sucesso ✓",
          icon: "/icon-192.png",
          badge: "/icon-96.png",
          tag: `consubov-welcome-${Date.now()}`,
        });
      } catch {
        /* ignore */
      }
      setOkMsg("Notificações ativadas!");
      saveBannerDecision("enabled");
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
            <Button size="sm" variant="ghost" onClick={dismissLater}>
              Agora não
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
