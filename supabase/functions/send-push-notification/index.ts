import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { isAuthorizedModernPushMachine } from "./pushMachineAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY_V2") ?? Deno.env.get("VAPID_PUBLIC_KEY_20260624") ?? Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY_V2") ?? Deno.env.get("VAPID_PRIVATE_KEY_20260624") ?? Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT_V2") ?? Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@consubov.com.br";

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

// Identidade determinada no servidor: a credencial (service role no caso da
// máquina, JWT de usuário no caso humano) define o caller, nunca o payload.
type Caller =
  | { type: "machine" }
  | { type: "human"; userId: string };

type Selection =
  | { kind: "fazenda"; fazendaId: string }
  | { kind: "fabrica"; fabricaId: string }
  | { kind: "admins" }
  | { kind: "users"; userIds: string[] };

interface SyncvetScope {
  empresaId: string | null;
  fullAccess: boolean;
}

interface AuthzCache {
  admin?: boolean;
  fazendas?: string[];
  fabricas?: string[];
  syncvet?: SyncvetScope;
}

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

function auditLog(entry: Record<string, unknown>, level: "log" | "warn" = "log"): void {
  const line = "[push:audit] " + JSON.stringify(entry);
  if (level === "warn") console.warn(line);
  else console.log(line);
}

// ---------------------------------------------------------------------------
// Rate limit local (sem estado remoto): identidade sempre server-side, nunca
// dados do payload. Limiares configuráveis por env — valores default marcados
// [PENDENTE] de decisão de produto.
// ---------------------------------------------------------------------------
const RATE_WINDOW_MS = 60_000;
const DEFAULT_HUMAN_LIMIT = 30;   // [PENDENTE] valor de produto
const DEFAULT_MACHINE_LIMIT = 120; // [PENDENTE] valor de produto
const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function envPositiveInt(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  const parsed = raw === undefined || raw === null ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function allowRequest(key: string, limit: number): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart >= RATE_WINDOW_MS) {
    if (rateBuckets.size >= 10_000) {
      for (const [k, b] of rateBuckets) {
        if (now - b.windowStart >= RATE_WINDOW_MS) rateBuckets.delete(k);
      }
    }
    rateBuckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function authenticate(
  req: Request,
): Promise<{ caller: Caller } | { status: number; error: string; reason: string }> {
  // Opt-in only: the pg_net caller can use an API key without a Bearer JWT.
  // Do not promote requests carrying a user Authorization header to machine.
  if (!req.headers.has("authorization") && isAuthorizedModernPushMachine(
    req.headers.get("apikey"),
    (name) => Deno.env.get(name),
  )) {
    return { caller: { type: "machine" } };
  }

  const header = req.headers.get("authorization");
  if (!header) {
    return { status: 401, error: "Token de autorização ausente", reason: "auth_ausente" };
  }

  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer" || !parts[1]) {
    return { status: 401, error: "Token inválido ou expirado", reason: "auth_invalida" };
  }
  const token = parts[1];

  // Caller máquina legado (send_push_async envia a service role key como
  // Bearer). verify_jwt=false exige validação explícita da credencial ANTES
  // de qualquer consulta/envio. [PENDENTE] remover verify_jwt=false quando o
  // fluxo máquina for reprovado em produção.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && constantTimeEquals(token, serviceKey)) {
    return { caller: { type: "machine" } };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) {
    return { status: 401, error: "Token inválido ou expirado", reason: "auth_invalida" };
  }
  return { caller: { type: "human", userId: data.user.id } };
}

async function isGlobalAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("administradores")
    .select("id")
    .eq("user_id", userId)
    .eq("ativo", true);
  return (data ?? []).length > 0;
}

async function loadFazendaScope(userId: string): Promise<string[]> {
  const fazendas = new Set<string>();

  const { data: gerentes } = await supabase
    .from("gerentes")
    .select("id, fazenda_id")
    .eq("user_id", userId)
    .eq("ativo", true);
  const gerenteIds = (gerentes ?? []).map((g: { id?: string }) => g.id).filter(Boolean);
  (gerentes ?? []).forEach((g: { fazenda_id?: string | null }) => {
    if (g.fazenda_id) fazendas.add(g.fazenda_id);
  });
  if (gerenteIds.length > 0) {
    const { data: vinculos } = await supabase
      .from("gerentes_fazendas")
      .select("fazenda_id")
      .in("gerente_id", gerenteIds);
    (vinculos ?? []).forEach((v: { fazenda_id?: string | null }) => {
      if (v.fazenda_id) fazendas.add(v.fazenda_id);
    });
  }

  const { data: capatazes } = await supabase
    .from("capatazes")
    .select("id, retiro_id")
    .eq("user_id", userId)
    .eq("ativo", true);
  const capatazIds = (capatazes ?? []).map((c: { id?: string }) => c.id).filter(Boolean);
  const retiroIds = new Set<string>(
    (capatazes ?? []).map((c: { retiro_id?: string | null }) => c.retiro_id).filter(Boolean) as string[],
  );
  if (capatazIds.length > 0) {
    const { data: vinculos } = await supabase
      .from("capatazes_retiros")
      .select("retiro_id")
      .in("capataz_id", capatazIds);
    (vinculos ?? []).forEach((v: { retiro_id?: string | null }) => {
      if (v.retiro_id) retiroIds.add(v.retiro_id);
    });
  }
  if (retiroIds.size > 0) {
    const { data: retiros } = await supabase
      .from("retiros")
      .select("fazenda_id")
      .in("id", [...retiroIds]);
    (retiros ?? []).forEach((r: { fazenda_id?: string | null }) => {
      if (r.fazenda_id) fazendas.add(r.fazenda_id);
    });
  }

  return [...fazendas];
}

async function loadFabricaScope(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("operadores_fabrica")
    .select("fabrica_id")
    .eq("user_id", userId)
    .eq("ativo", true);
  return (data ?? []).map((r: { fabrica_id?: string | null }) => r.fabrica_id).filter(Boolean) as string[];
}

async function loadSyncvetScope(userId: string): Promise<SyncvetScope> {
  const { data } = await supabase
    .from("syncvet_equipe")
    .select("empresa_id, perfil")
    .eq("user_id", userId)
    .eq("ativo", true);
  const row = (data ?? [])[0];
  return {
    empresaId: row?.empresa_id ?? null,
    fullAccess: row?.perfil === "administrador",
  };
}

// Relações comprováveis entre caller humano e alvos de user_ids. Sem relação
// comprovável => negado ([PENDENTE] amarrar evento a id de transferência).
async function authorizeUserTargets(
  userId: string,
  targets: string[],
  cache: AuthzCache,
): Promise<boolean> {
  const allowed = new Set<string>();

  // R1 — mesmo tenant SyncVet e perfil de acesso total (administrador da empresa)
  const syncvet = cache.syncvet ?? (cache.syncvet = await loadSyncvetScope(userId));
  if (syncvet.empresaId && syncvet.fullAccess) {
    const { data } = await supabase
      .from("syncvet_equipe")
      .select("user_id")
      .eq("empresa_id", syncvet.empresaId)
      .eq("ativo", true)
      .in("user_id", targets);
    (data ?? []).forEach((r: { user_id?: string | null }) => {
      if (r.user_id) allowed.add(r.user_id);
    });
  }

  // R2/R3 — alvos ligados ao escopo de fazenda do caller
  const fazendas = cache.fazendas ?? (cache.fazendas = await loadFazendaScope(userId));
  if (fazendas.length > 0) {
    // R2 — operador de fábrica com destino (fabrica_destinos) numa fazenda do caller
    const { data: destinos } = await supabase
      .from("fabrica_destinos")
      .select("fabrica_id")
      .in("fazenda_id", fazendas);
    const fabricaIds = new Set(
      (destinos ?? []).map((d: { fabrica_id?: string | null }) => d.fabrica_id).filter(Boolean) as string[],
    );
    if (fabricaIds.size > 0) {
      const { data: ops } = await supabase
        .from("operadores_fabrica")
        .select("user_id, fabrica_id")
        .eq("ativo", true)
        .in("user_id", targets);
      (ops ?? []).forEach((o: { user_id?: string | null; fabrica_id?: string | null }) => {
        if (o.user_id && o.fabrica_id && fabricaIds.has(o.fabrica_id)) allowed.add(o.user_id);
      });
    }

    // R3 — administrador dono (fazendas.administrador_id) de fazenda do caller
    const { data: fazendaRows } = await supabase
      .from("fazendas")
      .select("administrador_id")
      .in("id", fazendas);
    const adminIds = [
      ...new Set(
        (fazendaRows ?? []).map((f: { administrador_id?: string | null }) => f.administrador_id).filter(Boolean) as string[],
      ),
    ];
    if (adminIds.length > 0) {
      const { data: admins } = await supabase
        .from("administradores")
        .select("user_id")
        .eq("ativo", true)
        .in("id", adminIds);
      (admins ?? []).forEach((a: { user_id?: string | null }) => {
        if (a.user_id) allowed.add(a.user_id);
      });
    }
  }

  return targets.every((t) => allowed.has(t));
}

async function authorizeSelections(
  caller: Caller,
  selections: Selection[],
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (caller.type === "machine") {
    // Contrato legado de send_push_async: fazenda/fábrica/admins. user_ids e all
    // nunca foram enviados pela máquina => negados (deny-by-default).
    if (selections.some((s) => s.kind === "users")) {
      return { ok: false, reason: "selecao_proibida" };
    }
    return { ok: true };
  }

  const cache: AuthzCache = {};
  const userId = caller.userId;

  for (const selection of selections) {
    if (selection.kind === "admins") {
      if (cache.admin === undefined) cache.admin = await isGlobalAdmin(userId);
      if (!cache.admin) return { ok: false, reason: "escopo_negado" };
      continue;
    }
    if (selection.kind === "fazenda") {
      if (cache.admin === undefined) cache.admin = await isGlobalAdmin(userId);
      if (cache.admin) continue;
      if (cache.fazendas === undefined) cache.fazendas = await loadFazendaScope(userId);
      if (!cache.fazendas.includes(selection.fazendaId)) return { ok: false, reason: "escopo_negado" };
      continue;
    }
    if (selection.kind === "fabrica") {
      if (cache.admin === undefined) cache.admin = await isGlobalAdmin(userId);
      if (cache.admin) continue;
      if (cache.fabricas === undefined) cache.fabricas = await loadFabricaScope(userId);
      if (!cache.fabricas.includes(selection.fabricaId)) return { ok: false, reason: "escopo_negado" };
      continue;
    }
    const ok = await authorizeUserTargets(userId, selection.userIds, cache);
    if (!ok) return { ok: false, reason: "escopo_negado" };
  }

  return { ok: true };
}

function normalizePayload(raw: unknown): PushPayload | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const payload: PushPayload = {};

  if (typeof input.title === "string") payload.title = input.title;
  if (typeof input.body === "string") payload.body = input.body;
  if (typeof input.url === "string") payload.url = input.url;

  if (input.fazenda_id !== undefined && input.fazenda_id !== null) {
    if (typeof input.fazenda_id !== "string" || !input.fazenda_id) return null;
    payload.fazenda_id = input.fazenda_id;
  }
  if (input.fabrica_id !== undefined && input.fabrica_id !== null) {
    if (typeof input.fabrica_id !== "string" || !input.fabrica_id) return null;
    payload.fabrica_id = input.fabrica_id;
  }
  if (input.user_id !== undefined && input.user_id !== null) {
    if (typeof input.user_id !== "string" || !input.user_id) return null;
    payload.user_id = input.user_id;
  }
  if (input.user_ids !== undefined && input.user_ids !== null) {
    if (!Array.isArray(input.user_ids)) return null;
    if (!input.user_ids.every((id) => typeof id === "string" && id.length > 0)) return null;
    payload.user_ids = input.user_ids as string[];
  }
  // Boolean() preserva o sentido de "presente e verdadeiro" do código original
  // e garante que strings tipo "false" não passem despercebidas.
  if (input.admins_only !== undefined && input.admins_only !== null) {
    payload.admins_only = Boolean(input.admins_only);
  }
  if (input.all !== undefined && input.all !== null) {
    payload.all = Boolean(input.all);
  }

  return payload;
}

function collectUserTargets(payload: PushPayload): string[] {
  const targets: string[] = [];
  if (payload.user_id) targets.push(payload.user_id);
  for (const id of payload.user_ids ?? []) {
    if (!targets.includes(id)) targets.push(id);
  }
  return targets;
}

function buildSelections(payload: PushPayload, targets: string[]): Selection[] {
  const selections: Selection[] = [];
  if (payload.fazenda_id) selections.push({ kind: "fazenda", fazendaId: payload.fazenda_id });
  if (payload.fabrica_id) selections.push({ kind: "fabrica", fabricaId: payload.fabrica_id });
  if (payload.admins_only) selections.push({ kind: "admins" });
  if (targets.length > 0) selections.push({ kind: "users", userIds: targets });
  return selections;
}

function selectionLabels(selections: Selection[]): string[] {
  return selections.map((s) => s.kind);
}

function selectionScope(selections: Selection[]): Record<string, string> {
  const scope: Record<string, string> = {};
  for (const s of selections) {
    if (s.kind === "fazenda") scope.fazendaId = s.fazendaId;
    if (s.kind === "fabrica") scope.fabricaId = s.fabricaId;
  }
  return scope;
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
  if (req.method !== "POST") {
    return json({ error: "Método não permitido" }, 405, { Allow: "POST, OPTIONS" });
  }

  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  let callerLabel = "unknown";
  let actor: string | null = null;

  try {
    // Identidade server-side ANTES de qualquer consulta ou envio.
    const auth = await authenticate(req);
    if ("status" in auth) {
      auditLog(
        { event: "push.request.denied", requestId, caller: "unknown", actor: null, selections: [], reason: auth.reason },
        "warn",
      );
      return json({ error: auth.error }, auth.status);
    }
    const caller = auth.caller;
    callerLabel = caller.type;
    actor = caller.type === "human" ? caller.userId : null;

    const limit = envPositiveInt(
      caller.type === "machine" ? "PUSH_RATE_LIMIT_MACHINE_PER_MIN" : "PUSH_RATE_LIMIT_HUMAN_PER_MIN",
      caller.type === "machine" ? DEFAULT_MACHINE_LIMIT : DEFAULT_HUMAN_LIMIT,
    );
    const rateKey = caller.type === "machine" ? "machine" : `user:${caller.userId}`;
    if (!allowRequest(rateKey, limit)) {
      auditLog(
        { event: "push.request.denied", requestId, caller: callerLabel, actor, selections: [], reason: "rate_limit" },
        "warn",
      );
      return json({ error: "Limite de requisições excedido" }, 429);
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      raw = null;
    }
    const payload = normalizePayload(raw);
    if (!payload) {
      auditLog(
        { event: "push.request.denied", requestId, caller: callerLabel, actor, selections: [], reason: "payload_invalido" },
        "warn",
      );
      return json({ error: "Requisição inválida" }, 400);
    }

    // Broadcast global não tem caller legítimo comprovado em nenhum fluxo.
    if (payload.all) {
      auditLog(
        { event: "push.request.denied", requestId, caller: callerLabel, actor, selections: [], reason: "broadcast_proibido" },
        "warn",
      );
      return json({ error: "Acesso negado" }, 403);
    }

    const targets = collectUserTargets(payload);
    const selections = buildSelections(payload, targets);
    if (selections.length === 0) {
      auditLog(
        { event: "push.request.denied", requestId, caller: callerLabel, actor, selections: [], reason: "sem_selecao" },
        "warn",
      );
      return json({ error: "Requisição inválida" }, 400);
    }

    const decision = await authorizeSelections(caller, selections);
    if (!decision.ok) {
      auditLog(
        {
          event: "push.request.denied",
          requestId,
          caller: callerLabel,
          actor,
          selections: selectionLabels(selections),
          scope: selectionScope(selections),
          reason: decision.reason,
        },
        "warn",
      );
      return json({ error: "Acesso negado" }, 403);
    }

    // Toggle global do admin
    const { data: cfg } = await supabase
      .from("configuracoes_gerais")
      .select("valor")
      .eq("chave", "notificacoes_globais_ativas")
      .maybeSingle();
    if (cfg && Number(cfg.valor) === 0) {
      auditLog({
        event: "push.request.skipped",
        requestId,
        caller: callerLabel,
        actor,
        selections: selectionLabels(selections),
        reason: "notificacoes_globais_desativadas",
      });
      return json({ skipped: true, reason: "notificacoes_globais_desativadas" });
    }

    const title = typeof payload.title === "string" ? payload.title : "Consubov";
    const body = typeof payload.body === "string" ? payload.body : "";
    const url = typeof payload.url === "string" ? payload.url : "/";

    const targetIds = await resolveTargetUserIds(payload);
    if (targetIds.length === 0) {
      auditLog(
        {
          event: "push.request.denied",
          requestId,
          caller: callerLabel,
          actor,
          selections: selectionLabels(selections),
          reason: "sem_destinos",
        },
        "warn",
      );
      return json({ error: "Requisição inválida" }, 400);
    }

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("enabled", true)
      .in("user_id", targetIds);
    if (error) throw error;

    const settled = await Promise.allSettled(
      (subs ?? []).map(async (s: { id: string; subscription: unknown }) => {
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
          return { ok: true } as { ok: boolean; status?: number };
        } catch (err: { statusCode?: number }) {
          if (err?.statusCode === 403 || err?.statusCode === 404 || err?.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", s.id);
          }
          // Mensagem do provedor nunca sai daqui (pode conter endpoint/chaves).
          return { ok: false, status: typeof err?.statusCode === "number" ? err.statusCode : undefined };
        }
      }),
    );

    const results = (subs ?? []).map((s: { id: string }, i: number) => {
      const outcome = settled[i];
      if (outcome.status === "fulfilled") {
        return outcome.value.status === undefined
          ? { id: s.id, ok: outcome.value.ok }
          : { id: s.id, ok: outcome.value.ok, status: outcome.value.status };
      }
      return { id: s.id, ok: false };
    });

    const sent = results.filter((r: { ok: boolean }) => r.ok).length;
    auditLog({
      event: "push.request.completed",
      requestId,
      caller: callerLabel,
      actor,
      selections: selectionLabels(selections),
      scope: selectionScope(selections),
      resolved: targetIds.length,
      subscriptions: results.length,
      sent,
      failed: results.length - sent,
    });

    return json({ total: subs?.length ?? 0, sent, results });
  } catch (err: { name?: string }) {
    // Só o nome do erro interno vai para o log/resposta — nunca err.message
    // (pode conter detalhe de schema, endpoint ou segredo).
    auditLog(
      { event: "push.request.error", requestId, caller: callerLabel, actor, name: err?.name ?? "Error" },
      "warn",
    );
    return json({ error: "Erro interno ao processar notificação" }, 500);
  }
});
