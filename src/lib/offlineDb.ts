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
}

export interface RetiroCache {
  id: string;
  nome: string;
  fazenda_nome: string;
}

export interface CicloCache {
  id: string;
  mes: number;
  ano: number;
  fechado: boolean;
  num_dias: number;
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
  config: {
    key: string;
    value: { key: string; value: string };
  };
  observacoesOffline: {
    key: string;
    value: ObservacaoOffline;
    indexes: { 'by-status': string };
  };
}

let dbPromise: Promise<IDBPDatabase<ConsubovDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<ConsubovDB>('consubov-capataz', 2, {
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
      },
    });
  }
  return dbPromise;
}

// Pastos
export async function cachePastos(pastos: PastoCache[]) {
  const db = await getDb();
  const tx = db.transaction('pastos', 'readwrite');
  await tx.store.clear();
  for (const p of pastos) await tx.store.put(p);
  await tx.done;
}

export async function getCachedPastos(): Promise<PastoCache[]> {
  const db = await getDb();
  return db.getAll('pastos');
}

export async function getPastoByQr(qrUuid: string): Promise<PastoCache | undefined> {
  const db = await getDb();
  return db.getFromIndex('pastos', 'by-qr', qrUuid);
}

// Retiro
export async function cacheRetiro(retiro: RetiroCache) {
  const db = await getDb();
  const tx = db.transaction('retiro', 'readwrite');
  await tx.store.clear();
  await tx.store.put(retiro);
  await tx.done;
}

export async function getCachedRetiro(): Promise<RetiroCache | undefined> {
  const db = await getDb();
  const all = await db.getAll('retiro');
  return all[0];
}

// Ciclos
export async function cacheCiclos(ciclos: CicloCache[]) {
  const db = await getDb();
  const tx = db.transaction('ciclos', 'readwrite');
  await tx.store.clear();
  for (const c of ciclos) await tx.store.put(c);
  await tx.done;
}

export async function getCachedCiclos(): Promise<CicloCache[]> {
  const db = await getDb();
  return db.getAll('ciclos');
}

// Lancamentos
export async function saveLancamento(lancamento: LancamentoOffline) {
  const db = await getDb();
  await db.put('lancamentos', lancamento);
}

export async function getLancamentosPendentes(): Promise<LancamentoOffline[]> {
  const db = await getDb();
  return db.getAllFromIndex('lancamentos', 'by-status', 'pendente');
}

export async function getLancamentosHoje(): Promise<LancamentoOffline[]> {
  const db = await getDb();
  const all = await db.getAll('lancamentos');
  const hoje = new Date().toISOString().slice(0, 10);
  return all.filter((l) => l.data.slice(0, 10) === hoje);
}

export async function getAllLancamentos(): Promise<LancamentoOffline[]> {
  const db = await getDb();
  return db.getAll('lancamentos');
}

export async function markSincronizado(id: string) {
  const db = await getDb();
  const l = await db.get('lancamentos', id);
  if (l) {
    l.status = 'sincronizado';
    await db.put('lancamentos', l);
  }
}

// Config
export async function setConfig(key: string, value: string) {
  const db = await getDb();
  await db.put('config', { key, value });
}

export async function getConfig(key: string): Promise<string | undefined> {
  const db = await getDb();
  const item = await db.get('config', key);
  return item?.value;
}

export async function deleteLancamento(id: string) {
  const db = await getDb();
  await db.delete('lancamentos', id);
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
export async function saveObservacaoOffline(obs: ObservacaoOffline) {
  const db = await getDb();
  await db.put('observacoesOffline', obs);
}

export async function getAllObservacoes(): Promise<ObservacaoOffline[]> {
  const db = await getDb();
  return db.getAll('observacoesOffline');
}

export async function getObservacoesPendentes(): Promise<ObservacaoOffline[]> {
  const db = await getDb();
  return db.getAllFromIndex('observacoesOffline', 'by-status', 'pendente');
}

export async function getObservacoesSincronizadas(): Promise<ObservacaoOffline[]> {
  const db = await getDb();
  return db.getAllFromIndex('observacoesOffline', 'by-status', 'sincronizado');
}

export async function markObservacaoSincronizada(id: string) {
  const db = await getDb();
  const obs = await db.get('observacoesOffline', id);
  if (obs) {
    obs.status = 'sincronizado';
    await db.put('observacoesOffline', obs);
  }
}

export async function deleteObservacaoOffline(id: string) {
  const db = await getDb();
  await db.delete('observacoesOffline', id);
}
