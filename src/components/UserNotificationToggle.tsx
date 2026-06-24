import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Botão flutuante por usuário — permite que cada pessoa ative ou desative
 * suas próprias notificações sem afetar os demais. Aparece somente quando o
 * usuário já está logado e tem uma inscrição push registrada.
 */
export function UserNotificationToggle() {
  const { user, session } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session || !user?.id) {
      setEnabled(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("push_subscriptions")
        .select("enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setEnabled(Boolean((data as { enabled?: boolean }).enabled ?? true));
      else setEnabled(null);
    })();
  }, [session, user?.id]);

  if (enabled === null) return null;

  const toggle = async () => {
    if (!user?.id) return;
    setLoading(true);
    const novo = !enabled;
    const { error } = await supabase
      .from("push_subscriptions")
      .update({ enabled: novo })
      .eq("user_id", user.id);
    setLoading(false);
    if (error) {
      toast.error("Falha ao salvar preferência");
      return;
    }
    setEnabled(novo);
    toast.success(novo ? "Suas notificações foram ativadas" : "Suas notificações foram desativadas");
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={enabled ? "Desativar minhas notificações" : "Ativar minhas notificações"}
      title={enabled ? "Minhas notificações: ativas (toque para desativar)" : "Minhas notificações: desativadas (toque para ativar)"}
      className={`fixed bottom-2 right-14 z-[80] h-9 w-9 rounded-full shadow-md flex items-center justify-center border border-border ${
        enabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      } disabled:opacity-60`}
    >
      {enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
    </button>
  );
}
