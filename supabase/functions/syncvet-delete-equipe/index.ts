import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const json = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    const equipe_id = (body as any)?.equipe_id as string | undefined;
    if (!equipe_id) return json({ error: "equipe_id obrigatório" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: membro, error: fetchErr } = await admin
      .from("syncvet_equipe")
      .select("id, user_id, nome")
      .eq("id", equipe_id)
      .maybeSingle();
    if (fetchErr || !membro) return json({ error: "Membro não encontrado" }, 404);

    // Check FK references
    const [{ count: cManejos }, { count: cServicos }, { count: cServEquipe }] = await Promise.all([
      admin.from("syncvet_manejos").select("id", { count: "exact", head: true }).eq("responsavel_id", equipe_id),
      admin.from("syncvet_servicos").select("id", { count: "exact", head: true }).eq("veterinario_id", equipe_id),
      admin.from("syncvet_servico_equipe").select("servico_id", { count: "exact", head: true }).eq("equipe_id", equipe_id),
    ]);

    const hasHistory = (cManejos ?? 0) + (cServicos ?? 0) + (cServEquipe ?? 0) > 0;

    if (!hasHistory) {
      if (membro.user_id) {
        await admin.auth.admin.deleteUser(membro.user_id).catch(() => null);
      }
      const { error: delErr } = await admin.from("syncvet_equipe").delete().eq("id", equipe_id);
      if (delErr) return json({ error: delErr.message }, 500);
      return json({ deleted: true }, 200);
    }

    // Deactivate + revoke auth
    if (membro.user_id) {
      await admin.auth.admin.deleteUser(membro.user_id).catch((e) => {
        console.error("delete auth user falhou:", e);
      });
    }
    const { error: updErr } = await admin
      .from("syncvet_equipe")
      .update({ ativo: false, user_id: null })
      .eq("id", equipe_id);
    if (updErr) return json({ error: updErr.message }, 500);

    return json({ deactivated: true }, 200);
  } catch (err: any) {
    return json({ error: err?.message ?? "Erro interno" }, 500);
  }
});
