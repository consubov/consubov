// service_role_key é proibida aqui: segredo administrativo nunca deve ser persistido em
// tabela de aplicação (qualquer leitor de app_secrets herdaria privilégio de administrador
// do banco). Esta função permanece apenas para seeding não-sensível de compatibilidade
// (ex.: supabase_url usada pela função SQL legada send_push_async), com allowlist
// explícita, autenticação de admin e sem valor sensível em log ou resposta.
import { requireAdmin, getAdminClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const jsonResponse = (
  body: Record<string, unknown>,
  status: number,
  extraHeaders: Record<string, string> = {}
) => new Response(JSON.stringify(body), { status, headers: { ...jsonHeaders, ...extraHeaders } });

const ALLOWED_KEYS = ["supabase_url"] as const;
type AllowedKey = (typeof ALLOWED_KEYS)[number];

function resolveValue(key: AllowedKey): string | null {
  if (key === "supabase_url") return Deno.env.get("SUPABASE_URL") ?? null;
  return null;
}

type Resolution =
  | { ok: true; keys: AllowedKey[] }
  | { ok: false; status: number; error: string };

// Nega por padrão: só nomes dentro da allowlist são aceitos; valores vindos do corpo
// nunca são usados (o valor persistido sempre vem da configuração do servidor).
function resolveRequestedKeys(body: unknown): Resolution {
  if (body === null || body === undefined) {
    return { ok: true, keys: [...ALLOWED_KEYS] };
  }
  if (typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Corpo da requisição inválido" };
  }

  const record = body as Record<string, unknown>;
  const requested: string[] = [];

  if ("keys" in record) {
    const keys = record.keys;
    if (!Array.isArray(keys) || keys.some((entry) => typeof entry !== "string")) {
      return { ok: false, status: 400, error: "Campo 'keys' deve ser uma lista de nomes de chaves" };
    }
    requested.push(...(keys as string[]));
  }

  for (const name of Object.keys(record)) {
    if (name !== "keys") requested.push(name);
  }

  const denied = requested.filter((name) => !(ALLOWED_KEYS as readonly string[]).includes(name));
  if (denied.length > 0) {
    return { ok: false, status: 403, error: `Chave fora da allowlist: ${denied.join(", ")}` };
  }

  const unique = [...new Set(requested)];
  return { ok: true, keys: (unique.length > 0 ? unique : [...ALLOWED_KEYS]) as AllowedKey[] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido" }, 405, { Allow: "POST, OPTIONS" });
  }

  const authResult = await requireAdmin(req);
  if (authResult.error) {
    return authResult.error;
  }
  const admin = authResult.admin!;

  try {
    const body = await req.json().catch(() => null);
    const resolution = resolveRequestedKeys(body);

    if (!resolution.ok) {
      console.warn("[seed-app-secrets] Requisição negada:", {
        adminId: admin.id,
        status: resolution.status,
        erro: resolution.error,
      });
      return jsonResponse({ error: resolution.error }, resolution.status);
    }

    console.log("[seed-app-secrets] Autenticado:", { adminId: admin.id });
    console.log("[seed-app-secrets] Chaves a semear:", { keys: resolution.keys });

    let client: ReturnType<typeof getAdminClient>;
    try {
      client = getAdminClient();
    } catch {
      console.error("[seed-app-secrets] Cliente administrativo indisponível");
      return jsonResponse({ error: "Erro interno do servidor" }, 500);
    }

    const seeded: string[] = [];
    for (const key of resolution.keys) {
      const value = resolveValue(key);
      if (value === null) {
        console.error("[seed-app-secrets] Configuração ausente para a chave:", { key });
        return jsonResponse({ error: "Erro interno do servidor" }, 500);
      }

      const { error } = await client
        .from("app_secrets")
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });

      if (error) {
        console.error("[seed-app-secrets] Falha ao persistir a chave:", { key });
        return jsonResponse({ error: "Falha ao persistir segredos de aplicação" }, 500);
      }

      seeded.push(key);
    }

    console.log("[seed-app-secrets] Concluído:", { adminId: admin.id, keys: seeded });
    return jsonResponse({ ok: true, keys: seeded }, 200);
  } catch {
    console.error("[seed-app-secrets] Erro inesperado");
    return jsonResponse({ error: "Erro interno do servidor" }, 500);
  }
});
