/**
 * Fila SEPARADA de fotos de auditoria da salga.
 * - Banco local próprio (consubov-fotos-salga); só LÊ o store `lancamentos` do capataz.
 * - Copia a foto assim que a salga aparece localmente (inclusive pendente).
 * - Envia ao Storage (bucket privado "fotos-salga") somente quando a salga já existe no servidor.
 * - Nunca bloqueia/atrasa/duplica salgas; falhas são re-tentadas depois.
 * - A cópia da fila só é apagada após confirmação no servidor.
 */
import { openDB, type IDBPDatabase } from "idb";
import { supabase } from "@/integrations/supabase/client";
import { getAllLancamentos } from "@/lib/offlineDb";

const DB_NAME = "consubov-fotos-salga";
const STORE = "fotos";
const BUCKET = "fotos-salga";
const TIPO = "auditoria";

interface FotoFila {
  lancamento_id: string;
  pasto_id: string;
  tirada_em: string;
  blob: Blob;
  tries: number;
  next_at: number;
}

let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  if (!dbp) {
    dbp = openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: "lancamento_id" });
        if (!d.objectStoreNames.contains("feitos")) d.createObjectStore("feitos");
      },
    });
  }
  return dbp;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("imagem inválida"));
    img.src = src;
  });
}

/** 1024 px no maior lado, JPEG qualidade 0,5 — sempre recomprime. */
async function comprimir(dataUrl: string): Promise<Blob> {
  const img = await loadImage(dataUrl);
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  const max = 1024;
  if (w > max || h > max) {
    if (w >= h) { h = Math.round((h * max) / w); w = max; }
    else { w = Math.round((w * max) / h); h = max; }
  }
  const c = document.createElement("canvas");
  c.width = Math.max(1, w); c.height = Math.max(1, h);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.5));
  c.width = 0; c.height = 0;
  if (!blob || blob.size <= 0) throw new Error("falha ao comprimir");
  return blob;
}

/** Copia para a fila as fotos de auditoria ainda não copiadas (só leitura do store lancamentos). */
async function copiarNovas() {
  const lancs = await getAllLancamentos();
  const d = await db();
  for (const l of lancs) {
    const foto = l?.foto_auditoria_url;
    if (!l?.id || !foto || !foto.startsWith("data:image/")) continue;
    if (await d.get(STORE, l.id)) continue;
    if (await d.get("feitos", l.id)) continue;
    try {
      const blob = await comprimir(foto);
      await d.put(STORE, {
        lancamento_id: l.id, pasto_id: l.pasto_id, tirada_em: l.data,
        blob, tries: 0, next_at: 0,
      } satisfies FotoFila);
    } catch (e) {
      console.warn("[fotoSalga] falha ao copiar foto", l.id, e);
    }
  }
}

function jaExiste(err: any): boolean {
  const s = `${err?.statusCode ?? ""} ${err?.error ?? ""} ${err?.message ?? ""}`.toLowerCase();
  return s.includes("409") || s.includes("already exists") || s.includes("duplicate");
}

async function enviarUma(f: FotoFila): Promise<"ok" | "espera"> {
  // Só envia com a salga já no servidor (mesmo id local/servidor).
  const { data: lanc, error: e1 } = await supabase
    .from("lancamentos").select("id, fazenda_id, pasto_id").eq("id", f.lancamento_id).maybeSingle();
  if (e1) throw e1;
  if (!lanc) return "espera";

  const caminho = `${(lanc as any).fazenda_id}/${f.lancamento_id}/${TIPO}.jpg`;
  const up = await supabase.storage.from(BUCKET).upload(caminho, f.blob, { upsert: false, contentType: "image/jpeg" });
  if (up.error && !jaExiste(up.error)) throw up.error;

  const { error: e2 } = await supabase.from("fotos_salga" as any).insert({
    lancamento_id: f.lancamento_id,
    pasto_id: (lanc as any).pasto_id ?? f.pasto_id,
    fazenda_id: (lanc as any).fazenda_id,
    tipo: TIPO,
    caminho,
    tamanho_bytes: f.blob.size,
    tirada_em: f.tirada_em,
  });
  if (e2 && (e2 as any).code !== "23505") throw e2;
  return "ok";
}

let rodando = false;
export async function processarFilaFotosSalga() {
  if (rodando) return;
  rodando = true;
  try {
    await copiarNovas();
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    const { data: sess } = await supabase.auth.getSession();
    if (!sess?.session) return;
    const d = await db();
    const itens = (await d.getAll(STORE)) as FotoFila[];
    const agora = Date.now();
    for (const f of itens) {
      if (f.next_at > agora) continue;
      try {
        const r = await enviarUma(f);
        if (r === "ok") {
          await d.put("feitos", Date.now(), f.lancamento_id);
          await d.delete(STORE, f.lancamento_id);
        } else {
          await d.put(STORE, { ...f, next_at: agora + 2 * 60_000 });
        }
      } catch (e) {
        const tries = f.tries + 1;
        const espera = Math.min(60 * 60_000, 60_000 * 2 ** Math.min(tries, 6));
        await d.put(STORE, { ...f, tries, next_at: agora + espera });
        console.warn("[fotoSalga] envio falhou, nova tentativa depois", f.lancamento_id, e);
      }
    }
  } catch (e) {
    console.warn("[fotoSalga] fila", e);
  } finally {
    rodando = false;
  }
}

/** Liga a fila em segundo plano; retorna função de desligar. */
export function iniciarFilaFotosSalga(): () => void {
  const run = () => { void processarFilaFotosSalga(); };
  const onVis = () => { if (!document.hidden) run(); };
  const t0 = setTimeout(run, 5000);
  const iv = setInterval(run, 2 * 60_000);
  window.addEventListener("online", run);
  document.addEventListener("visibilitychange", onVis);
  return () => {
    clearTimeout(t0); clearInterval(iv);
    window.removeEventListener("online", run);
    document.removeEventListener("visibilitychange", onVis);
  };
}
