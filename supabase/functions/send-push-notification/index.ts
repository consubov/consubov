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
  fazenda_id?: string;          // eventos internos: gerentes + capatazes da fazenda
  fabrica_id?: string;          // restringe aos vinculados a essa fábrica
  admins_only?: boolean;        // eventos de plataforma: somente administradores
  all?: boolean;
}

async function resolveTargetUserIds(payload: PushPayload): Promise<string[]> {
  const ids = new Set<string>();
  if (payload.user_id) ids.add(payload.user_id);
  (payload.user_ids ?? []).forEach((id) => id && ids.add(id));

  if (payload.admins_only) {
    const { data: admins } = await supabase
      .from("administradores")
      .select("user_id")
      .eq("ativo", true);
    (admins ?? []).forEach((a: { user_id: string | null }) => a.user_id && ids.add(a.user_id));
  }

  if (payload.fazenda_id) {
    // Retiros da fazenda (para resolver capatazes)
    const { data: retiros } = await supabase
      .from("retiros")
      .select("id")
      .eq("fazenda_id", payload.fazenda_id);
    let retiroIds = (retiros ?? []).map((r: { id: string }) => r.id);

    // Filtro extra por fábrica: só destinos vinculados àquela fábrica
    let fabricaFazendas: string[] | null = null;
    if (payload.fabrica_id) {
      const { data: destinos } = await supabase
        .from("fabrica_destinos")
        .select("fazenda_id, retiro_id")
        .eq("fabrica_id", payload.fabrica_id);
      const destRetiros = (destinos ?? [])
        .map((d: { retiro_id: string | null }) => d.retiro_id)
        .filter(Boolean) as string[];
      fabricaFazendas = (destinos ?? [])
        .map((d: { fazenda_id: string | null }) => d.fazenda_id)
        .filter(Boolean) as string[];
      if (destRetiros.length > 0) {
        retiroIds = retiroIds.filter((id) => destRetiros.includes(id));
      } else if (!fabricaFazendas.includes(payload.fazenda_id)) {
        retiroIds = [];
      }
    }

    // Gerentes da fazenda
    const { data: gerentes } = await supabase
      .from("gerentes")
      .select("user_id, retiro_id")
      .eq("fazenda_id", payload.fazenda_id)
      .eq("ativo", true);
    (gerentes ?? []).forEach((g: { user_id: string | null; retiro_id: string | null }) => {
      if (!g.user_id) return;
      if (payload.fabrica_id) {
        const vinculadoPorFazenda = (fabricaFazendas ?? []).includes(payload.fazenda_id!);
        const vinculadoPorRetiro = !!g.retiro_id && retiroIds.includes(g.retiro_id);
        if (!vinculadoPorFazenda && !vinculadoPorRetiro) return;
      }
      ids.add(g.user_id);
    });

    // Capatazes dos retiros da fazenda (vínculo principal + vínculos múltiplos)
    if (retiroIds.length > 0) {
      const { data: capatazes } = await supabase
        .from("capatazes")
        .select("user_id")
        .in("retiro_id", retiroIds)
        .eq("ativo", true);
      (capatazes ?? []).forEach((c: { user_id: string | null }) => c.user_id && ids.add(c.user_id));

      const { data: vinculos } = await supabase
        .from("capatazes_retiros")
        .select("capataz_id")
        .in("retiro_id", retiroIds);
      const capatazIds = [...new Set((vinculos ?? []).map((v: { capataz_id: string }) => v.capataz_id))];
      if (capatazIds.length > 0) {
        const { data: capatazesVinculados } = await supabase
          .from("capatazes")
          .select("user_id")
          .in("id", capatazIds)
          .eq("ativo", true);
        (capatazesVinculados ?? []).forEach((c: { user_id: string | null }) => c.user_id && ids.add(c.user_id));
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
