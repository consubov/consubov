import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@consubov.com.br";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  user_id?: string;
  user_ids?: string[];
  all?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: PushPayload = await req.json().catch(() => ({}));
    const title = payload.title ?? "Consubov";
    const body = payload.body ?? "";
    const url = payload.url ?? "/";

    let query = supabase.from("push_subscriptions").select("*");
    if (payload.user_id) query = query.eq("user_id", payload.user_id);
    else if (payload.user_ids?.length) query = query.in("user_id", payload.user_ids);
    else if (!payload.all) {
      return new Response(
        JSON.stringify({ error: "Provide user_id, user_ids, or all=true" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: subs, error } = await query;
    if (error) throw error;

    const notification = JSON.stringify({ title, body, url });
    const results = await Promise.allSettled(
      (subs ?? []).map(async (s: any) => {
        const subscription = {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        };
        try {
          await webpush.sendNotification(subscription, notification);
          return { id: s.id, ok: true };
        } catch (err: any) {
          // Remove gone subscriptions
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", s.id);
          }
          return { id: s.id, ok: false, status: err?.statusCode, message: err?.message };
        }
      }),
    );

    const sent = results.filter((r) => r.status === "fulfilled" && (r as any).value.ok).length;
    return new Response(
      JSON.stringify({ total: subs?.length ?? 0, sent, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message ?? "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
