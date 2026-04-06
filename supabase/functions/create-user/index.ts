import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[create-user] Função invocada");

  try {
    const body = await req.json();
    const { email, password, nome, telefone } = body;

    console.log("[create-user] Dados recebidos:", { email, nome, telefone, hasPassword: !!password });

    // 1. Validar entrada
    if (!email || !password) {
      console.error("[create-user] Campos obrigatórios faltando");
      return new Response(
        JSON.stringify({ error: "Email e senha são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter no mínimo 6 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Criar cliente com SERVICE_ROLE_KEY
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[create-user] Variáveis de ambiente não configuradas");
      return new Response(
        JSON.stringify({ error: "Configuração do servidor incompleta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 3. Criar usuário no Auth
    console.log("[create-user] Criando usuário no Auth...");
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error("[create-user] Erro ao criar usuário no Auth:", authError.message);
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authData.user?.id;
    if (!userId) {
      console.error("[create-user] ID do usuário não retornado");
      return new Response(
        JSON.stringify({ error: "Erro interno: ID do usuário não retornado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[create-user] Usuário criado no Auth:", userId);

    // 4. Inserir na tabela administradores (com rollback se falhar)
    try {
      console.log("[create-user] Inserindo na tabela administradores...");
      const { error: dbError } = await adminClient
        .from("administradores")
        .insert({
          nome: nome || email,
          email,
          telefone: telefone || null,
          user_id: userId,
          ativo: true,
        });

      if (dbError) throw dbError;

      console.log("[create-user] Administrador inserido com sucesso");

      return new Response(
        JSON.stringify({
          success: true,
          message: "Administrador criado com sucesso",
          user: { id: userId, email },
        }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (dbErr: any) {
      // 5. Rollback: deletar usuário do Auth
      console.error("[create-user] Erro no insert, fazendo rollback:", dbErr.message);
      await adminClient.auth.admin.deleteUser(userId);
      console.log("[create-user] Rollback concluído, usuário removido do Auth");

      return new Response(
        JSON.stringify({ error: "Falha ao salvar dados. Usuário removido. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err: any) {
    console.error("[create-user] Erro inesperado:", err.message);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor: " + err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
