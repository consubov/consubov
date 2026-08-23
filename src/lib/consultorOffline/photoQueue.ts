import { supabase } from "@/integrations/supabase/client";
import {
  countPendingFotos,
  deleteFoto,
  deleteFotosByVisita,
  deleteFotosByParent,
  listAllFotosRaw,
  deleteMutationsByVisita,
  getFoto,
  listFailedFotos,
  listAllFotos,
  listAllSnapshots,
  listFotosByParent,
  listFotosByParentRaw,
  putFoto,
  purgeDeadFotos,
  retryFoto,
  type FotoQueueItem,
} from "./db";
import { drainMutations, dropMutationsForRows } from "./mutationQueue";
import { CONSULTOR_NETWORK_TIMEOUT_MS, CONSULTOR_PHOTO_CONFIRM_TIMEOUT_MS, CONSULTOR_PHOTO_UPLOAD_TIMEOUT_MS, getErrorMessage, sleep, withConsultorTimeout } from "./network";
import { patchSnapshot } from "./snapshotStore";
import { assertValidPhotoBlob, clonePhotoBlob, getBlobDiagnostic } from "./photoBlob";


const BUCKET = "visitas-consultor-fotos";

export interface PhotoFailureDetail {
  localId: string;
  visitaId: string;
  parentKind: "pasto" | "curral" | "topico";
  parentId: string;
  ordem: number;
  label: string;
  mime: string;
  size: number;
  sizeLabel: string;
  fileName?: string;
  tries: number;
  lastError: string;
}

type Listener = (pending: number, syncing: boolean, failures: PhotoFailureDetail[]) => void;
const listeners = new Set<Listener>();
let syncing = false;
let cachedPending = 0;
let cachedFailures: PhotoFailureDetail[] = [];
const MAX_AUTO_RETRIES = 3;
/** Envia poucas fotos por vez: dezenas de blobs simultâneos travam o Safari/iOS. */
const PHOTO_UPLOAD_CONCURRENCY = 2;

function formatBytes(size = 0): string {
  if (size <= 0) return "tamanho desconhecido";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function describeQueuedPhoto(item: FotoQueueItem): PhotoFailureDetail {
  const tipo = item.parentKind === "curral" ? "curral" : item.parentKind === "topico" ? "tópico" : "pasto";
  const size = item.size ?? item.blob?.size ?? 0;
  return {
    localId: item.localId,
    visitaId: item.visitaId,
    parentKind: item.parentKind,
    parentId: item.parentId,
    ordem: item.ordem,
    label: `Foto ${item.ordem} do ${tipo}`,
    mime: item.mime || "image/jpeg",
    size,
    sizeLabel: formatBytes(size),
    fileName: item.fileName,
    tries: item.tries ?? 0,
    lastError: item.lastError || "falha desconhecida",
  };
}

function debugSync(message: string, payload?: Record<string, unknown>) {
  if (import.meta.env.DEV) console.debug(`[consultor-sync] ${message}`, payload ?? {});
}

async function refreshPendingCount() {
  await purgeDeadFotos();
  cachedPending = await countPendingFotos();
  cachedFailures = (await listFailedFotos()).map(describeQueuedPhoto);
  emit();
}

function emit() {
  listeners.forEach((l) => l(cachedPending, syncing, cachedFailures));
}

export function subscribeSyncStatus(listener: Listener) {
  listeners.add(listener);
  // fire immediately with current state
  listener(cachedPending, syncing, cachedFailures);
  void refreshPendingCount();
  return () => listeners.delete(listener);
}

export async function getPhotoFailures() {
  return (await listFailedFotos()).map(describeQueuedPhoto);
}

export async function retryQueuedPhoto(localId: string) {
  await retryFoto(localId);
  await refreshPendingCount();
  if (typeof navigator === "undefined" || navigator.onLine) void drain();
}

export async function enqueuePhoto(params: {
  visitaId: string;
  parentKind: "pasto" | "curral" | "topico";
  parentId: string;
  ordem: number;
  blob: Blob;
  fileName?: string;
}): Promise<FotoQueueItem> {
  // De-duplica o mesmo slot (mesmo parent + mesma ordem): remove qualquer entrada
  // pendente anterior antes de gravar a nova. Isso evita acúmulo de duplicatas
  // quando o usuário substitui uma foto ou tenta reenviar.
  try {
    const existing = await listFotosByParentRaw(params.parentKind, params.parentId);
    await Promise.all(existing
      .filter((it) => it.ordem === params.ordem)
      .map((it) => deleteFoto(it.localId)));
  } catch (err) {
    console.warn("[consultor-photo-queue] falha ao limpar duplicatas do slot", err);
  }
  const localId = `foto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const item: FotoQueueItem = {
    localId,
    visitaId: params.visitaId,
    parentKind: params.parentKind,
    parentId: params.parentId,
    ordem: params.ordem,
    blob: params.blob,
    mime: params.blob.type || "image/jpeg",
    fileName: params.fileName,
    size: params.blob.size,
    createdAt: new Date().toISOString(),
    tries: 0,
    status: "pending",
  };
  try {
    await putFoto(item);
  } catch (err) {
    console.error("[consultor-photo-queue] foto não foi adicionada à fila local", {
      localId,
      visitaId: params.visitaId,
      parentKind: params.parentKind,
      parentId: params.parentId,
      ordem: params.ordem,
      fileName: params.fileName,
      blob: getBlobDiagnostic(params.blob),
      error: getErrorMessage(err),
    }, err);
    throw new Error(`Não foi possível salvar a foto ${params.ordem} no aparelho. Tente tirar ou selecionar a foto novamente.`);
  }
  await refreshPendingCount();
  if (typeof window !== "undefined" && (typeof navigator === "undefined" || navigator.onLine)) {
    window.setTimeout(() => void drain(), 250);
  }
  return item;
}


export async function getQueuedPhotosForParent(kind: "pasto" | "curral" | "topico", id: string) {
  return listFotosByParent(kind, id);
}

/** Quantas fotos desta visita ainda estão apenas no aparelho (não sincronizadas). */
export async function getQueuedPhotoCountForVisita(visitaId: string): Promise<number> {
  const items = await listAllFotos();
  return items.filter((it) => it.visitaId === visitaId).length;
}


type UploadOutcome = "ok" | "failed" | "deferred";

const PARENT_TABLE: Record<"pasto" | "curral" | "topico", string> = {
  pasto: "visita_pastos",
  curral: "visita_currais",
  topico: "visita_topicos",
};

/** Cache de pais já confirmados no servidor durante o drain atual. */
let confirmedParents = new Set<string>();

function isDependencyError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("foreign key") || m.includes("fkey") || m.includes("23503");
}

/**
 * A foto só pode ser enviada depois que o registro pai (pasto/curral/tópico)
 * existe no banco remoto. Sem essa checagem, o upload dispara erro de FK e a
 * foto era marcada como falha definitiva.
 */
async function isParentReady(kind: "pasto" | "curral" | "topico", parentId: string): Promise<boolean> {
  const key = `${kind}:${parentId}`;
  if (confirmedParents.has(key)) return true;
  try {
    const res: any = await withConsultorTimeout(
      (supabase as any).from(PARENT_TABLE[kind]).select("id").eq("id", parentId).maybeSingle(),
      `verificação do ${kind} da foto`,
      CONSULTOR_NETWORK_TIMEOUT_MS,
    );
    if (res.error) return false;
    if (res.data?.id) {
      confirmedParents.add(key);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function markDeferred(localId: string, reason: string) {
  const current = await getFoto(localId);
  if (current) {
    current.status = "pending";
    current.lastError = reason;
    // NÃO incrementa tries: dependência não satisfeita não é falha do envio.
    await putFoto(current).catch(() => null);
  }
  await refreshPendingCount();
}

async function uploadOne(inputItem: FotoQueueItem): Promise<UploadOutcome> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "failed";


  // ETAPA 1: reler SEMPRE a foto fresca do IndexedDB. Nunca reusar Blob de
  // sessão anterior — no Safari/iOS, referências antigas geram "Load failed"
  // ao serem passadas ao fetch/upload.
  let item: FotoQueueItem;
  let uploadBlob: Blob;
  try {
    const fresh = await getFoto(inputItem.localId);
    if (!fresh) {
      // Já foi removida (talvez confirmada por outra corrida). Nada a fazer.
      return "ok";
    }
    item = fresh;
    assertValidPhotoBlob(item.blob, `foto ${item.ordem}`);
    // Reconstrói um Blob novinho a partir do ArrayBuffer. Isso força uma
    // referência 100% em memória para o upload — evita blob "detached" no
    // WebKit quando a página foi recarregada.
    const { blob } = await clonePhotoBlob(item.blob, item.mime || "image/jpeg");
    uploadBlob = blob;
  } catch (readErr) {
    const message = `Falha ao ler foto do armazenamento local: ${getErrorMessage(readErr)}`;
    debugSync("erro ao ler foto do IndexedDB", { localId: inputItem.localId, error: message });
    const current = await getFoto(inputItem.localId);
    if (current) {
      current.status = "error";
      current.tries = (current.tries ?? 0) + 1;
      current.lastError = message;
      await putFoto(current).catch(() => null);
    }
    await refreshPendingCount();
    return "failed";
  }

  // ETAPA 1.5: só envia se o registro pai já existe no servidor (evita FK).
  if (!(await isParentReady(item.parentKind, item.parentId))) {
    debugSync("foto adiada — registro pai ainda não sincronizado", {
      localId: item.localId,
      parentKind: item.parentKind,
      parentId: item.parentId,
    });
    await markDeferred(item.localId, "aguardando sincronização do registro principal");
    return "deferred";
  }

  // ETAPA 2: marcar como "uploading" e enviar ao Supabase.
  try {
    item.status = "uploading";
    item.lastAttemptAt = new Date().toISOString();
    await putFoto(item);
    await refreshPendingCount();
    debugSync("enviando foto", {
      localId: item.localId,
      visitaId: item.visitaId,
      parentKind: item.parentKind,
      parentId: item.parentId,
      ordem: item.ordem,
      mime: uploadBlob.type,
      size: uploadBlob.size,
      fileName: item.fileName,
    });

    const folder = item.parentKind === "curral" ? "currais" : item.parentKind === "topico" ? "topicos" : "pastos";
    const path = `${folder}/${item.parentId}/${item.ordem}-${item.localId}.jpg`;
    const { error: upErr } = await withConsultorTimeout(supabase.storage
      .from(BUCKET)
      .upload(path, uploadBlob, { upsert: true, contentType: uploadBlob.type || item.mime }),
      `upload da foto ${item.ordem}`,
      CONSULTOR_PHOTO_UPLOAD_TIMEOUT_MS,
    );
    if (upErr) throw new Error(`Falha ao enviar foto ao servidor: ${getErrorMessage(upErr)}`);

    const insertPayload: any = { url: path, ordem: item.ordem };
    if (item.parentKind === "curral") insertPayload.visita_curral_id = item.parentId;
    else if (item.parentKind === "topico") insertPayload.visita_topico_id = item.parentId;
    else insertPayload.visita_pasto_id = item.parentId;

    const table = item.parentKind === "topico" ? "visita_topico_fotos" : "visita_fotos";
    const existingRes: any = await withConsultorTimeout((supabase as any)
      .from(table)
      .select("*")
      .eq("url", path)
      .maybeSingle(),
      `confirmação da foto ${item.ordem}`,
      CONSULTOR_PHOTO_CONFIRM_TIMEOUT_MS,
    );
    let inserted = existingRes.data;
    let insErr = existingRes.error;
    if (!inserted && !insErr) {
      const insertRes: any = await withConsultorTimeout((supabase as any)
        .from(table)
        .insert(insertPayload)
        .select("*")
        .single(),
        `registro da foto ${item.ordem}`,
        CONSULTOR_PHOTO_CONFIRM_TIMEOUT_MS,
      );
      inserted = insertRes.data;
      insErr = insertRes.error;
    }
    if (insErr) throw new Error(`Falha ao registrar foto no banco: ${getErrorMessage(insErr)}`);

    debugSync("foto confirmada pelo servidor", {
      localId: item.localId,
      visitaId: item.visitaId,
      table,
      rowId: inserted?.id,
      path,
    });
    await deleteFoto(item.localId);
    await patchSnapshot(item.visitaId, (curr) => {
      const queuedUrl = `queued:${item.localId}`;
      const replaceFoto = (parent: any) => {
        const signed = { ...(parent.signed || {}) };
        delete signed[item.localId];
        const fotos = ((parent.fotos || []) as any[])
          .filter((f) => f.id !== item.localId && f.url !== queuedUrl);
        if (inserted) fotos.push(inserted);
        fotos.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
        return { ...parent, fotos, signed };
      };

      if (item.parentKind === "curral") {
        return {
          ...curr,
          currais: (curr.currais || []).map((c: any) => c.id === item.parentId ? replaceFoto(c) : c),
        };
      }
      if (item.parentKind === "topico") {
        return {
          ...curr,
          topicos: (curr.topicos || []).map((t: any) => t.id === item.parentId ? replaceFoto(t) : t),
        };
      }
      return {
        ...curr,
        pastos: (curr.pastos || []).map((p: any) => p.id === item.parentId ? replaceFoto(p) : p),
      };
    }).catch(() => null);
    await refreshPendingCount();
    return "ok";
  } catch (err) {
    const message = getErrorMessage(err);
    debugSync("foto mantida no IndexedDB após falha de upload", {
      localId: item.localId,
      visitaId: item.visitaId,
      error: message,
    });
    // Falha por dependência (pasto/curral/tópico pai ainda ausente) não é
    // falha definitiva: reagenda sem consumir tentativas.
    if (isDependencyError(message)) {
      confirmedParents.delete(`${item.parentKind}:${item.parentId}`);
      await markDeferred(item.localId, "aguardando sincronização do registro principal");
      return "deferred";
    }
    const current = await getFoto(item.localId);
    if (current) {
      current.status = "error";
      current.tries = (current.tries ?? 0) + 1;
      current.lastError = message;
      await putFoto(current);
    }
    await refreshPendingCount();
    return "failed";
  }
}


let drainPromise: Promise<void> | null = null;

export async function drain(): Promise<void> {
  if (drainPromise) return drainPromise;
  drainPromise = (async () => {
    syncing = true;
    emit();
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      // Primeiro sincroniza textos/linhas novas para evitar erro de FK nas fotos.
      try {
        await withConsultorTimeout(drainMutations(), "sincronização dos dados antes das fotos", CONSULTOR_NETWORK_TIMEOUT_MS * 2);
      } catch (err) {
        debugSync("sincronização de dados antes das fotos falhou", { error: getErrorMessage(err) });
        return;
      }
      // Processa em pequenos lotes (2 por vez) para não estourar a memória do
      // Safari/iOS com dezenas de blobs simultâneos, e para não saturar a rede.
      confirmedParents = new Set();
      // Nova rodada = nova chance: fotos que estouraram as tentativas voltam a
      // "pending" para nunca morrerem permanentemente na fila local.
      for (const it of await listAllFotos()) {
        if ((it.tries ?? 0) >= MAX_AUTO_RETRIES || it.status === "uploading") {
          it.tries = 0;
          it.status = "pending";
          await putFoto(it).catch(() => null);
        }
      }
      let rounds = 0;
      while (rounds < MAX_AUTO_RETRIES) {
        const items = (await listAllFotos()).filter((i) => (i.tries ?? 0) < MAX_AUTO_RETRIES);
        if (!items.length) break;


        const results: UploadOutcome[] = [];
        for (let i = 0; i < items.length; i += PHOTO_UPLOAD_CONCURRENCY) {
          if (typeof navigator !== "undefined" && !navigator.onLine) break;
          const batch = items.slice(i, i + PHOTO_UPLOAD_CONCURRENCY);
          results.push(...(await Promise.all(batch.map(uploadOne))));
        }
        if (typeof navigator !== "undefined" && !navigator.onLine) break;
        if (results.every((r) => r === "ok")) continue;

        // Se restaram fotos aguardando o registro pai, tenta sincronizar as
        // mutações novamente para criar os pais e então reenfileirar as fotos.
        if (results.some((r) => r === "deferred")) {
          confirmedParents = new Set();
          try {
            await withConsultorTimeout(drainMutations(), "sincronização dos registros principais", CONSULTOR_NETWORK_TIMEOUT_MS * 2);
          } catch { /* tenta de novo na próxima rodada */ }
        }
        rounds++;
        if (rounds < MAX_AUTO_RETRIES) await sleep(650 * rounds);
      }
    } finally {
      syncing = false;
      await refreshPendingCount();
    }
  })();
  try {
    await drainPromise;
  } finally {
    drainPromise = null;
  }
}

export async function syncNow() {
  // reset error status so failed items get retried
  const items = await listAllFotos();
  for (const it of items) {
    if (it.status === "error" || it.status === "uploading") {
      it.status = "pending";
      it.tries = 0;
      it.lastError = undefined;
      await putFoto(it);
    }
  }
  await withConsultorTimeout(
    drain(),
    "sincronização das fotos",
    CONSULTOR_PHOTO_UPLOAD_TIMEOUT_MS * MAX_AUTO_RETRIES + 15_000,
  );
}

/**
 * Remove em cascata todas as fotos/mutações locais associadas a uma visita.
 * Deve ser chamada quando o usuário exclui uma visita (soft delete).
 */
export async function purgeVisitaFromQueue(visitaId: string): Promise<{ fotos: number; mutations: number }> {
  const [fotos, mutations] = await Promise.all([
    deleteFotosByVisita(visitaId),
    deleteMutationsByVisita(visitaId),
  ]);
  await refreshPendingCount();
  return { fotos, mutations };
}

/**
 * Remove em cascata fotos e mutações locais de um tópico excluído.
 * O DELETE do tópico no servidor cascateia `visita_topico_fotos`, então aqui
 * limpamos apenas o estado local (fila de fotos + mutações de criação/edição
 * que nunca poderiam sincronizar). A mutação de exclusão do tópico é preservada.
 */
export async function purgeTopicoFromQueue(topicoId: string, fotoRowIds: string[] = []): Promise<number> {
  const fotos = await deleteFotosByParent("topico", topicoId);
  await dropMutationsForRows([topicoId, ...fotoRowIds]);
  await refreshPendingCount();
  debugSync("fila higienizada após exclusão de tópico", { topicoId, fotos });
  return fotos;
}

/**
 * Higieniza a fila removendo itens órfãos: fotos cuja visita já foi
 * marcada como excluída (deleted_at) no snapshot local, e fotos/mutações
 * de tópicos marcados como excluídos (deleted_at) no snapshot da visita.
 * Executada uma vez na inicialização para limpar estado acumulado.
 */
export async function purgeOrphanQueueItems(): Promise<number> {
  try {
    const [fotos, snapshots] = await Promise.all([listAllFotosRaw(), listAllSnapshots()]);
    const deletedIds = new Set<string>();
    const deletedTopicoIds = new Set<string>();
    const orphanRowIds = new Set<string>();
    snapshots.forEach((snap) => {
      const data = snap.data as any;
      if (data?.visita?.deleted_at) deletedIds.add(snap.visitaId);
      (data?.topicos || []).forEach((t: any) => {
        if (!t?.deleted_at) return;
        deletedTopicoIds.add(t.id);
        orphanRowIds.add(t.id);
        (t.fotos || []).forEach((f: any) => { if (f?.id) orphanRowIds.add(f.id); });
      });
    });
    let removed = 0;
    for (const f of fotos) {
      const orphanVisita = f.visitaId && deletedIds.has(f.visitaId);
      const orphanTopico = f.parentKind === "topico" && deletedTopicoIds.has(f.parentId);
      if (orphanVisita || orphanTopico) {
        await deleteFoto(f.localId);
        removed++;
      }
    }
    for (const visitaId of deletedIds) {
      await deleteMutationsByVisita(visitaId);
    }
    await dropMutationsForRows(Array.from(orphanRowIds));
    if (removed > 0) {
      debugSync("fotos órfãs removidas da fila", { removed });
    }
    await refreshPendingCount();
    return removed;
  } catch (err) {
    debugSync("falha ao remover órfãos da fila", { error: getErrorMessage(err) });
    return 0;
  }
}


// auto-drain on network reconnect
if (typeof window !== "undefined") {
  window.addEventListener("online", () => void drain().catch((err) => debugSync("auto-sync de fotos falhou", { error: getErrorMessage(err) })));
  // limpeza única de órfãos + drain inicial
  void purgeOrphanQueueItems()
    .then(() => drain())
    .catch((err) => debugSync("sync inicial de fotos falhou", { error: getErrorMessage(err) }));
}

export async function getPendingCount() {
  return countPendingFotos();
}

