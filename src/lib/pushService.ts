import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface PushOptions {
  fazendaId?: string;
  userIds?: string[];
  all?: boolean;
}

/**
 * Envia uma Web Push notification.
 * - Por padrão, direciona para o gerente e o admin da fazenda (passe `fazendaId`).
 * - Pode aceitar `userIds` explicitamente ou `all: true` para envio global.
 * Falha silenciosa: nunca interrompe o fluxo principal.
 */
export async function sendPush(title: string, body: string, url: string, opts: PushOptions) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const authToken = session?.access_token ?? SUPABASE_ANON_KEY;

    const payload: Record<string, unknown> = { title, body, url };
    if (opts.fazendaId) payload.fazenda_id = opts.fazendaId;
    if (opts.userIds?.length) payload.user_ids = opts.userIds;
    if (opts.all) payload.all = true;

    await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn("[pushService] Falha ao enviar push:", err);
  }
}

/** @deprecated use sendPush({ fazendaId }) ou sendPush({ all: true }) */
export async function sendPushToAll(title: string, body: string, url: string = "/") {
  return sendPush(title, body, url, { all: true });
}
