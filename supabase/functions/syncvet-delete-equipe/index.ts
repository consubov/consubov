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

// Formato UUID v4 esperado para identificadores internos (evita injection
// e enumeração de esquema via equipe_id arbitrário).
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Operação destrutiva: somente POST (declarado no CORS acima).
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...jsonHeaders, Allow: "POST, OPTIONS" },
    });
  }

  try {
    // Autenticação: exige JWT válido do chamador (defesa em profundidade
    // além do verify_jwt do gateway). A identidade vem exclusivamente do
    // token — nada do corpo da requisição conta como prova de identidade.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autorizado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error("syncvet-delete-equipe: variáveis de ambiente ausentes");
      return json({ error: "Serviço indisponível" }, 500);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();
    if (!caller) {
      return json({ error: "Não autorizado" }, 401);
    }

    const body = await req.json().catch(() => null);
    const equipe_id = (body as any)?.equipe_id as string | undefined;
    if (!equipe_id || typeof equipe_id !== "string" || !UUID_RE.test(equipe_id)) {
      return json({ error: "equipe_id inválido" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: membro, error: fetchErr } = await admin
      .from("syncvet_equipe")
      .select("id, empresa_id, user_id, nome")
      .eq("id", equipe_id)
      .maybeSingle();
    if (fetchErr || !membro) return json({ error: "Membro não encontrado" }, 404);

    // Autorização server-side (PRD-SEC-04): o chamador precisa pertencer à
    // mesma empresa do alvo (isolamento de tenant — o frontend sempre opera
    // escopado por empresa_id, ver SyncVetEquipePage/useAuth) OU ser um
    // administrador global ativo (padrão usado por create-user/manage-admin/
    // reset-password). Sem isso, qualquer usuário autenticado poderia excluir
    // equipes de outro tenant (IDOR destrutivo + delete no Auth).
    // [PENDENTE] restrição por perfil interno da equipe (ex.: só
    // "administrador" da empresa): sem evidência de regra no repositório.
    const { data: callerMembership } = await admin
      .from("syncvet_equipe")
      .select("id, empresa_id")
      .eq("user_id", caller.id)
      .eq("ativo", true)
      .maybeSingle();
    const sameEmpresa =
      !!(callerMembership as any)?.empresa_id &&
      (callerMembership as any).empresa_id === (membro as any).empresa_id;

    let isGlobalAdmin = false;
    if (!sameEmpresa) {
      const { data: adminRow } = await admin
        .from("administradores")
        .select("id")
        .eq("user_id", caller.id)
        .eq("ativo", true)
        .maybeSingle();
      isGlobalAdmin = !!adminRow;
    }

    if (!sameEmpresa && !isGlobalAdmin) {
      return json({ error: "Acesso negado" }, 403);
    }

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
      if (delErr) {
        console.error("syncvet-delete-equipe: falha ao excluir membro");
        return json({ error: "Não foi possível concluir a exclusão" }, 500);
      }
      return json({ deleted: true }, 200);
    }

    // Deactivate + revoke auth
    if (membro.user_id) {
      await admin.auth.admin.deleteUser(membro.user_id).catch(() => {
        console.error("syncvet-delete-equipe: falha ao revogar acesso do membro");
      });
    }
    const { error: updErr } = await admin
      .from("syncvet_equipe")
      .update({ ativo: false, user_id: null })
      .eq("id", equipe_id);
    if (updErr) {
      console.error("syncvet-delete-equipe: falha ao desativar membro");
      return json({ error: "Não foi possível concluir a desativação" }, 500);
    }

    return json({ deactivated: true }, 200);
  } catch (_err) {
    console.error("syncvet-delete-equipe: erro interno");
    return json({ error: "Erro interno" }, 500);
  }
});
