import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clean = (v: unknown) =>
  typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, 60) : "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const nome = clean((body as Record<string, unknown>).nome);
    const sobrenome = clean((body as Record<string, unknown>).sobrenome);

    if (nome.length < 2 || sobrenome.length < 2) {
      return json({ error: "Informe nome e sobrenome válidos" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Configuração do servidor incompleta" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const email = `demo.${rand}@relatto-demo.app`;
    const senha = `Demo!${crypto.randomUUID().slice(0, 18)}`;

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { is_demo: true },
    });

    if (authError || !authData.user?.id) {
      console.error("[relatto-demo-signup] auth error", authError?.message);
      return json({ error: "Falha ao criar conta de demonstração" }, 500);
    }

    const userId = authData.user.id;

    const { error: dbError } = await admin.from("consultores").insert({
      nome: `${nome} ${sobrenome}`,
      user_id: userId,
      ativo: true,
      is_demo: true,
      demo_criado_em: new Date().toISOString(),
      modulo_despesas_ativo: false,
    });

    if (dbError) {
      console.error("[relatto-demo-signup] db error", dbError.message);
      await admin.auth.admin.deleteUser(userId);
      return json({ error: "Falha ao criar consultor de demonstração" }, 500);
    }

    return json({ success: true, email, senha }, 201);
  } catch (err) {
    console.error("[relatto-demo-signup] erro", err);
    return json({ error: "Erro interno do servidor" }, 500);
  }
});
