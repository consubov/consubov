import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY_20260624") ?? Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY_20260624") ?? Deno.env.get("VAPID_PRIVATE_KEY")!;
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
  fazenda_id?: string;          // envia para gerentes + admins da fazenda
  include_admins?: boolean;     // padrão true quando fazenda_id é passado
  all?: boolean;
}

async function resolveTargetUserIds(payload: PushPayload): Promise<string[]> {
  const ids = new Set<string>();
  if (payload.user_id) ids.add(payload.user_id);
  (payload.user_ids ?? []).forEach((id) => id && ids.add(id));

  if (payload.fazenda_id) {
    const { data: gerentes } = await supabase
      .from("gerentes")
      .select("user_id")
      .eq("fazenda_id", payload.fazenda_id)
      .eq("ativo", true);
    (gerentes ?? []).forEach((g: { user_id: string | null }) => g.user_id && ids.add(g.user_id));

    if (payload.include_admins !== false) {
      const { data: fazenda } = await supabase
        .from("fazendas")
        .select("administrador_id")
        .eq("id", payload.fazenda_id)
        .maybeSingle();
      if (fazenda?.administrador_id) {
        const { data: admin } = await supabase
          .from("administradores")
          .select("user_id")
          .eq("id", fazenda.administrador_id)
          .eq("ativo", true)
          .maybeSingle();
        if (admin?.user_id) ids.add(admin.user_id);
      }
    }
  }

  return Array.from(ids);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verifica toggle global do admin
    const { data: cfg } = await supabase
      .from("configuracoes_gerais")
      .select("valor")
      .eq("chave", "notificacoes_globais_ativas")
      .maybeSingle();
    if (cfg && Number(cfg.valor) === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "notificacoes_globais_desativadas" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload: PushPayload = await req.json().catch(() => ({}));
    const title = payload.title ?? "Consubov";
    const body = payload.body ?? "";
    const url = payload.url ?? "/";

    let query = supabase.from("push_subscriptions").select("*").eq("enabled", true);

    if (payload.all) {
      // sem filtro
    } else {
      const targetIds = await resolveTargetUserIds(payload);
      if (targetIds.length === 0) {
        return new Response(
          JSON.stringify({ error: "Provide user_id, user_ids, fazenda_id, or all=true", resolved: 0 }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      query = query.in("user_id", targetIds);
    }

    const { data: subs, error } = await query;
    if (error) throw error;

    const results = await Promise.allSettled(
      (subs ?? []).map(async (s: any) => {
        const subscription = typeof s.subscription === "string"
          ? JSON.parse(s.subscription)
          : s.subscription;
        // tag único por envio garante que cada notificação apareça
        const tag = `consubov-${s.id}-${Date.now()}`;
        const notification = JSON.stringify({ title, body, url, tag });
        try {
          await webpush.sendNotification(subscription, notification, {
            TTL: 60 * 60 * 24, // 24h — FCM/Android exige TTL para entrega confiável
            urgency: "high",   // acorda dispositivos Android em Doze mode
            headers: { Urgency: "high" },
          });
          return { id: s.id, ok: true };
        } catch (err: any) {
          if (err?.statusCode === 403 || err?.statusCode === 404 || err?.statusCode === 410) {
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
