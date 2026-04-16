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
}

export interface SyncQueueItem {
  id: string;
  type: string;
  payload: any;
  createdAt: string;
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
}

let dbPromise: Promise<IDBPDatabase<ConsubovDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<ConsubovDB>('consubov-capataz', 5, {
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

// Fechar Mês (stored in config store)
export interface FecharMesPendente {
  tipo: 'fechar_mes';
  ciclo_id: string;
  data: string;
  status: 'pendente';
}

export async function saveFecharMes(action: FecharMesPendente) {
  const db = await getDb();
  await db.put('config', { key: 'fechar_mes_pendente', value: JSON.stringify(action) });
}

export async function getFecharMesPendente(): Promise<FecharMesPendente | null> {
  const db = await getDb();
  const item = await db.get('config', 'fechar_mes_pendente');
  if (!item?.value) return null;
  try {
    return JSON.parse(item.value) as FecharMesPendente;
  } catch {
    return null;
  }
}

export async function clearFecharMes() {
  const db = await getDb();
  await db.delete('config', 'fechar_mes_pendente');
}

// Produto Ativo
export async function cacheProdutoAtivo(produto: ProdutoCache) {
  const db = await getDb();
  const tx = db.transaction('produtoAtivo', 'readwrite');
  await tx.store.clear();
  await tx.store.put(produto);
  await tx.done;
}

export async function getCachedProdutoAtivo(): Promise<ProdutoCache | undefined> {
  const db = await getDb();
  const all = await db.getAll('produtoAtivo');
  return all[0];
}

// Fazenda Cache
export async function cacheFazenda(fazenda: FazendaCache) {
  const db = await getDb();
  const tx = db.transaction('fazendaCache', 'readwrite');
  await tx.store.clear();
  await tx.store.put(fazenda);
  await tx.done;
}

export async function getCachedFazenda(): Promise<FazendaCache | undefined> {
  const db = await getDb();
  const all = await db.getAll('fazendaCache');
  return all[0];
}

// Pesagens Pendentes (offline)
export async function savePesagemPendente(pesagem: PesagemPendente) {
  const db = await getDb();
  await db.put('pesagensPendentes', pesagem);
}

export async function getPesagensPendentes(): Promise<PesagemPendente[]> {
  const db = await getDb();
  const all = await db.getAll('pesagensPendentes');
  return all.filter(p => !p.sincronizado);
}

export async function countPesagensPendentes(): Promise<number> {
  const db = await getDb();
  const all = await db.getAll('pesagensPendentes');
  return all.filter(p => !p.sincronizado).length;
}

export async function markPesagemSincronizada(id: string) {
  const db = await getDb();
  const p = await db.get('pesagensPendentes', id);
  if (p) {
    p.sincronizado = true;
    await db.put('pesagensPendentes', p);
  }
}

export async function deletePesagemPendente(id: string) {
  const db = await getDb();
  await db.delete('pesagensPendentes', id);
}
