import { supabase } from "@/integrations/supabase/client";

/**
 * Aguarda qualquer renovação de login em andamento terminar antes de recarregar
 * o app. `getSession()` espera o bloqueio interno de renovação do Supabase,
 * então só resolve quando o token novo já foi salvo no aparelho.
 * Limite de segurança para nunca travar a atualização.
 */
export async function waitForAuthIdle(timeoutMs = 8000): Promise<void> {
  try {
    await Promise.race([
      supabase.auth.getSession(),
      new Promise((r) => setTimeout(r, timeoutMs)),
    ]);
  } catch {
    /* ignore */
  }
}

export function reloadWhenAuthIdle(action: () => void): void {
  void waitForAuthIdle().finally(action);
}
