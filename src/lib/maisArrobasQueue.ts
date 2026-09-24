/**
 * Fila local + sincronização em segundo plano do Mais Arrobas (Pesador e
 * Pecuarista). Segue os mesmos princípios da fila do Capataz (gravar primeiro
 * no aparelho, enviar depois, reenvio idempotente), mas usa um banco local
 * PRÓPRIO para não interferir na infraestrutura do Consubov.
 *
 * - Cada operação carrega o id gerado no cliente; inserts viram
 *   upsert(onConflict: "id", ignoreDuplicates) → reenviar nunca duplica.
 * - Processamento em ordem (FIFO): uma leitura de balanção sempre chega antes
 *   dos pesos que dependem dela; o animal antes do peso.
 * - Falha de rede não descarta nada: a operação fica na fila e é reenviada.
 */
import { openDB, type IDBPDatabase } from "idb";
import { supabase } from "@/integrations/supabase/client";

export type MaOp =
  | { kind: "insert"; table: string; row: Record<string, any> }
  | { kind: "update"; table: string; id: string; values: Record<string, any> }
  | { kind: "delete"; table: string; id: string }
  | {
      /** Peso de animal identificado (Pecuarista): resolve/cria o animal pelo
       *  número no momento do envio e grava o peso com id fixo. */
      kind: "pecuarista_peso_id";
      pesoId: string;
      animalIdLocal: string;
      pecuaristaId: string;
      numero: string;
      loteId: string;
      pesagemLoteId: string;
      pesoKg: number;
      gmdIndividual: number | null;
      leituraBalancaoId: string | null;
    };

export interface MaQueueItem {
  id: string; // id da fila
  refId: string; // id do registro (peso/leitura) — usado no indicador visual
  op: MaOp;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

const DB_NAME = "mais-arrobas-sync";
const STORE = "queue";
const ACK_STORE = "acknowledged-inserts";
let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
        if (!db.objectStoreNames.contains(ACK_STORE)) db.createObjectStore(ACK_STORE, { keyPath: "key" });
      },
      terminated() {
        dbPromise = null;
      },
    }).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

// ---------- estado em memória (espelho da fila) + assinantes ----------
let memQueue: MaQueueItem[] = [];
let loaded = false;
let lastError: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

async function ensureLoaded() {
  if (loaded) return;
  try {
    const db = await getDb();
    const all = ((await db.getAll(STORE)) as MaQueueItem[]) ?? [];
    all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    // mescla com itens enfileirados antes do carregamento
    const ids = new Set(all.map((i) => i.id));
    memQueue = [...all, ...memQueue.filter((i) => !ids.has(i.id))];
  } catch (err) {
    console.error("[maisArrobasQueue] load failed", err);
  }
  loaded = true;
  emit();
}

async function persistPut(item: MaQueueItem) {
  try {
    const db = await getDb();
    await db.put(STORE, item);
  } catch (err) {
    console.error("[maisArrobasQueue] persist failed", err);
  }
}

async function persistDelete(id: string) {
  try {
    const db = await getDb();
    await db.delete(STORE, id);
  } catch (err) {
    console.error("[maisArrobasQueue] delete failed", err);
  }
}

interface MaAcknowledgedInsert {
  key: string;
  table: string;
  row: Record<string, any>;
}

async function persistAcknowledgedInsert(op: Extract<MaOp, { kind: "insert" }>) {
  const db = await getDb();
  await db.put(ACK_STORE, { key: `${op.table}:${op.row.id}`, table: op.table, row: op.row } satisfies MaAcknowledgedInsert);
}

/** Inserts já aceitos pelo servidor continuam visíveis até o próximo download. */
export async function getMaAcknowledgedRows(table: string): Promise<Record<string, any>[]> {
  const db = await getDb();
  const all = ((await db.getAll(ACK_STORE)) as MaAcknowledgedInsert[]) ?? [];
  return all.filter((item) => item.table === table).map((item) => ({ ...item.row }));
}

/** Remove somente confirmações que já constam no novo retrato vindo do servidor. */
export async function clearMaAcknowledgedRows(table: string, serverIds: Iterable<string>) {
  const ids = new Set(serverIds);
  if (ids.size === 0) return;
  const db = await getDb();
  const tx = db.transaction(ACK_STORE, "readwrite");
  let cursor = await tx.store.openCursor();
  while (cursor) {
    const item = cursor.value as MaAcknowledgedInsert;
    if (item.table === table && ids.has(String(item.row.id))) await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

let seq = 0;
function nextCreatedAt() {
  // garante ordem estável mesmo com várias operações no mesmo milissegundo
  seq = (seq + 1) % 1000;
  return `${new Date().toISOString()}#${String(seq).padStart(3, "0")}`;
}

/** Enfileira uma operação. Retorna imediatamente (não espera o servidor). */
export function enqueueMa(refId: string, op: MaOp) {
  const item: MaQueueItem = {
    id: crypto.randomUUID(),
    refId,
    op,
    createdAt: nextCreatedAt(),
    attempts: 0,
  };
  memQueue = [...memQueue, item];
  emit();
  void persistPut(item).then(() => scheduleFlush(0));
}

/**
 * Desfazer um registro. Se o insert dele ainda não saiu do aparelho, apenas
 * remove da fila (nada chega ao servidor). Caso contrário enfileira o delete.
 */
export function undoMa(refId: string, table: string) {
  const pendentes = memQueue.filter((i) => i.refId === refId && !isProcessing(i.id));
  const temInsertPendente = pendentes.some(
    (i) => i.op.kind === "insert" || i.op.kind === "pecuarista_peso_id",
  );
  if (temInsertPendente) {
    memQueue = memQueue.filter((i) => !pendentes.includes(i));
    pendentes.forEach((i) => void persistDelete(i.id));
    emit();
    return;
  }
  enqueueMa(refId, { kind: "delete", table, id: refId });
}

// ---------- processamento ----------
let flushing: string | null = null; // id do item em envio
let timer: ReturnType<typeof setTimeout> | null = null;

function isProcessing(id: string) {
  return flushing === id;
}

function scheduleFlush(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flushMa();
  }, ms);
}

function withTimeout<T>(p: PromiseLike<T>, ms = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Tempo esgotado ao enviar")), ms);
    Promise.resolve(p).then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

async function runOp(op: MaOp) {
  const sb = supabase as any;
  if (op.kind === "insert") {
    const { error } = await withTimeout(
      sb.from(op.table).upsert(op.row, { onConflict: "id", ignoreDuplicates: true }),
    ) as any;
    if (error) throw error;
    return;
  }
  if (op.kind === "update") {
    const { error } = await withTimeout(sb.from(op.table).update(op.values).eq("id", op.id)) as any;
    if (error) throw error;
    return;
  }
  if (op.kind === "delete") {
    const { error } = await withTimeout(sb.from(op.table).delete().eq("id", op.id)) as any;
    if (error) throw error;
    return;
  }
  // pecuarista_peso_id
  const { data: an, error: eBusca } = await withTimeout(
    sb.from("animais_pecuarista").select("id")
      .eq("pecuarista_id", op.pecuaristaId).eq("numero", op.numero).maybeSingle(),
  ) as any;
  if (eBusca) throw eBusca;
  let animalId: string;
  if (an) {
    animalId = an.id;
    const { error } = await withTimeout(
      sb.from("animais_pecuarista").update({ lote_atual_id: op.loteId }).eq("id", animalId),
    ) as any;
    if (error) throw error;
  } else {
    animalId = op.animalIdLocal;
    const { error } = await withTimeout(
      sb.from("animais_pecuarista").upsert(
        { id: animalId, pecuarista_id: op.pecuaristaId, numero: op.numero, lote_atual_id: op.loteId },
        { onConflict: "id", ignoreDuplicates: true },
      ),
    ) as any;
    if (error) throw error;
  }
  const { error: eP } = await withTimeout(
    sb.from("pesos_animais_pecuarista").upsert(
      {
        id: op.pesoId,
        pesagem_lote_id: op.pesagemLoteId,
        animal_id: animalId,
        peso_kg: op.pesoKg,
        gmd_individual: op.gmdIndividual,
        leitura_balancao_id: op.leituraBalancaoId,
      },
      { onConflict: "id", ignoreDuplicates: true },
    ),
  ) as any;
  if (eP) throw eP;
}

function isDuplicateLoteCode(err: any, op: MaOp) {
  if (op.kind !== "insert" || op.table !== "lotes_pecuarista") return false;
  const text = `${err?.code ?? ""} ${err?.message ?? ""} ${err?.details ?? ""}`;
  return text.includes("23505") || text.includes("lotes_pecuarista_pecuarista_codigo_key");
}

/**
 * Recupera automaticamente um lote criado offline cujo código foi ocupado por
 * outro envio. O UUID não muda, portanto pesagens e pesos dependentes continuam
 * apontando para o mesmo lote.
 */
async function repairDuplicateLoteCode(item: MaQueueItem): Promise<boolean> {
  if (item.op.kind !== "insert" || item.op.table !== "lotes_pecuarista") return false;
  const op = item.op;
  const pecuaristaId = op.row.pecuarista_id;
  if (typeof pecuaristaId !== "string") return false;

  const sb = supabase as any;
  const { data, error } = await withTimeout(
    sb.from("lotes_pecuarista").select("id, codigo").eq("pecuarista_id", pecuaristaId),
  ) as any;
  if (error) throw error;

  const alreadySaved = (data ?? []).some((row: any) => row.id === op.row.id);
  if (alreadySaved) return true;

  const used = new Set<string>((data ?? []).map((row: any) => String(row.codigo)));
  for (const queued of memQueue) {
    if (queued.id === item.id || queued.op.kind !== "insert" || queued.op.table !== "lotes_pecuarista") continue;
    if (queued.op.row.pecuarista_id === pecuaristaId) used.add(String(queued.op.row.codigo));
  }
  for (const row of await getMaAcknowledgedRows("lotes_pecuarista")) {
    if (row.pecuarista_id === pecuaristaId) used.add(String(row.codigo));
  }

  const nextCode = nextMaLoteCodigo(used);
  const repaired: MaQueueItem = {
    ...item,
    op: { ...op, row: { ...op.row, codigo: nextCode } },
    lastError: undefined,
  };
  memQueue = memQueue.map((queued) => queued.id === item.id ? repaired : queued);
  await persistPut(repaired);
  emit();
  return false;
}

let retryDelay = 3000;

/** Envia a fila em ordem. Para no primeiro erro e tenta de novo depois. */
export async function flushMa(): Promise<void> {
  await ensureLoaded();
  if (flushing) return;
  while (memQueue.length > 0) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      scheduleFlush(10000);
      return;
    }
    const item = memQueue[0];
    flushing = item.id;
    try {
      await runOp(item.op);
      if (item.op.kind === "insert") await persistAcknowledgedInsert(item.op);
      memQueue = memQueue.filter((i) => i.id !== item.id);
      await persistDelete(item.id);
      lastError = null;
      retryDelay = 3000;
      flushing = null;
      emit();
    } catch (err: any) {
      flushing = null;
      if (isDuplicateLoteCode(err, item.op)) {
        try {
          const alreadySaved = await repairDuplicateLoteCode(item);
          if (alreadySaved) {
            memQueue = memQueue.filter((queued) => queued.id !== item.id);
            await persistDelete(item.id);
          }
          retryDelay = 3000;
          emit();
          continue;
        } catch (repairError) {
          console.warn("[maisArrobasQueue] não foi possível corrigir o código do lote", repairError);
        }
      }
      const msg = err?.message ?? String(err);
      const updated = { ...item, attempts: item.attempts + 1, lastError: msg };
      memQueue = memQueue.map((i) => (i.id === item.id ? updated : i));
      void persistPut(updated);
      lastError = msg;
      console.warn("[maisArrobasQueue] envio falhou, nova tentativa em", retryDelay, "ms:", msg);
      emit();
      scheduleFlush(retryDelay);
      retryDelay = Math.min(retryDelay * 2, 60000);
      return;
    }
  }
}

/** Tenta esvaziar a fila e informa quantos itens ainda restam. */
export async function flushMaAndCount(): Promise<number> {
  await flushMa();
  // se outro envio já estava em andamento, espera ele terminar
  for (let i = 0; i < 60 && flushing; i++) await new Promise((r) => setTimeout(r, 250));
  return memQueue.length;
}

/** Leitura (somente) dos itens da fila, já carregados do aparelho. */
export async function getMaQueueItems(): Promise<MaQueueItem[]> {
  await ensureLoaded();
  return [...memQueue];
}

/** Retorna inserts locais ainda pendentes de uma tabela, em ordem FIFO. */
export async function getMaPendingRows(table: string): Promise<Record<string, any>[]> {
  const [items, acknowledged] = await Promise.all([getMaQueueItems(), getMaAcknowledgedRows(table)]);
  const pending = items
    .filter((item) => item.op.kind === "insert" && item.op.table === table)
    .map((item) => (item.op.kind === "insert" ? { ...item.op.row } : {}));
  return mergeMaRows(acknowledged as Array<{ id: string }>, pending) as Record<string, any>[];
}

/** Combina registros confirmados com inserts locais sem duplicar UUIDs. */
export function mergeMaRows<T extends { id: string }>(serverRows: T[], pendingRows: Record<string, any>[]): T[] {
  const byId = new Map(serverRows.map((row) => [row.id, row]));
  for (const row of pendingRows) {
    if (typeof row.id === "string" && !byId.has(row.id)) byId.set(row.id, row as T);
  }
  return [...byId.values()];
}

/** Próximo código de lote considerando servidor e lotes ainda no aparelho. */
export function nextMaLoteCodigo(codigos: Iterable<string>): string {
  const usados = new Set(codigos);
  for (let i = 1; i <= 999; i++) {
    const codigo = String(i).padStart(3, "0");
    if (!usados.has(codigo)) return codigo;
  }
  throw new Error("Limite de 999 lotes atingido");
}

export function getMaSnapshot() {
  return {
    pendingRefIds: new Set(memQueue.map((i) => i.refId)),
    pendingCount: memQueue.length,
    lastError,
  };
}

export function subscribeMa(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// dispara ao voltar a internet e ao carregar
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    retryDelay = 3000;
    scheduleFlush(500);
  });
  void ensureLoaded().then(() => {
    if (memQueue.length) scheduleFlush(1000);
  });
}
