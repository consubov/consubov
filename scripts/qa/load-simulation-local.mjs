#!/usr/bin/env node
/**
 * CONSUBOV FASE 9 — Carga Local Sintética & Reconciliação
 *
 * Gerador e executor de carga sintética multi-tenant para validação de
 * throughput, latência, transição de estados de fila atômica, integridade
 * de chaves de idempotência e reconciliação estrutural de dados anonimizados.
 *
 * Estritamente local e sem dependências remotas ou dados reais (LGPD compliant).
 */

import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const SNAPSHOT_FORMAT = 'consubov-load-snapshot-v1';
const HASH_ALGO = 'sha256';

export function hashString(value) {
  return createHash(HASH_ALGO).update(value).digest('hex');
}

/**
 * Serialização canônica determinística para objetos JSON (chaves ordenadas, sem getters, sem circularidade).
 */
export function canonicalJson(value, seen = new Set(), depth = 0) {
  if (depth > 32) throw new Error('Objeto excede a profundidade máxima permitida');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Número não-finito inválido para serialização canônica');
    return JSON.stringify(value);
  }
  if (typeof value !== 'object' || seen.has(value)) {
    throw new Error('Objeto cíclico ou tipo não-JSON detectado');
  }

  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) {
    throw new Error('Instâncias de classes não-literais são proibidas na fixture canônica');
  }

  seen.add(value);
  let result;
  if (Array.isArray(value)) {
    const parts = [];
    for (let i = 0; i < value.length; i++) {
      if (!Object.hasOwn(value, i)) throw new Error('Array esparso não suportado');
      parts.push(canonicalJson(value[i], seen, depth + 1));
    }
    result = '[' + parts.join(',') + ']';
  } else {
    const keys = Object.keys(value).sort();
    const parts = [];
    for (const k of keys) {
      parts.push(JSON.stringify(k) + ':' + canonicalJson(value[k], seen, depth + 1));
    }
    result = '{' + parts.join(',') + '}';
  }
  seen.delete(value);
  return result;
}

/**
 * Pseudo-random generator determinístico simples baseado em semente (LGC)
 * Garante reprodutibilidade absoluta dos dados sintéticos gerados.
 */
function createSeededRandom(seed = 42) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Gera comandos atômicos sintéticos multi-tenant no formato canônico LocalCommand.
 * Entidades suportadas: pesagem_animal, lancamento_cocho, foto_cocho.
 *
 * @param {Object} options
 * @param {number} options.count Total de comandos a gerar (>= 1000)
 * @param {number} options.tenants Quantidade de tenants isolados
 * @param {number} options.usersPerTenant Quantidade de usuários por tenant
 * @param {number} options.seed Semente para reprodutibilidade determinística
 * @returns {{ commands: Array<Object>, referentialMetadata: Object }}
 */
export function generateSyntheticLoad(options = {}) {
  const count = options.count ?? 1000;
  const numTenants = Math.max(1, options.tenants ?? 5);
  const usersPerTenant = Math.max(1, options.usersPerTenant ?? 2);
  const seed = options.seed ?? 10132026;
  const rand = createSeededRandom(seed);

  // Catálogo sintético de tenants, fazendas, lotes e animais para manter integridade referencial estrita
  const tenants = [];
  const farmsByTenant = new Map();
  const lotsByTenant = new Map();
  const animalsByLot = new Map();

  for (let t = 0; t < numTenants; t++) {
    const tenantId = `tenant-sim-${String(t + 1).padStart(3, '0')}`;
    tenants.push(tenantId);

    // Fazendas sintéticas por tenant
    const farms = [
      { id: `fazenda-sim-${t + 1}-01`, nome: `Fazenda Sintética Alvorada ${t + 1}`, tenantId },
      { id: `fazenda-sim-${t + 1}-02`, nome: `Fazenda Sintética Progresso ${t + 1}`, tenantId }
    ];
    farmsByTenant.set(tenantId, farms);

    // Lotes por fazenda
    const lots = [];
    for (let f = 0; f < farms.length; f++) {
      for (let l = 1; l <= 3; l++) {
        lots.push({
          id: `lote-sim-${t + 1}-${f + 1}-${String(l).padStart(2, '0')}`,
          fazendaId: farms[f].id,
          tenantId,
          nome: `Lote Confinamento ${l}`
        });
      }
    }
    lotsByTenant.set(tenantId, lots);

    // Animais por lote
    for (const lot of lots) {
      const animals = [];
      for (let a = 1; a <= 20; a++) {
        animals.push({
          id: `animal-sim-${lot.id}-${String(a).padStart(3, '0')}`,
          brinco: `BRINCO-SIM-${String(t * 1000 + a).padStart(6, '0')}`,
          loteId: lot.id,
          tenantId
        });
      }
      animalsByLot.set(lot.id, animals);
    }
  }

  const kinds = ['pesagem_animal', 'lancamento_cocho', 'foto_cocho'];
  const commands = [];
  const baseTime = Date.parse('2026-10-14T06:00:00.000Z');
  const lancamentosByTenant = new Map();
  const lastLancamentoByTenantLot = new Map();
  for (const t of tenants) lancamentosByTenant.set(t, []);

  for (let i = 0; i < count; i++) {
    const tenantIndex = i % numTenants;
    const tenantId = tenants[tenantIndex];
    const userIndex = Math.floor(rand() * usersPerTenant) + 1;
    const userId = `user-sim-${tenantId}-${String(userIndex).padStart(2, '0')}`;
    const deviceId = `device-sim-${tenantId}-tab-${(i % 3) + 1}`;

    const kindIndex = i % kinds.length;
    let kind = kinds[kindIndex];
    // Guarantee that tenant has at least one lancamento_cocho before generating foto_cocho
    if (kind === 'foto_cocho' && lancamentosByTenant.get(tenantId).length === 0) {
      kind = 'lancamento_cocho';
    }

    const sequenceId = String(i + 1).padStart(6, '0');
    const randHex = Math.floor(rand() * 0xffffffff).toString(16).padStart(8, '0');
    const commandId = `cmd-${tenantId}-${sequenceId}-${randHex}`;
    const idempotencyKey = `urn:consubov:${kind}:${tenantId}:${sequenceId}`;

    const timestampIso = new Date(baseTime + i * 1500).toISOString();
    const lots = lotsByTenant.get(tenantId);
    const lot = lots[Math.floor(rand() * lots.length)];
    const farmId = lot.fazendaId;

    let payload;
    if (kind === 'pesagem_animal') {
      const animals = animalsByLot.get(lot.id);
      const animal = animals[Math.floor(rand() * animals.length)];
      const pesoBaseKg = 380 + (rand() * 220); // 380kg a 600kg
      const gmd = 0.95 + (rand() * 0.85); // 0.95kg/dia a 1.80kg/dia
      payload = {
        pesagemId: `pesagem-${sequenceId}`,
        animalId: animal.id,
        brinco: animal.brinco,
        loteId: lot.id,
        fazendaId: farmId,
        pesoKg: Number(pesoBaseKg.toFixed(2)),
        dataPesagem: timestampIso,
        gmdProjetado: Number(gmd.toFixed(3)),
        scoreCorporal: Number((2.5 + rand() * 2).toFixed(1)),
        observacao: 'Pesagem de rotina em curral automatizado'
      };
    } else if (kind === 'lancamento_cocho') {
      const lancamentoId = `lancamento-${sequenceId}`;
      const tiposTrato = ['Racao_Adaptacao_T1', 'Racao_Crescimento_T2', 'Racao_Terminacao_T3', 'Suplemento_Mineral'];
      const tipoTrato = tiposTrato[Math.floor(rand() * tiposTrato.length)];
      const qtdKg = 120 + (rand() * 450);
      const notaCocho = Math.floor(rand() * 5); // 0 a 4
      payload = {
        lancamentoId,
        loteId: lot.id,
        pastoId: `pasto-sim-${lot.id}`,
        fazendaId: farmId,
        tipoTrato,
        quantidadeKg: Number(qtdKg.toFixed(2)),
        leituraCocho: notaCocho,
        dataLancamento: timestampIso,
        ajusteSugeridoKg: Number(((rand() - 0.5) * 40).toFixed(2))
      };
      const lancamentoRecord = {
        id: lancamentoId,
        loteId: lot.id,
        fazendaId: farmId
      };
      lancamentosByTenant.get(tenantId).push(lancamentoRecord);
      lastLancamentoByTenantLot.set(`${tenantId}:${lot.id}`, lancamentoRecord);
    } else { // foto_cocho
      const tenantLotKey = `${tenantId}:${lot.id}`;
      const parent = lastLancamentoByTenantLot.get(tenantLotKey) ?? (() => {
        const tenantLancamentos = lancamentosByTenant.get(tenantId);
        return tenantLancamentos[Math.floor(rand() * tenantLancamentos.length)];
      })();
      const parentLancamentoId = parent.id;
      const mockFileSize = Math.floor(18000 + rand() * 40000);
      const mockContent = `mock-photo-bytes-${sequenceId}-${timestampIso}`;
      const fotoHash = hashString(mockContent);
      payload = {
        fotoId: `foto-${sequenceId}`,
        lancamentoId: parentLancamentoId,
        loteId: parent.loteId,
        fazendaId: parent.fazendaId,
        arquivoNome: `cocho_${sequenceId}.jpg`,
        mimeType: 'image/jpeg',
        tamanhoBytes: mockFileSize,
        fotoHash,
        checksum: fotoHash.slice(0, 16),
        tiradaEm: timestampIso
      };
    }

    commands.push({
      commandId,
      idempotencyKey,
      tenantId,
      userId,
      deviceId,
      kind,
      createdAt: timestampIso,
      payload,
      status: 'pending',
      attemptCount: 0
    });
  }

  return {
    commands,
    referentialMetadata: {
      tenants,
      farmsByTenant,
      lotsByTenant,
      animalsByLot
    }
  };
}

/**
 * Fila atômica concorrente em memória com controle de CAS e integridade por tenant.
 * Simula a persistência e semântica de IndexedDbAtomicCommandQueue e atomic_command_log.
 */
export class SimulatedAtomicQueue {
  constructor() {
    /** @type {Map<string, Object>} Map chaveada por [tenantId, userId, commandId] */
    this.records = new Map();
    /** @type {Map<string, string>} Índice único de idempotência [tenantId, idempotencyKey] -> commandKey */
    this.idempotencyIndex = new Map();
    /** @type {Map<string, Array<Object>>} Histórico de auditoria de transições */
    this.auditLog = [];
  }

  _makeKey(tenantId, userId, commandId) {
    return JSON.stringify([tenantId, userId, commandId]);
  }

  _makeIdempotencyScope(tenantId, idempotencyKey) {
    return JSON.stringify([tenantId, idempotencyKey]);
  }

  /**
   * Enfileira um novo comando de forma atômica.
   * Lança erro se a chave de idempotência já existir para o mesmo tenant.
   */
  enqueue(command) {
    if (!command.tenantId || !command.userId || !command.commandId || !command.idempotencyKey) {
      throw new TypeError('Campos obrigatórios de identificação ausentes no comando');
    }

    const idempScope = this._makeIdempotencyScope(command.tenantId, command.idempotencyKey);
    if (this.idempotencyIndex.has(idempScope)) {
      const existingKey = this.idempotencyIndex.get(idempScope);
      const existingCmd = this.records.get(existingKey);
      const err = new Error(`Idempotency conflict: chave '${command.idempotencyKey}' já cadastrada para o tenant '${command.tenantId}'`);
      err.code = 'IDEMPOTENCY_CONFLICT';
      err.existingCommand = existingCmd;
      throw err;
    }

    const key = this._makeKey(command.tenantId, command.userId, command.commandId);
    if (this.records.has(key)) {
      throw new Error(`Command identity collision: comando '${command.commandId}' já existe`);
    }

    const stored = {
      ...command,
      status: 'pending',
      attemptCount: 0,
      enqueuedAt: new Date().toISOString()
    };

    this.records.set(key, stored);
    this.idempotencyIndex.set(idempScope, key);
    return stored;
  }

  /**
   * Reclama um lote de comandos pendentes de um tenant/usuário (CAS: pending -> inflight).
   */
  claimBatch(tenantId, userId, batchSize = 50) {
    const claimed = [];
    for (const [key, cmd] of this.records) {
      if (cmd.tenantId === tenantId && cmd.status === 'pending') {
        if (!userId || cmd.userId === userId) {
          // Transição atômica CAS
          cmd.status = 'inflight';
          cmd.attemptCount += 1;
          cmd.claimedAt = new Date().toISOString();
          claimed.push({ ...cmd });
          if (claimed.length >= batchSize) break;
        }
      }
    }
    return claimed;
  }

  /**
   * Confirma o processamento com sucesso de um comando (CAS: inflight -> acked).
   */
  acknowledge(tenantId, userId, commandId, idempotencyKey) {
    const key = this._makeKey(tenantId, userId, commandId);
    const cmd = this.records.get(key);
    if (!cmd) throw new Error(`Comando '${commandId}' não encontrado para confirmação`);
    if (cmd.tenantId !== tenantId || cmd.userId !== userId) {
      throw new Error('Violação de isolamento de tenant/user na confirmação');
    }
    if (cmd.idempotencyKey !== idempotencyKey) {
      throw new Error('Divergência de chave de idempotência na confirmação');
    }
    if (cmd.status !== 'inflight') {
      throw new Error(`Tentativa de confirmação inválida em comando com status '${cmd.status}'`);
    }

    cmd.status = 'acked';
    cmd.acknowledgedAt = new Date().toISOString();
    return { ...cmd };
  }

  /**
   * Reverte um comando inflight para pending (ex: falha temporária de rede / timeout de sincronização).
   */
  retry(tenantId, userId, commandId) {
    const key = this._makeKey(tenantId, userId, commandId);
    const cmd = this.records.get(key);
    if (!cmd) throw new Error(`Comando '${commandId}' não encontrado para retry`);
    if (cmd.status !== 'inflight') {
      throw new Error(`Apenas comandos em status inflight podem ser retentados (status atual: ${cmd.status})`);
    }

    cmd.status = 'pending';
    cmd.retriedAt = new Date().toISOString();
    return { ...cmd };
  }

  /**
   * Marca um comando inflight como em conflito (ex: 409 Conflict ou rejeição de negócio).
   */
  markConflict(tenantId, userId, commandId, reason = 'Conflict') {
    const key = this._makeKey(tenantId, userId, commandId);
    const cmd = this.records.get(key);
    if (!cmd) throw new Error(`Comando '${commandId}' não encontrado para marcação de conflito`);
    if (cmd.status !== 'inflight') {
      throw new Error(`Apenas comandos inflight podem transitar para conflito`);
    }

    cmd.status = 'conflict';
    cmd.conflictReason = reason;
    cmd.conflictedAt = new Date().toISOString();
    return { ...cmd };
  }

  /**
   * Retorna os comandos isolados de um tenant específico.
   */
  getCommandsByTenant(tenantId) {
    const list = [];
    for (const cmd of this.records.values()) {
      if (cmd.tenantId === tenantId) list.push({ ...cmd });
    }
    return list;
  }

  /**
   * Retorna contagens agregadas da fila.
   */
  getMetrics() {
    let pending = 0;
    let inflight = 0;
    let acked = 0;
    let conflict = 0;
    const byTenant = new Map();
    const byKind = new Map();

    for (const cmd of this.records.values()) {
      if (cmd.status === 'pending') pending++;
      else if (cmd.status === 'inflight') inflight++;
      else if (cmd.status === 'acked') acked++;
      else if (cmd.status === 'conflict') conflict++;

      byTenant.set(cmd.tenantId, (byTenant.get(cmd.tenantId) ?? 0) + 1);
      byKind.set(cmd.kind, (byKind.get(cmd.kind) ?? 0) + 1);
    }

    return {
      total: this.records.size,
      pending,
      inflight,
      acked,
      conflict,
      byTenant: Object.fromEntries(byTenant),
      byKind: Object.fromEntries(byKind)
    };
  }
}

/**
 * Processador de concorrência com pool assíncrono de workers para simulação de alta carga.
 *
 * @param {SimulatedAtomicQueue} queue Instância da fila
 * @param {Object} options Configurações de execução
 * @param {number} options.concurrency Número de workers concorrentes
 * @param {number} options.batchSize Tamanho de lote por worker
 * @param {number} options.transientErrorRate Taxa de falhas transitórias (0 a 1) simulando perda de ACK e retry
 * @param {number} options.simulatedJitterMs Latência máxima simulada por lote em ms
 */
export async function simulateConcurrentDrain(queue, options = {}) {
  const concurrency = Math.max(1, options.concurrency ?? 10);
  const batchSize = Math.max(1, options.batchSize ?? 50);
  const transientErrorRate = options.transientErrorRate ?? 0.05; // 5% de retries controlados
  const simulatedJitterMs = options.simulatedJitterMs ?? 0;

  const latenciesMs = [];
  const startMemory = process.memoryUsage();
  let peakHeapUsed = startMemory.heapUsed;
  const startTime = performance.now();

  // Coleta lista única de tenants presentes na fila
  const tenants = [...new Set([...queue.records.values()].map(c => c.tenantId))];

  let totalProcessed = 0;
  let totalRetries = 0;
  let totalAcked = 0;

  async function worker(workerId) {
    while (true) {
      // Round-robin entre tenants para balanceamento e estresse multi-tenant
      const tenantId = tenants[workerId % tenants.length];
      const batchStartTime = performance.now();

      const batch = queue.claimBatch(tenantId, null, batchSize);
      if (batch.length === 0) {
        // Tenta outros tenants se o atual não tiver pendências
        let foundAny = false;
        for (const otherTenant of tenants) {
          const fallbackBatch = queue.claimBatch(otherTenant, null, batchSize);
          if (fallbackBatch.length > 0) {
            batch.push(...fallbackBatch);
            foundAny = true;
            break;
          }
        }
        if (!foundAny) break; // Todas as filas esvaziadas
      }

      if (simulatedJitterMs > 0) {
        const jitter = Math.random() * simulatedJitterMs;
        await new Promise(r => setTimeout(r, jitter));
      }

      for (const cmd of batch) {
        const cmdStartTime = performance.now();
        // Simulação de falha transitória (Lost ACK) apenas na 1ª tentativa se transientErrorRate ativo
        if (cmd.attemptCount === 1 && Math.random() < transientErrorRate) {
          queue.retry(cmd.tenantId, cmd.userId, cmd.commandId);
          totalRetries++;
        } else {
          queue.acknowledge(cmd.tenantId, cmd.userId, cmd.commandId, cmd.idempotencyKey);
          totalAcked++;
          const cmdDuration = performance.now() - cmdStartTime;
          latenciesMs.push(cmdDuration);
        }
        totalProcessed++;
      }

      const curHeap = process.memoryUsage().heapUsed;
      if (curHeap > peakHeapUsed) peakHeapUsed = curHeap;
    }
  }

  // Dispara workers em paralelo
  const workers = [];
  for (let w = 0; w < concurrency; w++) {
    workers.push(worker(w));
  }
  await Promise.all(workers);

  const durationMs = performance.now() - startTime;
  const endMemory = process.memoryUsage();

  latenciesMs.sort((a, b) => a - b);
  const p50 = latenciesMs.length ? latenciesMs[Math.floor(latenciesMs.length * 0.50)] : 0;
  const p95 = latenciesMs.length ? latenciesMs[Math.floor(latenciesMs.length * 0.95)] : 0;
  const p99 = latenciesMs.length ? latenciesMs[Math.floor(latenciesMs.length * 0.99)] : 0;
  const avgLatency = latenciesMs.length ? latenciesMs.reduce((a, b) => a + b, 0) / latenciesMs.length : 0;

  const durationSeconds = durationMs / 1000;
  const throughputOpsPerSec = durationSeconds > 0 ? (totalAcked / durationSeconds) : 0;

  return {
    durationMs: Number(durationMs.toFixed(2)),
    durationSeconds: Number(durationSeconds.toFixed(3)),
    throughputOpsPerSec: Number(throughputOpsPerSec.toFixed(2)),
    totalProcessed,
    totalAcked,
    totalRetries,
    latencies: {
      avgMs: Number(avgLatency.toFixed(3)),
      p50Ms: Number(p50.toFixed(3)),
      p95Ms: Number(p95.toFixed(3)),
      p99Ms: Number(p99.toFixed(3)),
      minMs: Number((latenciesMs[0] ?? 0).toFixed(3)),
      maxMs: Number((latenciesMs[latenciesMs.length - 1] ?? 0).toFixed(3))
    },
    memory: {
      startHeapMb: Number((startMemory.heapUsed / (1024 * 1024)).toFixed(2)),
      peakHeapMb: Number((peakHeapUsed / (1024 * 1024)).toFixed(2)),
      endHeapMb: Number((endMemory.heapUsed / (1024 * 1024)).toFixed(2)),
      heapDeltaMb: Number(((endMemory.heapUsed - startMemory.heapUsed) / (1024 * 1024)).toFixed(2))
    }
  };
}

/**
 * Verifica integridade de idempotência:
 * - Nenhuma chave duplicada por tenant
 * - Reenvio de comandos já gravados é rejeitado com erro apropriado
 */
export function verifyIdempotencyIntegrity(queue, commands) {
  let duplicatesBlocked = 0;
  let falsePositives = 0;

  for (const cmd of commands) {
    try {
      queue.enqueue(cmd);
      falsePositives++;
    } catch (err) {
      if (err.code === 'IDEMPOTENCY_CONFLICT') {
        duplicatesBlocked++;
      } else {
        throw err;
      }
    }
  }

  return {
    status: falsePositives === 0 && duplicatesBlocked === commands.length ? 'PASS' : 'FAIL',
    totalTested: commands.length,
    duplicatesBlocked,
    falsePositives
  };
}

/**
 * Exporta um snapshot canônico estruturado dos registros acumulados pós-carga.
 */
export function exportSnapshot(queue, tenantId) {
  const commands = queue.getCommandsByTenant(tenantId);
  const rows = [];

  for (const cmd of commands) {
    const rowPayload = {
      kind: cmd.kind,
      status: cmd.status,
      attemptCount: cmd.attemptCount,
      payload: cmd.payload
    };

    rows.push({
      tenantId: cmd.tenantId,
      entity: cmd.kind,
      id: cmd.commandId,
      payload: rowPayload
    });
  }

  // Ordenação lexicográfica de rows para garantia de determinismo
  rows.sort((a, b) => {
    if (a.entity !== b.entity) return a.entity.localeCompare(b.entity);
    return a.id.localeCompare(b.id);
  });

  const rowDigests = rows.map(r => hashString(canonicalJson(r)));
  const overallDigest = hashString(canonicalJson(rowDigests));

  return {
    format: SNAPSHOT_FORMAT,
    fixture: true,
    tenantId,
    rowCount: rows.length,
    digest: overallDigest,
    rows
  };
}

/**
 * Reconcilia dois snapshots estruturais e emite relatório sanitizado (LGPD compliance: sem expor dados reais).
 */
export function reconcileSnapshots(source, target) {
  if (!source || !target) throw new Error('Snapshots de origem e destino são obrigatórios');
  if (source.format !== SNAPSHOT_FORMAT || target.format !== SNAPSHOT_FORMAT) {
    throw new Error(`Formato de snapshot inválido (esperado: ${SNAPSHOT_FORMAT})`);
  }
  if (source.tenantId !== target.tenantId) {
    throw new Error('Divergência de tenantId entre snapshots de reconciliação');
  }

  const sourceMap = new Map();
  for (const row of source.rows) {
    const key = `${row.entity}::${row.id}`;
    sourceMap.set(key, hashString(canonicalJson(row.payload)));
  }

  const targetMap = new Map();
  for (const row of target.rows) {
    const key = `${row.entity}::${row.id}`;
    targetMap.set(key, hashString(canonicalJson(row.payload)));
  }

  let missing = 0;
  let unexpected = 0;
  let changed = 0;

  for (const [key, digest] of sourceMap) {
    if (!targetMap.has(key)) {
      missing++;
    } else if (targetMap.get(key) !== digest) {
      changed++;
    }
  }

  for (const key of targetMap.keys()) {
    if (!sourceMap.has(key)) {
      unexpected++;
    }
  }

  const isPass = missing === 0 && unexpected === 0 && changed === 0 && source.digest === target.digest;

  return {
    kind: 'load-reconciliation-report',
    fixture: true,
    productionReady: false,
    status: isPass ? 'PASS' : 'FAIL',
    sourceCount: source.rowCount,
    targetCount: target.rowCount,
    missing,
    unexpected,
    changed,
    sourceDigest: source.digest,
    targetDigest: target.digest
  };
}

/**
 * Validação de integridade referencial: garante que nenhuma entidade filha seja órfã.
 */
export function validateReferentialIntegrity(commands, referentialMetadata) {
  let orphanCount = 0;
  const violations = [];

  const validLots = new Set();
  const validAnimals = new Set();
  const validLancamentos = new Set();

  for (const lotList of referentialMetadata.lotsByTenant.values()) {
    for (const lot of lotList) validLots.add(lot.id);
  }
  for (const animalList of referentialMetadata.animalsByLot.values()) {
    for (const animal of animalList) validAnimals.add(animal.id);
  }

  // Primeiro índice de lançamentos gerados
  const lancamentosMap = new Map();
  for (const cmd of commands) {
    if (cmd.kind === 'lancamento_cocho') {
      validLancamentos.add(cmd.payload.lancamentoId);
      lancamentosMap.set(cmd.payload.lancamentoId, {
        tenantId: cmd.tenantId,
        loteId: cmd.payload.loteId,
        fazendaId: cmd.payload.fazendaId
      });
    }
  }

  for (const cmd of commands) {
    if (cmd.kind === 'pesagem_animal') {
      if (!validLots.has(cmd.payload.loteId)) {
        orphanCount++;
        violations.push(`Pesagem ${cmd.commandId} referencia lote inexistente`);
      }
      if (!validAnimals.has(cmd.payload.animalId)) {
        orphanCount++;
        violations.push(`Pesagem ${cmd.commandId} referencia animal inexistente`);
      }
    } else if (cmd.kind === 'lancamento_cocho') {
      if (!validLots.has(cmd.payload.loteId)) {
        orphanCount++;
        violations.push(`Lançamento ${cmd.commandId} referencia lote inexistente`);
      }
    } else if (cmd.kind === 'foto_cocho') {
      if (!validLots.has(cmd.payload.loteId)) {
        orphanCount++;
        violations.push(`Foto ${cmd.commandId} referencia lote inexistente`);
      }
      if (!validLancamentos.has(cmd.payload.lancamentoId)) {
        orphanCount++;
        violations.push(`Foto ${cmd.commandId} referencia lancamento inexistente: ${cmd.payload.lancamentoId}`);
      } else {
        const parent = lancamentosMap.get(cmd.payload.lancamentoId);
        if (parent.tenantId !== cmd.tenantId) {
          orphanCount++;
          violations.push(`Foto ${cmd.commandId} referencia lancamento de outro tenant`);
        } else if (parent.loteId !== cmd.payload.loteId) {
          orphanCount++;
          violations.push(`Foto ${cmd.commandId} referencia lancamento de outro lote`);
        }
      }
    }
  }

  return {
    status: orphanCount === 0 ? 'PASS' : 'FAIL',
    checkedRecords: commands.length,
    orphanCount,
    violations: violations.slice(0, 5) // Sanitizado: apenas primeiros 5 erros sem payload
  };
}

/**
 * Pipeline completo de ensaio de carga, concorrência e reconciliação.
 */
export async function runLoadSimulation(options = {}) {
  const count = options.count ?? 1000;
  const tenants = options.tenants ?? 5;
  const concurrency = options.concurrency ?? 10;
  const batchSize = options.batchSize ?? 50;

  // 1. Geração de carga sintética
  const { commands, referentialMetadata } = generateSyntheticLoad({
    count,
    tenants,
    usersPerTenant: 2,
    seed: options.seed ?? 10132026
  });

  // 2. Enfileiramento na Fila Atômica
  const queue = new SimulatedAtomicQueue();
  for (const cmd of commands) {
    queue.enqueue(cmd);
  }

  // 3. Verificação de Integridade Referencial inicial
  const referentialReport = validateReferentialIntegrity(commands, referentialMetadata);

  // 4. Execução Concorrente de Drenagem
  const drainReport = await simulateConcurrentDrain(queue, {
    concurrency,
    batchSize,
    transientErrorRate: 0.05, // 5% de retries controlados
    simulatedJitterMs: 0
  });

  // 5. Teste de Integridade de Idempotência
  const idempotencyReport = verifyIdempotencyIntegrity(queue, commands);

  // 6. Reconciliação Estrutural de Snapshots
  const primaryTenant = referentialMetadata.tenants[0];
  const sourceSnapshot = exportSnapshot(queue, primaryTenant);
  // Simula snapshot alvo íntegro (cópia estrutural restaurada)
  const targetSnapshot = JSON.parse(canonicalJson(sourceSnapshot));
  const reconciliationReport = reconcileSnapshots(sourceSnapshot, targetSnapshot);

  const finalStatus =
    drainReport.totalAcked > 0 &&
    queue.getMetrics().pending === 0 &&
    queue.getMetrics().inflight === 0 &&
    idempotencyReport.status === 'PASS' &&
    referentialReport.status === 'PASS' &&
    reconciliationReport.status === 'PASS'
      ? 'PASS'
      : 'FAIL';

  return {
    executionKind: 'consubov-phase9-load-simulation',
    productionReady: false,
    status: finalStatus,
    configuration: {
      commandCount: count,
      tenantCount: tenants,
      workerConcurrency: concurrency,
      batchSize
    },
    drain: drainReport,
    idempotency: idempotencyReport,
    referentialIntegrity: referentialReport,
    reconciliation: reconciliationReport,
    queueFinalState: queue.getMetrics()
  };
}

// Execução CLI se invocado diretamente
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    let count = 1000;
    let tenants = 5;
    let concurrency = 10;
    let batchSize = 50;

    for (const arg of args) {
      if (arg.startsWith('--count=')) count = parseInt(arg.split('=')[1], 10);
      else if (arg.startsWith('--tenants=')) tenants = parseInt(arg.split('=')[1], 10);
      else if (arg.startsWith('--concurrency=')) concurrency = parseInt(arg.split('=')[1], 10);
      else if (arg.startsWith('--batch=')) batchSize = parseInt(arg.split('=')[1], 10);
    }

    const report = await runLoadSimulation({ count, tenants, concurrency, batchSize });
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.status === 'PASS' ? 0 : 1;
  } catch (error) {
    console.error('[load-simulation] Erro crítico na execução da simulação de carga:', error.message);
    process.exitCode = 2;
  }
}
