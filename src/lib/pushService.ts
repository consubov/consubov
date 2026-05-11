import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/**
 * Envia uma Web Push notification para todas as subscriptions registradas.
 * Falha silenciosa: nunca interrompe o fluxo principal da aplicação.
 */
export async function sendPushToAll(title: string, body: string, url: string = "/") {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const authToken = session?.access_token ?? SUPABASE_ANON_KEY;

    await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ all: true, title, body, url }),
    });
  } catch (err) {
    console.warn("[pushService] Falha ao enviar push:", err);
  }
}
