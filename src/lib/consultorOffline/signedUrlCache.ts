import { supabase } from "@/integrations/supabase/client";

// Cache module-level para signed URLs do bucket de fotos do Consultor.
// Evita re-fetch a cada render/mount na tela de revisão.
// URL válida por 6h no servidor; expiramos localmente após 5h para segurança.

const BUCKET = "visitas-consultor-fotos";
const TTL_MS = 5 * 60 * 60 * 1000;

interface Entry { url: string; expires: number; }
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<string>>();

export async function getCachedSignedUrl(path: string): Promise<string> {
  if (!path) return "";
  const now = Date.now();
  const hit = cache.get(path);
  if (hit && hit.expires > now) return hit.url;
  const pending = inflight.get(path);
  if (pending) return pending;
  const p = (async () => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 6);
    const url = data?.signedUrl || "";
    if (url) cache.set(path, { url, expires: Date.now() + TTL_MS });
    return url;
  })();
  inflight.set(path, p);
  try { return await p; } finally { inflight.delete(path); }
}

export function invalidateSignedUrl(path: string) { cache.delete(path); }
export function clearSignedUrlCache() { cache.clear(); }
