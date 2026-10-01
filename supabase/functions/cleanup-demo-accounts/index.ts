import { requireAdmin, getAdminClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const json = (body: Record<string, unknown>, status: number, extra?: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, ...extra },
  });

// Mensagens de erro podem ecoar a URL do projeto ou a credencial; redige antes de logar.
const redact = (message: string) => {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return key ? message.split(key).join("[REDACTED]") : message;
};

// Campos que o client pode enviar por engano/fraude: nunca concedem privilégio algum.
const IDENTITY_KEYS = ["user_id", "role", "admin", "requested_by"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Operação destrutiva só via POST; demais métodos param antes da lógica.
  if (req.method !== "POST") {
    return json({ error: "Método não permitido" }, 405, { Allow: "POST, OPTIONS" });
  }

  // Identidade e autorização vêm exclusivamente do token; nada do body conta.
  const authResult = await requireAdmin(req);
  if (authResult.error) {
    // auditoria de acesso negado sem PII (somente o status)
    console.warn("[cleanup-demo-accounts] acesso negado", authResult.error.status);
    return authResult.error;
  }
  const callerAdmin = authResult.admin!;

  try {
    const parsed = await req.json().catch(() => ({}));
    const body: Record<string, unknown> =
      typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};

    // Identidade forjada no body é ignorada; registra só as chaves (sem valores/PII).
    const ignored = IDENTITY_KEYS.filter((key) => key in body);
    if (ignored.length) {
      console.log("[cleanup-demo-accounts] campos de identidade ignorados no body:", ignored.join(", "));
    }

    // force pula o corte de 24h, mas só é interpretado DEPOIS da autorização acima.
    const force = body.force === true;

    const admin = getAdminClient();

    const limite = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let query = admin.from("consultores").select("id, user_id, demo_criado_em").eq("is_demo", true);
    if (!force) query = query.lt("demo_criado_em", limite);

    const { data: demos, error } = await query;
    if (error) throw error;

    if (!demos || demos.length === 0) {
      console.log(`[cleanup-demo-accounts] admin=${callerAdmin.id} force=${force} removidos=0`);
      return json({ success: true, removidos: 0 }, 200);
    }

    let removidos = 0;

    for (const demo of demos) {
      const consultorId = demo.id as string;

      // fazendas + visitas do consultor demo
      const { data: fazendas } = await admin
        .from("fazendas_consultor")
        .select("id")
        .eq("consultor_id", consultorId);

      const { data: visitas } = await admin
        .from("visitas_tecnicas")
        .select("id, pdf_url")
        .eq("consultor_id", consultorId);

      const visitaIds = (visitas ?? []).map((v) => v.id as string);

      if (visitaIds.length > 0) {
        const { data: pastos } = await admin
          .from("visita_pastos").select("id").in("visita_id", visitaIds);
        const { data: currais } = await admin
          .from("visita_currais").select("id").in("visita_id", visitaIds);
        const { data: topicos } = await admin
          .from("visita_topicos").select("id").in("visita_id", visitaIds);
        const { data: indicadores } = await admin
          .from("indicadores_zootecnicos").select("id").in("visita_id", visitaIds);

        const pastoIds = (pastos ?? []).map((p) => p.id as string);
        const curralIds = (currais ?? []).map((c) => c.id as string);
        const topicoIds = (topicos ?? []).map((t) => t.id as string);
        const indicadorIds = (indicadores ?? []).map((i) => i.id as string);

        // fotos (storage + linhas)
        const fotoUrls: string[] = [];
        if (pastoIds.length) {
          const { data } = await admin.from("visita_fotos").select("url").in("visita_pasto_id", pastoIds);
          (data ?? []).forEach((f) => f.url && fotoUrls.push(f.url as string));
        }
        if (curralIds.length) {
          const { data } = await admin.from("visita_fotos").select("url").in("visita_curral_id", curralIds);
          (data ?? []).forEach((f) => f.url && fotoUrls.push(f.url as string));
        }
        if (topicoIds.length) {
          const { data } = await admin.from("visita_topico_fotos").select("url").in("visita_topico_id", topicoIds);
          (data ?? []).forEach((f) => f.url && fotoUrls.push(f.url as string));
        }

        if (fotoUrls.length) {
          const paths = fotoUrls
            .map((u) => u.split("/visitas-consultor-fotos/").pop() ?? null)
            .filter((p): p is string => !!p)
            .map((p) => p.split("?")[0]);
          if (paths.length) {
            await admin.storage.from("visitas-consultor-fotos").remove(paths);
          }
        }

        if (pastoIds.length) await admin.from("visita_fotos").delete().in("visita_pasto_id", pastoIds);
        if (curralIds.length) await admin.from("visita_fotos").delete().in("visita_curral_id", curralIds);
        if (topicoIds.length) await admin.from("visita_topico_fotos").delete().in("visita_topico_id", topicoIds);
        if (pastoIds.length) await admin.from("avaliacoes_score").delete().in("visita_pasto_id", pastoIds);
        if (curralIds.length) await admin.from("avaliacoes_score").delete().in("visita_curral_id", curralIds);
        if (indicadorIds.length) {
          await admin.from("indicadores_zootecnicos_faixa").delete().in("indicadores_zootecnicos_id", indicadorIds);
        }
        await admin.from("indicadores_zootecnicos").delete().in("visita_id", visitaIds);
        await admin.from("avaliacoes_fabrica_quesito").delete().in("visita_id", visitaIds);
        await admin.from("avaliacao_fabrica_visita").delete().in("visita_id", visitaIds);
        await admin.from("visita_assinantes").delete().in("visita_id", visitaIds);
        await admin.from("visita_topicos").delete().in("visita_id", visitaIds);
        await admin.from("visita_pastos").delete().in("visita_id", visitaIds);
        await admin.from("visita_currais").delete().in("visita_id", visitaIds);

        // PDFs gerados
        const pdfPaths = (visitas ?? [])
          .map((v) => (v.pdf_url as string | null) ?? "")
          .filter(Boolean)
          .map((u) => (u.split("/relatorios/").pop() ?? "").split("?")[0])
          .filter(Boolean);
        if (pdfPaths.length) await admin.storage.from("relatorios").remove(pdfPaths);

        await admin.from("visitas_tecnicas").delete().in("id", visitaIds);
      }

      // despesas
      await admin.from("despesas_combustivel").delete().eq("consultor_id", consultorId);
      await admin.from("relatorios_despesas").delete().eq("consultor_id", consultorId);

      if ((fazendas ?? []).length) {
        await admin.from("fazendas_consultor").delete().eq("consultor_id", consultorId);
      }

      await admin.from("consultores").delete().eq("id", consultorId);

      if (demo.user_id) {
        const { error: delErr } = await admin.auth.admin.deleteUser(demo.user_id as string);
        // não loga o objeto err: pode ecoar identificadores do usuário
        if (delErr) console.error("[cleanup-demo-accounts] falha ao excluir usuário auth do demo", consultorId);
      }

      removidos += 1;
    }

    console.log(`[cleanup-demo-accounts] admin=${callerAdmin.id} force=${force} removidos=${removidos}`);
    return json({ success: true, removidos }, 200);
  } catch (err) {
    // resposta genérica + detalhe redigido: String(err) pode vazar config ou dado sensível
    console.error(
      "[cleanup-demo-accounts] erro inesperado:",
      err instanceof Error ? redact(err.message) : "detalhe indisponível"
    );
    return json({ error: "Erro interno do servidor" }, 500);
  }
});
