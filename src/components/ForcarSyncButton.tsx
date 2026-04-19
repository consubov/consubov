import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ForcarSyncButtonProps {
  /** auth user_id of the target capataz */
  targetUserId: string | null | undefined;
  /** display name (used in confirmation toast) */
  targetName: string;
  size?: "sm" | "default" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
}

/**
 * Sends a remote "sync" signal to a specific capataz device via Supabase Realtime.
 * Inserts a row into sync_commands; the capataz PWA listens and triggers sync.
 */
export function ForcarSyncButton({
  targetUserId,
  targetName,
  size = "icon",
  variant = "ghost",
}: ForcarSyncButtonProps) {
  const [sending, setSending] = useState(false);

  const handleClick = async () => {
    if (!targetUserId) {
      toast.error("Este usuário não possui conta vinculada");
      return;
    }
    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const senderId = sessionData?.session?.user?.id ?? null;

      const { error } = await supabase.from("sync_commands").insert({
        target_user_id: targetUserId,
        sender_user_id: senderId,
        command: "sync",
      });
      if (error) throw error;
      toast.success(`Sinal enviado para ${targetName}`);
    } catch (err: any) {
      console.error("[ForcarSyncButton] error:", err);
      toast.error("Erro ao enviar sinal: " + (err?.message ?? "desconhecido"));
    } finally {
      setSending(false);
    }
  };

  if (size === "icon") {
    return (
      <Button
        size="icon"
        variant={variant}
        onClick={handleClick}
        disabled={sending || !targetUserId}
        title="Forçar sincronização"
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-primary" />}
      </Button>
    );
  }

  return (
    <Button size={size} variant={variant} onClick={handleClick} disabled={sending || !targetUserId}>
      {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
      Forçar Sync
    </Button>
  );
}
