import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const jsonResponse = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isDuplicateAuthError = (message: string) =>
  /already been registered|already registered|email_exists/i.test(message);

async function findAuthUserByEmail(adminClient: ReturnType<typeof createClient>, email: string) {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });

    if (error) {
      return { user: null, error };
    }

    const user = data.users.find((entry) => normalizeEmail(entry.email ?? "") === email) ?? null;

    if (user) {
      return { user, error: null };
    }

    if (data.users.length < perPage) {
      return { user: null, error: null };
    }

    page += 1;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[create-user] Função invocada");

  try {
    const rawBody = await req.json().catch(() => null);

    if (!isRecord(rawBody)) {
      console.error("[create-user] Body inválido");
      return jsonResponse({ error: "Corpo da requisição inválido" }, 400);
    }

    const body = rawBody;

    console.log("[create-user] Body recebido:", {
      keys: Object.keys(body),
      nome: body.nome ?? null,
      email: body.email ?? null,
      telefone: body.telefone ?? null,
      role: body.role ?? null,
      hasSenha: typeof body.senha === "string" && body.senha.length > 0,
      hasPassword: typeof body.password === "string" && body.password.length > 0,
    });

    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
    const nome = typeof body.nome === "string" ? body.nome.trim() : "";
    const telefone = typeof body.telefone === "string" && body.telefone.trim() ? body.telefone.trim() : null;
    const senha = typeof body.senha === "string"
      ? body.senha
      : typeof body.password === "string"
        ? body.password
        : "";
    const requestedRole = body.role === "administrador" || body.role === "usuario"
      ? body.role
      : null;
    const shouldCreateAdminRecord = requestedRole === "administrador" || (requestedRole === null && !!nome);
    const role = shouldCreateAdminRecord ? "administrador" : "usuario";

    console.log("[create-user] Dados normalizados:", {
      email,
      nome,
      telefone,
      role,
      hasSenha: !!senha,
    });

    if (!email || !senha || (shouldCreateAdminRecord && !nome)) {
      console.error("[create-user] Campos obrigatórios faltando");
      return jsonResponse(
        { error: shouldCreateAdminRecord ? "Nome, email e senha são obrigatórios" : "Email e senha são obrigatórios" },
        400
      );
    }

    if (!isValidEmail(email)) {
      console.error("[create-user] E-mail inválido");
      return jsonResponse({ error: "Informe um e-mail válido" }, 400);
    }

    if (senha.length < 6) {
      console.error("[create-user] Senha inválida");
      return jsonResponse({ error: "A senha deve ter no mínimo 6 caracteres" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[create-user] Variáveis de ambiente não configuradas");
      return jsonResponse({ error: "Configuração do servidor incompleta" }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (shouldCreateAdminRecord) {
      const { data: existingAdmin, error: adminLookupError } = await adminClient
        .from("administradores")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (adminLookupError) {
        console.error("[create-user] Erro ao verificar administrador existente:", adminLookupError.message);
        return jsonResponse({ error: "Erro ao validar administrador existente" }, 500);
      }

      if (existingAdmin) {
        console.error("[create-user] Administrador já existe para o e-mail informado");
        return jsonResponse({ error: "Já existe um administrador com este e-mail" }, 400);
      }
    }

    console.log("[create-user] Criando usuário no Auth...");
    let userId: string | null = null;
    let createdAuthUser = false;

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });

    if (authError) {
      console.error("[create-user] Erro ao criar usuário no Auth:", authError.message);
      if (isDuplicateAuthError(authError.message)) {
        if (!shouldCreateAdminRecord) {
          return jsonResponse({ error: "Este e-mail já está cadastrado" }, 400);
        }

        console.log("[create-user] Usuário já existe no Auth, verificando reaproveitamento seguro...");

        const { user: existingAuthUser, error: findUserError } = await findAuthUserByEmail(adminClient, email);

        if (findUserError) {
          console.error("[create-user] Erro ao localizar usuário existente no Auth:", findUserError.message);
          return jsonResponse({ error: "Falha ao localizar usuário já existente" }, 500);
        }

        if (!existingAuthUser?.id) {
          console.error("[create-user] Usuário duplicado no Auth não foi encontrado para reaproveitamento");
          return jsonResponse({ error: "Este e-mail já está cadastrado no acesso do sistema" }, 400);
        }

        const [gerenteCheck, capatazCheck] = await Promise.all([
          adminClient.from("gerentes").select("id").eq("email", email).maybeSingle(),
          adminClient.from("capatazes").select("id").eq("email", email).maybeSingle(),
        ]);

        if (gerenteCheck.error || capatazCheck.error) {
          console.error("[create-user] Erro ao verificar conflitos de perfil:", gerenteCheck.error?.message ?? capatazCheck.error?.message);
          return jsonResponse({ error: "Falha ao validar vínculos existentes do usuário" }, 500);
        }

        if (gerenteCheck.data || capatazCheck.data) {
          console.error("[create-user] E-mail já vinculado a outro perfil do sistema");
          return jsonResponse({ error: "Este e-mail já está vinculado a outro perfil do sistema" }, 400);
        }

        userId = existingAuthUser.id;
        console.log("[create-user] Usuário existente no Auth reaproveitado:", userId);
      } else if (/password|senha/i.test(authError.message)) {
        return jsonResponse({ error: authError.message }, 400);
      } else {
        return jsonResponse({ error: `Falha ao criar usuário: ${authError.message}` }, 500);
      }
    } else {
      userId = authData.user?.id ?? null;
      createdAuthUser = true;
    }

    if (!userId) {
      console.error("[create-user] ID do usuário não retornado");
      return jsonResponse({ error: "Erro interno: ID do usuário não retornado" }, 500);
    }

    console.log("[create-user] Usuário criado no Auth:", userId);

    if (!shouldCreateAdminRecord) {
      return jsonResponse(
        {
          success: true,
          message: "Usuário criado com sucesso",
          user: { id: userId, email },
        },
        201
      );
    }

    try {
      console.log("[create-user] Inserindo na tabela administradores...");
      console.log("[create-user] Dados para insert:", { nome, email, telefone, userId });

      const { error: dbError } = await adminClient
        .from("administradores")
        .insert({
          nome,
          email,
          telefone,
          user_id: userId,
          ativo: true,
        });

      if (dbError) throw dbError;

      console.log("[create-user] Administrador inserido com sucesso");

      return jsonResponse(
        {
          success: true,
          message: "Administrador criado com sucesso",
          user: { id: userId, email },
          admin: { nome, email, telefone, user_id: userId },
        },
        201
      );
    } catch (dbErr: any) {
      console.error("[create-user] Erro no insert, fazendo rollback:", dbErr.message);
      if (createdAuthUser) {
        const { error: rollbackError } = await adminClient.auth.admin.deleteUser(userId);

        if (rollbackError) {
          console.error("[create-user] Falha no rollback do usuário Auth:", rollbackError.message);
          return jsonResponse({ error: "Falha ao salvar dados do administrador e o rollback não pôde ser concluído" }, 500);
        }

        console.log("[create-user] Rollback concluído, usuário removido do Auth");
      }

      return jsonResponse({ error: `Falha ao salvar dados do administrador: ${dbErr.message}` }, 500);
    }
  } catch (err: any) {
    console.error("[create-user] Erro inesperado:", err.message);
    return jsonResponse({ error: "Erro interno do servidor: " + err.message }, 500);
  }
});
