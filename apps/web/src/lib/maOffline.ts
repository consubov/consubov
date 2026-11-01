/**
 * Modo Offline do Mais Arrobas (Fase B).
 *
 * - `baixarDadosOffline` copia para o aparelho todos os dados do usuário
 *   (o RLS já limita ao próprio usuário) e ativa o modo.
 * - Com o modo ativo, `maFrom(tabela)` responde a partir do cache local
 *   combinado com a fila existente (inserts/updates/deletes pendentes),
 *   sem nenhuma consulta de rede. Alterações feitas por update/delete viram
 *   operações da mesma fila (idempotente) já usada nas Fases 1 e A.
 * - `sincronizarOffline` esvazia a fila, baixa o cache de novo e, se não
 *   sobrou pendência, desativa o modo automaticamente.
 */
import { openDB, type IDBPDatabase } from "idb";
import { supabase } from "@/integrations/supabase/client";
import { clearMaAcknowledgedRows, enqueueMa, flushMaAndCount, getMaAcknowledgedRows, getMaQueueItems, getMaSnapshot, subscribeMa, type MaQueueItem } from "@/lib/maisArrobasQueue";
import { coletarAlvosGmd, recalcularGmdServidor } from "@/lib/maGmdResync";

export type MaPerfil = "pesador" | "pecuarista";

export const MA_OFFLINE_TABLES: Record<MaPerfil, string[]> = {
  pesador: [
    "pesadores",
    "clientes_pesador",
    "pesagens_compra",
    "pesagens_compra_categorias",
    "pesos_pesagem_compra",
    "leituras_balancao_pesador",
  ],
  pecuarista: [
    "pecuaristas",
    "fazendas_pecuarista",
    "lotes_pecuarista",
    "categorias_pecuarista",
    "pesagens_lote_pecuarista",
    "pesos_animais_pecuarista",
    "animais_pecuarista",
    "leituras_balancao_pecuarista",
    "apartacoes_pecuarista",
    "apartacao_destinos_pecuarista",
  ],
};

/** Relações embutidas usadas nos selects (nome da relação → coluna FK). */
const EMBED_FK: Record<string, string> = {
  pesagens_lote_pecuarista: "pesagem_lote_id",
  lotes_pecuarista: "lote_id",
  clientes_pesador: "cliente_id",
  animais_pecuarista: "animal_id",
  fazendas_pecuarista: "fazenda_id",
};

const LS_KEY = "ma-offline-mode";
const DB_NAME = "mais-arrobas-offline";
const STORE = "tables";

interface OfflineState {
  active: boolean;
  perfil: MaPerfil | null;
  userId: string | null;
  downloadedAt: string | null;
}

function readState(): OfflineState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { active: false, perfil: null, userId: null, downloadedAt: null };
}

let state: OfflineState = typeof window !== "undefined" ? readState() : { active: false, perfil: null, userId: null, downloadedAt: null };
const listeners = new Set<() => void>();
function setState(next: Partial<OfflineState>) {
  state = { ...state, ...next };
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}
export function getMaOfflineState() { return state; }
export function isMaOffline() { return state.active; }
export function subscribeMaOffline(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// ---------- cache em IndexedDB + espelho em memória ----------
let dbPromise: Promise<IDBPDatabase> | null = null;
function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      },
    }).catch((e) => { dbPromise = null; throw e; });
  }
  return dbPromise;
}
const mem = new Map<string, Record<string, unknown>[]>();
let memLoaded: Promise<void> | null = null;
function loadMem() {
  if (!memLoaded) {
    memLoaded = (async () => {
      try {
        const db = await getDb();
        const keys = (await db.getAllKeys(STORE)) as string[];
        for (const k of keys) mem.set(k, ((await db.get(STORE, k)) as Record<string, unknown>[]) ?? []);
      } catch (e) {
        console.error("[maOffline] load failed", e);
      }
    })();
  }
  return memLoaded;
}

async function fetchAll(table: string) {
  const out: Record<string, unknown>[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await (supabase as any).from(table).select("*").range(from, from + page - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < page) break;
  }
  return out;
}

async function downloadTables(perfil: MaPerfil) {
  const tables = MA_OFFLINE_TABLES[perfil];
  const results = await Promise.all(tables.map(async (t) => [t, await fetchAll(t)] as const));
  const db = await getDb();
  await db.clear(STORE);
  mem.clear();
  for (const [t, rows] of results) {
    await db.put(STORE, rows, t);
    mem.set(t, rows);
    await clearMaAcknowledgedRows(t, rows.map((row) => String(row.id)));
  }
  memLoaded = Promise.resolve();
}

/** Baixa todos os dados do usuário e ativa o Modo Offline. */
export async function baixarDadosOffline(perfil: MaPerfil) {
  if (!navigator.onLine) throw new Error("Conecte-se à internet para preparar o Modo Offline.");
  const { data: { session } } = await supabase.auth.getSession();
  await downloadTables(perfil);
  setState({ active: true, perfil, userId: session?.user?.id ?? null, downloadedAt: new Date().toISOString() });
}

/**
 * Envia a fila, atualiza o cache e desativa o modo se não houver pendências.
 * Retorna quantos itens ainda ficaram pendentes.
 */
export async function sincronizarOffline(): Promise<number> {
  manualSync = true;
  try { return await sincronizarOfflineInterno(); } finally { manualSync = false; }
}

async function sincronizarOfflineInterno(): Promise<number> {
  if (!navigator.onLine) throw new Error("Sem internet. Conecte-se para sincronizar.");
  const alvosGmd = state.perfil === "pecuarista" ? unirAlvos(coletarAlvosGmd(await getMaQueueItems())) : null;
  const restantes = await flushMaAndCount();
  if (restantes > 0) return restantes;
  if (alvosGmd) {
    try { await recalcularGmdServidor(alvosGmd); } catch (e) { console.warn("[maOffline] recálculo de GMD falhou", e); }
  }
  if (state.perfil) await downloadTables(state.perfil);
  alvosVistos.pesoIds.clear();
  alvosVistos.pesagemIds.clear();
  setState({ active: false, downloadedAt: new Date().toISOString() });
  return 0;
}

/** Usuário atual sem rede quando o modo está ativo. */
export async function maGetUser() {
  if (state.active) {
    const { data: { session } } = await supabase.auth.getSession();
    return { data: { user: session?.user ?? null }, error: null } as any;
  }
  return supabase.auth.getUser();
}

// ---------- visão local = cache + fila ----------
function applyQueue(table: string, base: Record<string, any>[], queue: MaQueueItem[]) {
  const byId = new Map<string, Record<string, any>>();
  base.forEach((r) => byId.set(r.id, { ...r }));
  const now = new Date().toISOString();
  for (const { op } of queue) {
    if (op.kind === "pecuarista_peso_id") {
      if (table === "animais_pecuarista") {
        const existing = [...byId.values()].find((a) => a.pecuarista_id === op.pecuaristaId && a.numero === op.numero);
        if (existing) existing.lote_atual_id = op.loteId;
        else byId.set(op.animalIdLocal, { id: op.animalIdLocal, pecuarista_id: op.pecuaristaId, numero: op.numero, lote_atual_id: op.loteId, created_at: now });
      } else if (table === "pesos_animais_pecuarista") {
        const animal = [...(mem.get("animais_pecuarista") ?? [])].find((a) => a.pecuarista_id === op.pecuaristaId && a.numero === op.numero);
        byId.set(op.pesoId, {
          id: op.pesoId, pesagem_lote_id: op.pesagemLoteId, animal_id: animal?.id ?? op.animalIdLocal,
          peso_kg: op.pesoKg, gmd_individual: op.gmdIndividual, leitura_balancao_id: op.leituraBalancaoId, created_at: now,
        });
      }
      continue;
    }
    if (op.table !== table) continue;
    if (op.kind === "insert") {
      if (!byId.has(op.row.id)) byId.set(op.row.id, { created_at: now, ...op.row });
    } else if (op.kind === "update") {
      const r = byId.get(op.id);
      if (r) Object.assign(r, op.values);
    } else if (op.kind === "delete") {
      byId.delete(op.id);
    }
  }
  return [...byId.values()];
}

async function localRows(table: string) {
  await loadMem();
  const [queue, acknowledged] = await Promise.all([getMaQueueItems(), getMaAcknowledgedRows(table)]);
  const base = [...(mem.get(table) ?? []), ...acknowledged];
  return applyQueue(table, base, queue);
}

type Filter = (r: Record<string, any>) => boolean;

/** Extrai relações embutidas "nome!inner(colunas)" do texto do select. */
function parseEmbeds(cols: string) {
  const embeds: { name: string; inner: boolean; inside: string }[] = [];
  let i = 0;
  const re = /([a-z_]+)(!inner)?\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cols))) {
    if (m.index < i) continue;
    let depth = 1, j = re.lastIndex;
    while (j < cols.length && depth > 0) {
      if (cols[j] === "(") depth++;
      else if (cols[j] === ")") depth--;
      j++;
    }
    embeds.push({ name: m[1], inner: !!m[2], inside: cols.slice(re.lastIndex, j - 1) });
    i = j;
    re.lastIndex = j;
  }
  return embeds;
}

async function attachEmbeds(rows: Record<string, any>[], cols: string): Promise<Record<string, any>[]> {
  const embeds = parseEmbeds(cols);
  if (!embeds.length) return rows;
  let out = rows;
  for (const e of embeds) {
    const fk = EMBED_FK[e.name];
    if (!fk) continue;
    const targets = await localRows(e.name);
    const byId = new Map(targets.map((t) => [t.id, t]));
    const next: Record<string, any>[] = [];
    for (const r of out) {
      const t = byId.get(r[fk]);
      if (!t && e.inner) continue;
      const child = t ? (await attachEmbeds([{ ...t }], e.inside))[0] : null;
      if (!child && e.inner) continue;
      next.push({ ...r, [e.name]: child });
    }
    out = next;
  }
  return out;
}

class OfflineQuery {
  private filters: Filter[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private lim: number | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private mode: "select" | "update" | "delete" | "insert" | "upsert" = "select";
  private cols = "*";
  private countOpt = false;
  private head = false;
  private singleMode: "one" | "maybe" | null = null;
  private payload: any = null;
  private returning = false;

  constructor(private table: string) {}

  select(cols = "*", opts?: { count?: string; head?: boolean }) {
    if (this.mode !== "select") this.returning = true;
    else this.cols = cols;
    this.countOpt = !!opts?.count;
    this.head = !!opts?.head;
    return this;
  }
  update(values: any) { this.mode = "update"; this.payload = values; return this; }
  delete() { this.mode = "delete"; return this; }
  insert(rows: any) { this.mode = "insert"; this.payload = rows; return this; }
  upsert(rows: any) { this.mode = "upsert"; this.payload = rows; return this; }
  eq(c: string, v: any) { this.filters.push((r) => r[c] === v); return this; }
  neq(c: string, v: any) { this.filters.push((r) => r[c] !== v); return this; }
  gt(c: string, v: any) { this.filters.push((r) => r[c] != null && r[c] > v); return this; }
  gte(c: string, v: any) { this.filters.push((r) => r[c] != null && r[c] >= v); return this; }
  lt(c: string, v: any) { this.filters.push((r) => r[c] != null && r[c] < v); return this; }
  lte(c: string, v: any) { this.filters.push((r) => r[c] != null && r[c] <= v); return this; }
  in(c: string, vs: any[]) { const s = new Set(vs); this.filters.push((r) => s.has(r[c])); return this; }
  is(c: string, v: any) { this.filters.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
  not(c: string, op: string, v: any) {
    if (op === "is") this.filters.push((r) => (v === null ? r[c] != null : r[c] !== v));
    else if (op === "eq") this.filters.push((r) => r[c] !== v);
    else if (op === "in") {
      const s = new Set(String(v).replace(/[()]/g, "").split(",").map((x) => x.trim().replace(/^"|"$/g, "")));
      this.filters.push((r) => !s.has(String(r[c])));
    }
    return this;
  }
  ilike(c: string, pattern: string) {
    const re = new RegExp("^" + pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$", "i");
    this.filters.push((r) => re.test(String(r[c] ?? "")));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) { this.orders.push({ col, asc: opts?.ascending !== false }); return this; }
  limit(n: number) { this.lim = n; return this; }
  range(a: number, b: number) { this.rangeFrom = a; this.rangeTo = b; return this; }
  single() { this.singleMode = "one"; return this; }
  maybeSingle() { this.singleMode = "maybe"; return this; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  then(resolve: (v: any) => any, reject?: (e: any) => any) {
    return this.exec().then(resolve, reject);
  }

  private async exec(): Promise<{ data: any; error: any; count?: number | null }> {
    try {
      if (this.mode === "insert" || this.mode === "upsert") {
        const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r: any) => ({ id: r.id ?? crypto.randomUUID(), ...r }));
        rows.forEach((row: any) => enqueueMa(row.id, { kind: "insert", table: this.table, row }));
        const data = this.singleMode ? rows[0] : rows;
        return { data: this.returning || this.singleMode ? data : null, error: null };
      }
      let rows = (await localRows(this.table)).filter((r) => this.filters.every((f) => f(r)));
      if (this.mode === "update") {
        rows.forEach((r) => enqueueMa(r.id, { kind: "update", table: this.table, id: r.id, values: this.payload }));
        const data = rows.map((r) => ({ ...r, ...this.payload }));
        return { data: this.singleMode ? data[0] ?? null : this.returning ? data : null, error: null };
      }
      if (this.mode === "delete") {
        rows.forEach((r) => enqueueMa(r.id, { kind: "delete", table: this.table, id: r.id }));
        return { data: this.returning ? rows : null, error: null };
      }
      rows = await attachEmbeds(rows, this.cols);
      for (const o of [...this.orders].reverse()) {
        rows = [...rows].sort((a, b) => {
          const x = a[o.col], y = b[o.col];
          if (x == null && y == null) return 0;
          if (x == null) return o.asc ? 1 : -1;
          if (y == null) return o.asc ? -1 : 1;
          const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
          return o.asc ? c : -c;
        });
      }
      const count = rows.length;
      if (this.rangeFrom != null) rows = rows.slice(this.rangeFrom, (this.rangeTo ?? rows.length) + 1);
      if (this.lim != null) rows = rows.slice(0, this.lim);
      if (this.head) return { data: null, error: null, count };
      if (this.singleMode) {
        if (this.singleMode === "one" && rows.length !== 1) return { data: null, error: { message: "Registro não encontrado no aparelho" } };
        return { data: rows[0] ?? null, error: null };
      }
      return { data: rows, error: null, count: this.countOpt ? count : null };
    } catch (e: any) {
      return { data: null, error: { message: e?.message ?? String(e) } };
    }
  }
}

/** Substituto de `supabase.from` nas telas do Mais Arrobas. */
export const maFrom = ((table: string) => {
  if (state.active) return new OfflineQuery(table) as any;
  return (supabase as any).from(table);
}) as unknown as typeof supabase.from;

// ---------- Modo Offline só desliga pelo botão "Sincronizar" ----------
let manualSync = false;
const autoRunning = false;
let lastPending = 0;
// Alvos de GMD vistos na fila enquanto o modo está ativo (os itens somem ao serem enviados).
const alvosVistos = { pesoIds: new Set<string>(), pesagemIds: new Set<string>() };
function unirAlvos(a: { pesoIds: string[]; pesagemIds: string[] }) {
  a.pesoIds.forEach((id) => alvosVistos.pesoIds.add(id));
  a.pesagemIds.forEach((id) => alvosVistos.pesagemIds.add(id));
  return { pesoIds: [...alvosVistos.pesoIds], pesagemIds: [...alvosVistos.pesagemIds] };
}

if (typeof window !== "undefined") {
  subscribeMa(() => {
    const count = getMaSnapshot().pendingCount;
    if (state.active && state.perfil === "pecuarista" && count > 0) {
      void getMaQueueItems().then((items) => unirAlvos(coletarAlvosGmd(items)));
    }
    lastPending = count;
  });
}

// ---------- exclusão local (usado só pela exclusão de lote do Pecuarista) ----------
/** Retrato do cache local (tabela → linhas). */
export async function getMaCacheTables(): Promise<Map<string, Record<string, any>[]>> {
  await loadMem();
  return new Map(mem);
}

/** Remove do cache local as linhas cujo id esteja no conjunto. */
export async function removeMaCachedIds(ids: Set<string>) {
  if (ids.size === 0) return;
  await loadMem();
  const db = await getDb();
  for (const [t, rows] of mem) {
    const filtradas = rows.filter((r) => !ids.has(String(r?.id)));
    if (filtradas.length !== rows.length) {
      mem.set(t, filtradas);
      await db.put(STORE, filtradas, t);
    }
  }
}
