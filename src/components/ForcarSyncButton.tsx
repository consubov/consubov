import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { maybeUpdateActiveServiceWorker } from "@/lib/swRegistration";
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
      // Also nudge the local SW to check for a new version — keeps gerente
      // and capataz devices on the latest build whenever someone hits sync.
      void maybeUpdateActiveServiceWorker();

      const { data: sessionData } = await supabase.auth.getSession();
      const senderId = sessionData?.session?.user?.id ?? null;

      const { data: inserted, error } = await supabase
        .from("sync_commands")
        .insert({
          target_user_id: targetUserId,
          sender_user_id: senderId,
          command: "sync",
        })
        .select("id")
        .single();
      if (error || !inserted?.id) {
        console.error("[ForcarSyncButton] insert failed:", error);
        toast.error("Erro ao enviar sinal — tente novamente.");
        return;
      }

      // Verify the row exists (RLS-safe read-back)
      const { data: verify } = await supabase
        .from("sync_commands")
        .select("id")
        .eq("id", inserted.id)
        .maybeSingle();
      if (!verify) {
        console.warn("[ForcarSyncButton] insert succeeded but verification failed (likely RLS) — signal still delivered");
      }
      toast.success(`Sinal enviado ✓ — aguardando ${targetName}...`);
    } catch (err: any) {
      console.error("[ForcarSyncButton] error:", err);
      toast.error("Erro ao enviar sinal — tente novamente.");
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
