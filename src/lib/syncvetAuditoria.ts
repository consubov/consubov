import { supabase } from "@/integrations/supabase/client";

type AuditParams = {
  empresaId: string | null | undefined;
  userId: string | null | undefined;
  acao: string;
  entidade: string;
  entidade_id?: string | null;
  detalhes?: Record<string, unknown> | null;
};

const equipeCache = new Map<string, string>(); // key: empresaId+userId -> equipeId

async function resolveEquipeId(empresaId: string, userId: string): Promise<string | null> {
  const key = `${empresaId}::${userId}`;
  const cached = equipeCache.get(key);
  if (cached) return cached;
  const { data } = await supabase
    .from("syncvet_equipe")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();
  const id = (data as { id: string } | null)?.id ?? null;
  if (id) equipeCache.set(key, id);
  return id;
}

function tryGetGps(timeoutMs = 1500): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(null); } }, timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => { if (!done) { done = true; clearTimeout(t); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); } },
      () => { if (!done) { done = true; clearTimeout(t); resolve(null); } },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: timeoutMs }
    );
  });
}

/**
 * Registra uma entrada de auditoria no SyncVet. Nunca lança erro — falhas
 * são silenciadas para não travar o fluxo do usuário.
 */
export async function logAuditoria(params: AuditParams): Promise<void> {
  try {
    const { empresaId, userId, acao, entidade, entidade_id = null, detalhes = null } = params;
    if (!empresaId || !userId) return;
    const equipeId = await resolveEquipeId(empresaId, userId);
    const gps = await tryGetGps();
    const dispositivo = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 250) : null;
    await supabase.from("syncvet_auditoria").insert({
      empresa_id: empresaId,
      equipe_id: equipeId,
      acao,
      entidade,
      entidade_id,
      detalhes: detalhes as never,
      gps_lat: gps?.lat ?? null,
      gps_lng: gps?.lng ?? null,
      dispositivo,
    });
  } catch (err) {
    console.warn("[syncvet-auditoria] falha silenciosa:", err);
  }
}
