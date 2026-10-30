import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface Observacao {
  foto_url: string; // base64 data URL
  texto: string;
}

export interface LancamentoOffline {
  id: string;
  tipo: 'salga' | 'falha_qr';
  pasto_id: string;
  pasto_nome: string;
  sacos: number;
  foto_auditoria_url: string | null;
  foto_auditoria_exigida: boolean;
  observacoes: Observacao[];
  data: string; // ISO string
  status: 'pendente' | 'sincronizado';
  justificativa_falha_qr?: string;
  ciclo_id?: string;
  // Consumption calculation fields
  consumo_esperado_kg?: number;
  consumo_real_kg?: number;
  indice_consumo?: number;
  status_consumo?: string;
  dias_intervalo?: number;
  // Cocho cheio
  cocho_cheio?: boolean;
  foto_cocho_url?: string | null;
  // Trava suave: usuário confirmou 2º lançamento do mesmo pasto no mesmo dia
  duplicado_confirmado?: boolean;
}

export interface ObservacaoOffline {
  id: string;
  pasto_id: string | null;
  pasto_nome: string;
  retiro_id: string;
  fazenda_id: string;
  capataz_nome: string;
  tipo: string;
  descricao: string | null;
  foto_url: string;
  criado_em: string;
  status: 'pendente' | 'sincronizado';
}

export interface PastoCache {
  id: string;
  nome: string;
  num_animais: number;
  peso_medio_kg: number | null;
  dias_no_pasto: number | null;
  qr_uuid: string;
  produto_id: string | null;
  sexo: string | null;
  categoria: string | null;
  data_entrada: string | null;
  peso_entrada: number | null;
  gmd_kg_dia: number | null;
  data_fim_carencia?: string | null;
}

export interface RetiroCache {
  id: string;
  nome: string;
  fazenda_nome: string;
  gmd_recria1: number | null;
  gmd_recria2: number | null;
  gmd_engorda: number | null;
}

export interface CicloCache {
  id: string;
  mes: number;
  ano: number;
  fechado: boolean;
  num_dias: number;
  data_inicio?: string | null;
  data_fim?: string | null;
  duracao_dias?: number | null;
}

export interface ProdutoCache {
  id: string;
  nome: string;
  peso_saco_kg: number;
  consumo_por_100kg: number | null;
  consumo_recria1: number | null;
  consumo_recria2: number | null;
  consumo_engorda: number | null;
}

export interface FazendaCache {
  id: string;
  nome: string;
  intervalo_padrao_dias: number;
  auditoria_fotos_por_bloco: number;
  /** Efetivo (retiro → fazenda → padrão). Ausente em caches antigos = obrigatória. */
  exigir_foto_cocho?: boolean;
}

export interface SyncQueueItem {
  id: string;
  type: string;
  payload: any;
  createdAt: string;
}

export interface SyncErrorLog {
  id: string;            // record_id (lancamento/observacao/...)
  recordType: string;    // 'lancamento' | 'observacao' | 'mortalidade' | 'fechar_mes' | ...
  errorMessage: string;
  timestamp: string;     // ISO
  attemptCount: number;
}

export interface PesagemPendente {
  id: string;
  lote_id: string;
  pesos: number[];
  total_pesado: number;
  media_calculada: number;
  peso_medio_aplicado: number | null;
  data_pesagem: string;
  usuario_id: string;
  usuario_nome: string;
  pasto_nome: string;
  num_animais: number;
  peso_medio_atual: number | null;
  sincronizado: boolean;
  criado_em: string;
  sanitario_data?: any | null;
}

interface ConsubovDB extends DBSchema {
  lancamentos: {
    key: string;
    value: LancamentoOffline;
    indexes: { 'by-status': string; 'by-pasto': string; 'by-data': string };
  };
  pastos: {
    key: string;
    value: PastoCache;
    indexes: { 'by-qr': string };
  };
  retiro: {
    key: string;
    value: RetiroCache;
  };
  ciclos: {
    key: string;
    value: CicloCache;
  };
  produtoAtivo: {
    key: string;
    value: ProdutoCache;
  };
  fazendaCache: {
    key: string;
    value: FazendaCache;
  };
  config: {
    key: string;
    value: { key: string; value: string };
  };
  observacoesOffline: {
    key: string;
    value: ObservacaoOffline;
    indexes: { 'by-status': string };
  };
  pesagensPendentes: {
    key: string;
    value: PesagemPendente;
    indexes: { 'by-sincronizado': string };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
  };
  syncErrors: {
    key: string;
    value: SyncErrorLog;
  };
  lastPdfs: {
    key: string; // 'last_pdf_{retiro_id}'
    value: LastPdfEntry;
  };
}

export interface LastPdfEntry {
  id: string;            // 'last_pdf_{retiro_id}'
  retiroId: string;
  retiroNome: string;
  fileName: string;
  blob: Blob;
  generatedAt: string;   // ISO
  rangeStartIso?: string | null;
  rangeEndIso?: string | null;
}

let dbPromise: Promise<IDBPDatabase<ConsubovDB>> | null = null;

function openConsubovDb() {
  return openDB<ConsubovDB>('consubov-capataz', 7, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const lancStore = db.createObjectStore('lancamentos', { keyPath: 'id' });
        lancStore.createIndex('by-status', 'status');
        lancStore.createIndex('by-pasto', 'pasto_id');
        lancStore.createIndex('by-data', 'data');

        const pastosStore = db.createObjectStore('pastos', { keyPath: 'id' });
        pastosStore.createIndex('by-qr', 'qr_uuid');

        db.createObjectStore('retiro', { keyPath: 'id' });
        db.createObjectStore('ciclos', { keyPath: 'id' });
        db.createObjectStore('config', { keyPath: 'key' });
      }
      if (oldVersion < 2) {
        const obsStore = db.createObjectStore('observacoesOffline', { keyPath: 'id' });
        obsStore.createIndex('by-status', 'status');
      }
      if (oldVersion < 3) {
        db.createObjectStore('produtoAtivo', { keyPath: 'id' });
        db.createObjectStore('fazendaCache', { keyPath: 'id' });
      }
      if (oldVersion < 4) {
        const pesStore = db.createObjectStore('pesagensPendentes', { keyPath: 'id' });
        pesStore.createIndex('by-sincronizado', 'sincronizado');
      }
      if (oldVersion < 5) {
        db.createObjectStore('syncQueue', { keyPath: 'id' });
      }
      if (oldVersion < 6) {
        db.createObjectStore('syncErrors', { keyPath: 'id' });
      }
      if (oldVersion < 7) {
        db.createObjectStore('lastPdfs', { keyPath: 'id' });
      }
    },
    blocked() {
      console.warn('[offlineDb] open blocked by another tab');
    },
    blocking() {
      console.warn('[offlineDb] another tab is upgrading the DB');
    },
    terminated() {
      console.warn('[offlineDb] connection terminated — will reopen on next call');
      dbPromise = null;
    },
  });
}

function getDb() {
  if (!dbPromise) {
    dbPromise = openConsubovDb().catch((err) => {
      // Reset so the next call retries instead of caching a rejected promise
      dbPromise = null;
      console.error('[offlineDb] openDB failed:', err);
      throw err;
    });
  }
  return dbPromise;
}

/** Run an IndexedDB operation safely. Returns fallback on any failure
 *  (Safari private mode, quota exceeded, schema mismatch, etc.) so the
 *  UI never crashes from a low-level storage error. */
async function safeRun<T>(op: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await op();
  } catch (err) {
    console.error('[offlineDb] operation failed, using fallback:', err);
    return fallback;
  }
}

/** Writes must never return a success-shaped fallback on IndexedDB/quota errors. */
export class OfflineWriteError extends Error {
  readonly code = 'OFFLINE_WRITE_FAILED';

  constructor() {
    super('Não foi possível salvar no aparelho. Libere espaço e tente novamente.');
    this.name = 'OfflineWriteError';
  }
}

async function confirmedPut<K extends 'lancamentos' | 'observacoesOffline' | 'pesagensPendentes' | 'config'>(
  store: K,
  value: ConsubovDB[K]['value'],
  id: string,
): Promise<void> {
  try {
    const db = await getDb();
    // The transaction must COMMIT before the caller can claim an offline save.
    const tx = db.transaction(store, 'readwrite');
    await tx.store.put(value as never);
    await tx.done;
    // getKey does not clone large base64 photos back into JS memory.
    if ((await db.getKey(store, id)) !== id) throw new Error('IndexedDB key not persisted');
  } catch (error) {
    console.error('[offlineDb] durable write failed:', error);
    throw new OfflineWriteError();
  }
}

// Pastos
// Ordenação única e determinística da lista de pastos (mesma ordem no cache
// local e nos dados vindos do servidor) — evita a lista "pular" ao alternar
// entre as duas fontes.
export function sortPastos<T extends { nome?: string | null }>(pastos: T[]): T[] {
  return [...pastos].sort((a, b) =>
    (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR', { numeric: true, sensitivity: 'base' })
  );
}

export async function cachePastos(pastos: PastoCache[]) {
  return safeRun(async () => {
    const db = await getDb();
    const tx = db.transaction('pastos', 'readwrite');
    await tx.store.clear();
    for (const p of pastos) await tx.store.put(p);
    await tx.done;
  }, undefined);
}

export async function getCachedPastos(): Promise<PastoCache[]> {
  return safeRun(async () => {
    const db = await getDb();
    return sortPastos((await db.getAll('pastos')) ?? []);
  }, []);
}

export async function getPastoByQr(qrUuid: string): Promise<PastoCache | undefined> {
  return safeRun(async () => {
    const db = await getDb();
    return db.getFromIndex('pastos', 'by-qr', qrUuid);
  }, undefined);
}

// Retiro
export async function cacheRetiro(retiro: RetiroCache) {
  return safeRun(async () => {
    const db = await getDb();
    const tx = db.transaction('retiro', 'readwrite');
    await tx.store.clear();
    await tx.store.put(retiro);
    await tx.done;
  }, undefined);
}

export async function getCachedRetiro(): Promise<RetiroCache | undefined> {
  return safeRun(async () => {
    const db = await getDb();
    const all = (await db.getAll('retiro')) ?? [];
    return all[0];
  }, undefined);
}

// Ciclos
export async function cacheCiclos(ciclos: CicloCache[]) {
  return safeRun(async () => {
    const db = await getDb();
    const tx = db.transaction('ciclos', 'readwrite');
    await tx.store.clear();
    for (const c of ciclos) await tx.store.put(c);
    await tx.done;
  }, undefined);
}

export async function getCachedCiclos(): Promise<CicloCache[]> {
  return safeRun(async () => {
    const db = await getDb();
    return (await db.getAll('ciclos')) ?? [];
  }, []);
}

// Lightweight read: never clone an entire history of base64 photos into memory
// merely to compute daily labels and totals. Full records remain untouched in IDB.
export async function getLancamentosResumo(): Promise<LancamentoOffline[]> {
  const db = await getDb();
  const tx = db.transaction('lancamentos', 'readonly');
  const rows: LancamentoOffline[] = [];
  let cursor = await tx.store.openCursor();
  while (cursor) {
    const r = cursor.value;
    if (r) rows.push({
      id: r.id, tipo: r.tipo, pasto_id: r.pasto_id, pasto_nome: r.pasto_nome,
      sacos: r.sacos, data: r.data, status: r.status,
      foto_auditoria_url: null, foto_auditoria_exigida: r.foto_auditoria_exigida,
      observacoes: [], ciclo_id: r.ciclo_id, cocho_cheio: r.cocho_cheio,
      status_consumo: r.status_consumo, indice_consumo: r.indice_consumo,
      duplicado_confirmado: r.duplicado_confirmado,
    });
    cursor = await cursor.continue();
  }
  await tx.done;
  return rows;
}

/** The local history may contain completed salgas from an earlier retiro.
 * Never expose those rows as today's work after a retiro switch.
 */
export function lancamentosDoRetiro<T extends { pasto_id: string }>(
  lancamentos: T[],
  pastos: Array<{ id: string }>,
): T[] {
  const permitidos = new Set(pastos.map((p) => p.id));
  return lancamentos.filter((l) => permitidos.has(l.pasto_id));
}

/** Fail closed before submitting any offline launch. The RPC receives the
 * current fazenda/retiro; an old pasto must not inherit a different scope.
 */
export function assertLancamentoNoRetiroAtivo(
  lancamento: { pasto_id: string },
  pastosAtuais: Array<{ id: string }>,
  retiroId: string | null,
  fazendaId: string | null,
): void {
  if (!retiroId || !fazendaId || !pastosAtuais.some((p) => p.id === lancamento.pasto_id)) {
    throw new Error('Registro de outro retiro ou dados de fazenda indisponíveis. Sincronização bloqueada para evitar mistura.');
  }
}

/** Read only IDs to deduplicate remote history without cloning photo payloads. */
export async function getLancamentoIds(): Promise<string[]> {
  const db = await getDb();
  return await db.getAllKeys('lancamentos');
}

/** Fail closed: a retiro switch cannot mix an unsynced action with the new scope.
 * Every check throws on IndexedDB read errors instead of using []/0 fallbacks.
 */
export async function assertRetiroSwitchSafe(): Promise<void> {
  const db = await getDb();
  const [pendentes, fechamento] = await Promise.all([
    db.countFromIndex('lancamentos', 'by-status', 'pendente'),
    db.get('config', 'fechar_mes_pendente'),
  ]);
  if (pendentes > 0 || fechamento?.value) {
    throw new Error('Sincronize os lançamentos e fechamentos pendentes antes de trocar de retiro.');
  }
}

// Lancamentos
export async function saveLancamento(lancamento: LancamentoOffline): Promise<void> {
  await confirmedPut('lancamentos', lancamento, lancamento.id);
}

export async function getLancamentosPendentes(): Promise<LancamentoOffline[]> {
  return safeRun(async () => {
    const db = await getDb();
    return (await db.getAllFromIndex('lancamentos', 'by-status', 'pendente')) ?? [];
  }, []);
}

export async function getLancamentosHoje(): Promise<LancamentoOffline[]> {
  return safeRun(async () => {
    const db = await getDb();
    const all = (await db.getAll('lancamentos')) ?? [];
    const hoje = new Date().toISOString().slice(0, 10);
    return all.filter((l) => typeof l?.data === 'string' && l.data.slice(0, 10) === hoje);
  }, []);
}

export async function getAllLancamentos(): Promise<LancamentoOffline[]> {
  return safeRun(async () => {
    const db = await getDb();
    return (await db.getAll('lancamentos')) ?? [];
  }, []);
}

export async function markSincronizado(id: string) {
  return safeRun(async () => {
    const db = await getDb();
    const l = await db.get('lancamentos', id);
    if (l) {
      l.status = 'sincronizado';
      await db.put('lancamentos', l);
    }
  }, undefined);
}

// Config
export async function setConfig(key: string, value: string) {
  return safeRun(async () => {
    const db = await getDb();
    await db.put('config', { key, value });
  }, undefined);
}

export async function getConfig(key: string): Promise<string | undefined> {
  return safeRun(async () => {
    const db = await getDb();
    const item = await db.get('config', key);
    return item?.value;
  }, undefined);
}

export async function deleteLancamento(id: string) {
  return safeRun(async () => {
    const db = await getDb();
    await db.delete('lancamentos', id);
  }, undefined);
}

// Sacos consumidos por pasto hoje
export async function getSacosHojePorPasto(): Promise<Record<string, number>> {
  const lancamentos = await getLancamentosHoje();
  const map: Record<string, number> = {};
  for (const l of lancamentos) {
    map[l.pasto_id] = (map[l.pasto_id] || 0) + l.sacos;
  }
  return map;
}

// Observações Offline
export async function saveObservacaoOffline(obs: ObservacaoOffline): Promise<void> {
  await confirmedPut('observacoesOffline', obs, obs.id);
}

export async function getAllObservacoes(): Promise<ObservacaoOffline[]> {
  return safeRun(async () => {
    const db = await getDb();
    return (await db.getAll('observacoesOffline')) ?? [];
  }, []);
}

export async function getObservacoesPendentes(): Promise<ObservacaoOffline[]> {
  return safeRun(async () => {
    const db = await getDb();
    return (await db.getAllFromIndex('observacoesOffline', 'by-status', 'pendente')) ?? [];
  }, []);
}

export async function getObservacoesSincronizadas(): Promise<ObservacaoOffline[]> {
  return safeRun(async () => {
    const db = await getDb();
    return (await db.getAllFromIndex('observacoesOffline', 'by-status', 'sincronizado')) ?? [];
  }, []);
}

export async function markObservacaoSincronizada(id: string) {
  return safeRun(async () => {
    const db = await getDb();
    const obs = await db.get('observacoesOffline', id);
    if (obs) {
      obs.status = 'sincronizado';
      await db.put('observacoesOffline', obs);
    }
  }, undefined);
}

export async function deleteObservacaoOffline(id: string) {
  return safeRun(async () => {
    const db = await getDb();
    await db.delete('observacoesOffline', id);
  }, undefined);
}

// Fechar Mês (stored in config store)
export interface FecharMesPendente {
  tipo: 'fechar_mes';
  ciclo_id: string;
  data: string;
  status: 'pendente';
}

export async function saveFecharMes(action: FecharMesPendente): Promise<void> {
  await confirmedPut('config', { key: 'fechar_mes_pendente', value: JSON.stringify(action) }, 'fechar_mes_pendente');
}

export async function getFecharMesPendente(): Promise<FecharMesPendente | null> {
  return safeRun(async () => {
    const db = await getDb();
    const item = await db.get('config', 'fechar_mes_pendente');
    if (!item?.value) return null;
    try {
      return JSON.parse(item.value) as FecharMesPendente;
    } catch {
      return null;
    }
  }, null);
}

export async function clearFecharMes() {
  return safeRun(async () => {
    const db = await getDb();
    await db.delete('config', 'fechar_mes_pendente');
  }, undefined);
}

// Produto Ativo
export async function cacheProdutoAtivo(produto: ProdutoCache) {
  return safeRun(async () => {
    const db = await getDb();
    const tx = db.transaction('produtoAtivo', 'readwrite');
    await tx.store.clear();
    await tx.store.put(produto);
    await tx.done;
  }, undefined);
}

export async function getCachedProdutoAtivo(): Promise<ProdutoCache | undefined> {
  return safeRun(async () => {
    const db = await getDb();
    const all = (await db.getAll('produtoAtivo')) ?? [];
    return all[0];
  }, undefined);
}

// Fazenda Cache
export async function cacheFazenda(fazenda: FazendaCache) {
  return safeRun(async () => {
    const db = await getDb();
    const tx = db.transaction('fazendaCache', 'readwrite');
    await tx.store.clear();
    await tx.store.put(fazenda);
    await tx.done;
  }, undefined);
}

export async function getCachedFazenda(): Promise<FazendaCache | undefined> {
  return safeRun(async () => {
    const db = await getDb();
    const all = (await db.getAll('fazendaCache')) ?? [];
    return all[0];
  }, undefined);
}

// Pesagens Pendentes (offline)
export async function savePesagemPendente(pesagem: PesagemPendente): Promise<void> {
  await confirmedPut('pesagensPendentes', pesagem, pesagem.id);
}

export async function getPesagensPendentes(): Promise<PesagemPendente[]> {
  return safeRun(async () => {
    const db = await getDb();
    const all = (await db.getAll('pesagensPendentes')) ?? [];
    return all.filter(p => p && !p.sincronizado);
  }, []);
}

export async function countPesagensPendentes(): Promise<number> {
  return safeRun(async () => {
    const db = await getDb();
    const all = (await db.getAll('pesagensPendentes')) ?? [];
    return all.filter(p => p && !p.sincronizado).length;
  }, 0);
}

export async function markPesagemSincronizada(id: string) {
  return safeRun(async () => {
    const db = await getDb();
    const p = await db.get('pesagensPendentes', id);
    if (p) {
      p.sincronizado = true;
      await db.put('pesagensPendentes', p);
    }
  }, undefined);
}

export async function deletePesagemPendente(id: string) {
  return safeRun(async () => {
    const db = await getDb();
    await db.delete('pesagensPendentes', id);
  }, undefined);
}

// Sync Queue (for offline PDF uploads etc.)
export async function saveSyncQueueItem(item: SyncQueueItem) {
  return safeRun(async () => {
    const db = await getDb();
    await db.put('syncQueue', item);
  }, undefined);
}

export async function getSyncQueueItems(): Promise<SyncQueueItem[]> {
  return safeRun(async () => {
    const db = await getDb();
    return (await db.getAll('syncQueue')) ?? [];
  }, []);
}

export async function deleteSyncQueueItem(id: string) {
  return safeRun(async () => {
    const db = await getDb();
    await db.delete('syncQueue', id);
  }, undefined);
}

// Sync Errors (for visibility / retry per-record)
export async function logSyncError(entry: Omit<SyncErrorLog, 'timestamp' | 'attemptCount'> & { timestamp?: string }) {
  return safeRun(async () => {
    const db = await getDb();
    const existing = await db.get('syncErrors', entry.id);
    const attemptCount = (existing?.attemptCount ?? 0) + 1;
    await db.put('syncErrors', {
      id: entry.id,
      recordType: entry.recordType,
      errorMessage: entry.errorMessage,
      timestamp: entry.timestamp ?? new Date().toISOString(),
      attemptCount,
    });
  }, undefined);
}

export async function clearSyncError(id: string) {
  return safeRun(async () => {
    const db = await getDb();
    await db.delete('syncErrors', id);
  }, undefined);
}

export async function getSyncErrors(): Promise<SyncErrorLog[]> {
  return safeRun(async () => {
    const db = await getDb();
    return (await db.getAll('syncErrors')) ?? [];
  }, []);
}

export async function getTotalPendingCount(): Promise<number> {
  return safeRun(async () => {
    const db = await getDb();
    // Index counts avoid cloning every pending base64 image into memory every 10 s.
    // Pesagens use an indexed boolean (not a valid IDB key), so they still need filtering.
    const [lanc, obs, pes, fechar] = await Promise.all([
      db.countFromIndex('lancamentos', 'by-status', 'pendente'),
      db.countFromIndex('observacoesOffline', 'by-status', 'pendente'),
      db.getAll('pesagensPendentes'),
      db.get('config', 'fechar_mes_pendente'),
    ]);
    const pesPend = (pes ?? []).filter((p) => p && !p.sincronizado).length;
    return lanc + obs + pesPend + (fechar?.value ? 1 : 0);
  }, 0);
}


// Last generated salga PDF per retiro
export async function saveLastPdf(entry: LastPdfEntry) {
  return safeRun(async () => {
    const db = await getDb();
    await db.put('lastPdfs', entry);
  }, undefined);
}

export async function getLastPdf(retiroId: string): Promise<LastPdfEntry | undefined> {
  return safeRun(async () => {
    const db = await getDb();
    return db.get('lastPdfs', `last_pdf_${retiroId}`);
  }, undefined);
}

export async function deleteLastPdf(retiroId: string) {
  return safeRun(async () => {
    const db = await getDb();
    await db.delete('lastPdfs', `last_pdf_${retiroId}`);
  }, undefined);
}

/** Limpa todo o cache local vinculado a um retiro específico (pastos, retiro,
 *  ciclos, produto ativo e fazenda) ao trocar de retiro. Lançamentos pendentes
 *  de sincronização são preservados; os já sincronizados são descartados para
 *  nunca misturar dados de dois retiros. */
export async function clearRetiroScopedCache() {
  return safeRun(async () => {
    const db = await getDb();
    for (const store of ['pastos', 'retiro', 'ciclos', 'produtoAtivo', 'fazendaCache'] as const) {
      const tx = db.transaction(store, 'readwrite');
      await tx.store.clear();
      await tx.done;
    }
    const lancamentos = (await db.getAll('lancamentos')) ?? [];
    for (const l of lancamentos) {
      if (l?.status === 'sincronizado') await db.delete('lancamentos', l.id);
    }
  }, undefined);
}

/** Walk a bounded page of records without loading the full photo history.
 * Cursor is an exclusive launch id, and is reset to null after the final page.
 * Read-only: never modifies pending records, history, or photos.
 */
export async function getLancamentosFotoPage(
  afterId: string | null,
  pageSize = 8,
): Promise<{ records: LancamentoOffline[]; cursor: string | null; hasMore: boolean }> {
  const db = await getDb();
  const limit = Math.max(1, Math.min(32, Math.floor(pageSize)));
  const range = afterId ? IDBKeyRange.lowerBound(afterId, true) : undefined;
  const tx = db.transaction('lancamentos', 'readonly');
  let entry = await tx.store.openCursor(range);
  let scanned = 0;
  let cursor = afterId;
  const records: LancamentoOffline[] = [];
  while (entry && scanned < limit) {
    scanned += 1;
    cursor = String(entry.primaryKey);
    const row = entry.value;
    if (row?.foto_auditoria_url?.startsWith('data:image/')) records.push(row);
    entry = await entry.continue();
  }
  await tx.done;
  return { records, cursor, hasMore: Boolean(entry) };
}

/** Atomic replacement of the active retiro's reference data.
 * Never touch unsent commands, photos, pesagens, or launch history.
 * If quota/write fails, IndexedDB aborts the transaction and old references survive.
 */
export interface RetiroReferenceSnapshot {
  retiro: RetiroCache;
  pastos: PastoCache[];
  ciclos: CicloCache[];
  produto: ProdutoCache | null;
  fazenda: FazendaCache | null;
  fazendaId: string;
  cicloAtivoId: string;
}

export async function activateRetiroReference(snapshot: RetiroReferenceSnapshot): Promise<void> {
  try {
    const db = await getDb();
    const stores = ['pastos', 'retiro', 'ciclos', 'produtoAtivo', 'fazendaCache', 'config'] as const;
    const tx = db.transaction(stores, 'readwrite');
    await tx.objectStore('pastos').clear();
    for (const row of snapshot.pastos) await tx.objectStore('pastos').put(row);
    await tx.objectStore('retiro').clear();
    await tx.objectStore('retiro').put(snapshot.retiro);
    await tx.objectStore('ciclos').clear();
    for (const row of snapshot.ciclos) await tx.objectStore('ciclos').put(row);
    await tx.objectStore('produtoAtivo').clear();
    if (snapshot.produto) await tx.objectStore('produtoAtivo').put(snapshot.produto);
    await tx.objectStore('fazendaCache').clear();
    if (snapshot.fazenda) await tx.objectStore('fazendaCache').put(snapshot.fazenda);
    await tx.objectStore('config').put({ key: 'capatazRetiroAtivoId', value: snapshot.retiro.id });
    await tx.objectStore('config').put({ key: 'fazendaId', value: snapshot.fazendaId });
    await tx.objectStore('config').put({ key: 'selectedCicloId', value: snapshot.cicloAtivoId });
    await tx.done;
  } catch (error) {
    console.error('[offlineDb] active retiro replacement aborted:', error);
    throw new OfflineWriteError();
  }
}
