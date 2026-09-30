import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface PushOptions {
  /** Evento interno da fazenda: gerentes + capatazes vinculados. */
  fazendaId?: string;
  /** Restringe o envio aos vinculados a esta fábrica. */
  fabricaId?: string;
  /** Evento de plataforma: somente administradores. */
  adminsOnly?: boolean;
  userIds?: string[];
}

/**
 * Envia uma Web Push notification.
 * Falha silenciosa: nunca interrompe o fluxo principal.
 */
export async function sendPush(title: string, body: string, url: string, opts: PushOptions) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const authToken = session?.access_token ?? SUPABASE_ANON_KEY;

    const payload: Record<string, unknown> = { title, body, url };
    if (opts.fazendaId) payload.fazenda_id = opts.fazendaId;
    if (opts.fabricaId) payload.fabrica_id = opts.fabricaId;
    if (opts.adminsOnly) payload.admins_only = true;
    if (opts.userIds?.length) payload.user_ids = opts.userIds;

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
