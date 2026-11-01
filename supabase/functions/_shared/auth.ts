import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAdminApiKey } from "./adminApiKeys.ts";

export interface AuthenticatedAdmin {
  id: string;
  user_id: string;
  email: string;
  nome: string;
}

export interface AuthResult {
  admin: AuthenticatedAdmin | null;
  error: Response | null;
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return null;
  return parts[1];
}

async function verifyTokenAndGetUser(
  supabaseUrl: string,
  serviceRoleKey: string,
  token: string
): Promise<{ user_id: string; email: string } | null> {
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;

  return { user_id: data.user.id, email: data.user.email ?? "" };
}

async function findAdminByUserId(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string
): Promise<AuthenticatedAdmin | null> {
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client
    .from("administradores")
    .select("id, user_id, email, nome")
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    user_id: data.user_id,
    email: data.email,
    nome: data.nome,
  };
}

export async function requireAdmin(req: Request): Promise<AuthResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  let serviceRoleKey: string | null = null;
  try {
    serviceRoleKey = getAdminApiKey((name) => Deno.env.get(name));
  } catch {
    // Invalid modern configuration fails closed instead of using the legacy key.
    serviceRoleKey = null;
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      admin: null,
      error: new Response(
        JSON.stringify({ error: "Configuração do servidor incompleta" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  const token = extractBearerToken(req);
  if (!token) {
    return {
      admin: null,
      error: new Response(JSON.stringify({ error: "Token de autorização ausente" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  const user = await verifyTokenAndGetUser(supabaseUrl, serviceRoleKey, token);
  if (!user) {
    return {
      admin: null,
      error: new Response(JSON.stringify({ error: "Token inválido ou expirado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  const admin = await findAdminByUserId(supabaseUrl, serviceRoleKey, user.user_id);
  if (!admin) {
    return {
      admin: null,
      error: new Response(JSON.stringify({ error: "Acesso negado: permissão de administrador necessária" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  return { admin, error: null };
}

export function getAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = getAdminApiKey((name) => Deno.env.get(name));

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Configuração do servidor incompleta");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}