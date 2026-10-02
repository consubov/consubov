import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin, getAdminClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const json = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

// Auditoria estruturada: nunca incluir senha, e-mail em claro, token ou secret.
const audit = (entry: Record<string, unknown>) =>
  console.log(JSON.stringify({ audit: true, ...entry }));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authResult = await requireAdmin(req);
  if (authResult.error) {
    return authResult.error;
  }
  const callerAdmin = authResult.admin!;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "Body inválido" }, 400);
    }

    const action = body.action as string;
    console.log("[manage-admin] action:", action, "caller:", callerAdmin.id);

    const admin = getAdminClient();

    // ─── UPDATE ───
    if (action === "update") {
      const { admin_id, nome, email, telefone, nova_senha } = body as {
        admin_id: string;
        nome: string;
        email: string;
        telefone: string | null;
        nova_senha?: string;
      };

      if (!admin_id || !nome?.trim() || !email?.trim()) {
        audit({ actor: callerAdmin.id, target: typeof admin_id === "string" ? admin_id : null, action: "update", result: "missing_fields" });
        return json({ error: "ID, nome e email são obrigatórios" }, 400);
      }

      const normalizedEmail = email.trim().toLowerCase();
      const changedFields: string[] = ["nome", "email", "telefone"];
      if (typeof nova_senha === "string" && nova_senha.length > 0) {
        changedFields.push("nova_senha");
      }

      // Get current admin record
      const { data: currentAdmin, error: fetchErr } = await admin
        .from("administradores")
        .select("id, email, user_id")
        .eq("id", admin_id)
        .single();

      if (fetchErr || !currentAdmin) {
        audit({ actor: callerAdmin.id, target: admin_id, action: "update", result: "not_found" });
        return json({ error: "Administrador não encontrado" }, 404);
      }

      // Check duplicate email (exclude self)
      if (normalizedEmail !== currentAdmin.email?.toLowerCase()) {
        const { data: dup } = await admin
          .from("administradores")
          .select("id")
          .eq("email", normalizedEmail)
          .neq("id", admin_id)
          .maybeSingle();

        if (dup) {
          audit({ actor: callerAdmin.id, target: admin_id, action: "update", result: "duplicate_email" });
          return json({ error: "Já existe um administrador com este e-mail" }, 400);
        }
      }

      // Update Auth email/password if user_id exists
      if (currentAdmin.user_id) {
        const authUpdate: Record<string, unknown> = {};

        if (normalizedEmail !== currentAdmin.email?.toLowerCase()) {
          authUpdate.email = normalizedEmail;
        }

        if (nova_senha && typeof nova_senha === "string") {
          if (nova_senha.length < 6) {
            audit({ actor: callerAdmin.id, target: admin_id, action: "update", result: "weak_password" });
            return json({ error: "A senha deve ter no mínimo 6 caracteres" }, 400);
          }
          authUpdate.password = nova_senha;
        }

        if (Object.keys(authUpdate).length > 0) {
          const { error: authErr } = await admin.auth.admin.updateUser(
            currentAdmin.user_id,
            authUpdate
          );
          if (authErr) {
            console.error("[manage-admin] Erro ao atualizar Auth");
            audit({ actor: callerAdmin.id, target: admin_id, action: "update", fields: changedFields, result: "error" });
            return json({ error: "Falha ao atualizar credenciais" }, 500);
          }
        }
      }

      // Update DB record
      const { error: dbErr } = await admin
        .from("administradores")
        .update({
          nome: nome.trim(),
          email: normalizedEmail,
          telefone: telefone?.trim() || null,
        })
        .eq("id", admin_id);

      if (dbErr) {
        console.error("[manage-admin] Erro ao atualizar DB");
        audit({ actor: callerAdmin.id, target: admin_id, action: "update", fields: changedFields, result: "error" });
        return json({ error: "Falha ao atualizar dados" }, 500);
      }

      console.log("[manage-admin] Admin atualizado:", admin_id, "por:", callerAdmin.id);
      audit({ actor: callerAdmin.id, target: admin_id, action: "update", fields: changedFields, result: "success" });
      return json({ success: true, message: "Administrador atualizado com sucesso" }, 200);
    }

    // ─── DELETE ───
    if (action === "delete") {
      const { admin_id } = body as {
        admin_id: string;
      };

      if (!admin_id) {
        audit({ actor: callerAdmin.id, target: null, action: "delete", result: "missing_fields" });
        return json({ error: "ID do administrador é obrigatório" }, 400);
      }

      // Get admin to delete
      const { data: targetAdmin, error: fetchErr } = await admin
        .from("administradores")
        .select("id, user_id")
        .eq("id", admin_id)
        .single();

      if (fetchErr || !targetAdmin) {
        audit({ actor: callerAdmin.id, target: admin_id, action: "delete", result: "not_found" });
        return json({ error: "Administrador não encontrado" }, 404);
      }

      // Prevent self-deletion using authenticated caller's user_id
      if (targetAdmin.user_id && targetAdmin.user_id === callerAdmin.user_id) {
        audit({ actor: callerAdmin.id, target: admin_id, action: "delete", result: "self_delete_blocked" });
        return json({ error: "Você não pode excluir a si mesmo" }, 400);
      }

      // Check if only 1 admin remains
      const { count } = await admin
        .from("administradores")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true);

      if ((count ?? 0) <= 1) {
        audit({ actor: callerAdmin.id, target: admin_id, action: "delete", result: "last_admin_blocked" });
        return json({ error: "Não é possível excluir o único administrador do sistema" }, 400);
      }

      // Delete from Auth first
      if (targetAdmin.user_id) {
        const { error: authErr } = await admin.auth.admin.deleteUser(targetAdmin.user_id);
        if (authErr) {
          console.error("[manage-admin] Erro ao deletar Auth");
          audit({ actor: callerAdmin.id, target: admin_id, action: "delete", result: "error" });
          return json({ error: "Falha ao remover acesso" }, 500);
        }
      }

      // Delete from DB
      const { error: dbErr } = await admin
        .from("administradores")
        .delete()
        .eq("id", admin_id);

      if (dbErr) {
        console.error("[manage-admin] Erro ao deletar DB");
        audit({ actor: callerAdmin.id, target: admin_id, action: "delete", result: "error" });
        return json({ error: "Falha ao excluir administrador" }, 500);
      }

      console.log("[manage-admin] Admin excluído:", admin_id, "por:", callerAdmin.id);
      audit({ actor: callerAdmin.id, target: admin_id, action: "delete", result: "success" });
      return json({ success: true, message: "Administrador excluído com sucesso" }, 200);
    }

    return json({ error: "Ação inválida. Use 'update' ou 'delete'" }, 400);
  } catch (err: any) {
    console.error("[manage-admin] Erro inesperado");
    return json({ error: "Erro interno do servidor" }, 500);
  }
});