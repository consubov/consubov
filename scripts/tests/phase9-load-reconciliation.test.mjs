/**
 * Phase 9 — Carga Local Sintética & Reconciliação Automatizada
 *
 * Suíte de testes automatizada para validação da FASE 9:
 * 1. Geração de carga sintética multi-tenant (1.000+ comandos atômicos)
 * 2. Transições de estados de fila atômica e CAS (pending -> inflight -> acked/retry/conflict)
 * 3. Isolamento multi-tenant estrito e proteção contra colisão de chaves de idempotência
 * 4. Estresse de concorrência com pool de workers assíncronos e validação de throughput
 * 5. Processamento em lotes (batching) e estabilidade de consumo de memória
 * 6. Simulação de resiliência e recuperação pós-falha transitória (retries)
 * 7. Validação de integridade referencial relacional entre entidades
 * 8. Reconciliação estrutural de snapshots anonimizados (prova de zero perda)
 * 9. Conformidade LGPD e ausência estrita de PII em dados sintéticos e relatórios
 * 10. Execução hermética da CLI com saída JSON sanitizada
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SNAPSHOT_FORMAT,
  hashString,
  canonicalJson,
  generateSyntheticLoad,
  SimulatedAtomicQueue,
  simulateConcurrentDrain,
  verifyIdempotencyIntegrity,
  exportSnapshot,
  reconcileSnapshots,
  validateReferentialIntegrity,
  runLoadSimulation
} from '../qa/load-simulation-local.mjs';

const scriptCliPath = fileURLToPath(new URL('../qa/load-simulation-local.mjs', import.meta.url));

test('generateSyntheticLoad generates 1000+ atomic commands adhering to LocalCommand contract', () => {
  const { commands, referentialMetadata } = generateSyntheticLoad({
    count: 1200,
    tenants: 5,
    usersPerTenant: 3,
    seed: 12345
  });

  assert.equal(commands.length, 1200, 'Must generate exactly 1200 commands');
  assert.equal(referentialMetadata.tenants.length, 5, 'Must create 5 tenants');

  const kinds = new Set(commands.map(c => c.kind));
  assert.ok(kinds.has('pesagem_animal'), 'Must include pesagem_animal commands');
  assert.ok(kinds.has('lancamento_cocho'), 'Must include lancamento_cocho commands');
  assert.ok(kinds.has('foto_cocho'), 'Must include foto_cocho commands');

  for (const cmd of commands) {
    assert.ok(cmd.commandId && typeof cmd.commandId === 'string');
    assert.ok(cmd.idempotencyKey && cmd.idempotencyKey.startsWith('urn:consubov:'));
    assert.ok(cmd.tenantId && cmd.tenantId.startsWith('tenant-sim-'));
    assert.ok(cmd.userId && cmd.userId.startsWith('user-sim-'));
    assert.ok(cmd.deviceId && cmd.deviceId.startsWith('device-sim-'));
    assert.ok(cmd.createdAt && !isNaN(Date.parse(cmd.createdAt)));
    assert.equal(cmd.status, 'pending');
    assert.equal(cmd.attemptCount, 0);
    assert.ok(cmd.payload && typeof cmd.payload === 'object');
  }
});

test('generateSyntheticLoad is strictly deterministic given the same seed', () => {
  const run1 = generateSyntheticLoad({ count: 300, tenants: 3, seed: 999 });
  const run2 = generateSyntheticLoad({ count: 300, tenants: 3, seed: 999 });
  const run3 = generateSyntheticLoad({ count: 300, tenants: 3, seed: 888 });

  assert.equal(canonicalJson(run1.commands), canonicalJson(run2.commands));
  assert.notEqual(canonicalJson(run1.commands), canonicalJson(run3.commands));
});

test('SimulatedAtomicQueue enforces atomic CAS transitions and owner validation', () => {
  const queue = new SimulatedAtomicQueue();
  const cmd = {
    commandId: 'cmd-001',
    idempotencyKey: 'urn:consubov:pesagem_animal:tenant-01:000001',
    tenantId: 'tenant-01',
    userId: 'user-01',
    deviceId: 'device-01',
    kind: 'pesagem_animal',
    createdAt: new Date().toISOString(),
    payload: { pesoKg: 450.5 }
  };

  // Enqueue
  const stored = queue.enqueue(cmd);
  assert.equal(stored.status, 'pending');
  assert.equal(stored.attemptCount, 0);

  // Claim batch
  const batch = queue.claimBatch('tenant-01', 'user-01', 10);
  assert.equal(batch.length, 1);
  assert.equal(batch[0].status, 'inflight');
  assert.equal(batch[0].attemptCount, 1);

  // Claim again when already inflight returns empty
  const emptyBatch = queue.claimBatch('tenant-01', 'user-01', 10);
  assert.equal(emptyBatch.length, 0);

  // Retry returns command to pending
  queue.retry('tenant-01', 'user-01', 'cmd-001');
  const retriedCmd = queue.records.get(JSON.stringify(['tenant-01', 'user-01', 'cmd-001']));
  assert.equal(retriedCmd.status, 'pending');
  assert.equal(retriedCmd.attemptCount, 1);

  // Re-claim and acknowledge
  const reClaimed = queue.claimBatch('tenant-01', 'user-01', 10);
  assert.equal(reClaimed.length, 1);
  assert.equal(reClaimed[0].attemptCount, 2);

  const acked = queue.acknowledge('tenant-01', 'user-01', 'cmd-001', cmd.idempotencyKey);
  assert.equal(acked.status, 'acked');

  // Acknowledging already acked command throws
  assert.throws(
    () => queue.acknowledge('tenant-01', 'user-01', 'cmd-001', cmd.idempotencyKey),
    /Tentativa de confirmação inválida em comando com status 'acked'/
  );
});

test('SimulatedAtomicQueue guarantees strict multi-tenant isolation', () => {
  const queue = new SimulatedAtomicQueue();

  queue.enqueue({
    commandId: 'cmd-t1',
    idempotencyKey: 'urn:consubov:pesagem_animal:t1:001',
    tenantId: 'tenant-alpha',
    userId: 'user-alpha',
    deviceId: 'dev-1',
    kind: 'pesagem_animal',
    createdAt: new Date().toISOString(),
    payload: { pesoKg: 400 }
  });

  queue.enqueue({
    commandId: 'cmd-t2',
    idempotencyKey: 'urn:consubov:pesagem_animal:t2:001',
    tenantId: 'tenant-beta',
    userId: 'user-beta',
    deviceId: 'dev-2',
    kind: 'pesagem_animal',
    createdAt: new Date().toISOString(),
    payload: { pesoKg: 420 }
  });

  // Tenant Alpha claim only retrieves Tenant Alpha commands
  const claimedAlpha = queue.claimBatch('tenant-alpha', 'user-alpha', 10);
  assert.equal(claimedAlpha.length, 1);
  assert.equal(claimedAlpha[0].tenantId, 'tenant-alpha');

  // Tenant Beta commands remain unaffected and untouched
  const claimedBeta = queue.claimBatch('tenant-beta', 'user-beta', 10);
  assert.equal(claimedBeta.length, 1);
  assert.equal(claimedBeta[0].tenantId, 'tenant-beta');

  // Cross-tenant ACK is strictly rejected
  assert.throws(
    () => queue.acknowledge('tenant-beta', 'user-beta', 'cmd-t1', 'urn:consubov:pesagem_animal:t1:001'),
    /Comando 'cmd-t1' não encontrado/
  );
});

test('Idempotency keys are unique within tenant and cross-tenant duplicate keys are isolated', () => {
  const queue = new SimulatedAtomicQueue();
  const baseCmd = {
    commandId: 'cmd-1',
    idempotencyKey: 'urn:consubov:pesagem:fixed-key',
    tenantId: 'tenant-1',
    userId: 'user-1',
    deviceId: 'dev-1',
    kind: 'pesagem_animal',
    createdAt: new Date().toISOString(),
    payload: { pesoKg: 500 }
  };

  queue.enqueue(baseCmd);

  // Duplicate within same tenant throws IDEMPOTENCY_CONFLICT
  assert.throws(
    () => queue.enqueue({ ...baseCmd, commandId: 'cmd-2' }),
    /Idempotency conflict/
  );

  // Same idempotency key for DIFFERENT tenant is accepted without conflict
  const crossTenantCmd = {
    ...baseCmd,
    commandId: 'cmd-diff-tenant',
    tenantId: 'tenant-2',
    userId: 'user-2'
  };
  assert.doesNotThrow(() => queue.enqueue(crossTenantCmd));
});

test('Concurrent drain handles 1000+ commands under multi-tenant load with verifiable throughput', async () => {
  const { commands } = generateSyntheticLoad({ count: 1000, tenants: 5, usersPerTenant: 2 });
  const queue = new SimulatedAtomicQueue();
  for (const cmd of commands) queue.enqueue(cmd);

  assert.equal(queue.getMetrics().total, 1000);
  assert.equal(queue.getMetrics().pending, 1000);

  const drainResult = await simulateConcurrentDrain(queue, {
    concurrency: 10,
    batchSize: 50,
    transientErrorRate: 0.05
  });

  assert.equal(drainResult.totalAcked, 1000, 'All 1000 commands must eventually be acked');
  assert.ok(drainResult.totalRetries > 0, 'Transient error simulation must exercise retries');
  assert.ok(drainResult.throughputOpsPerSec > 1000, 'Local in-memory throughput must exceed 1000 ops/s');
  assert.ok(drainResult.latencies.p95Ms < 10, 'p95 latency must be sub-10ms for in-memory queue');

  const finalMetrics = queue.getMetrics();
  assert.equal(finalMetrics.pending, 0);
  assert.equal(finalMetrics.inflight, 0);
  assert.equal(finalMetrics.acked, 1000);
  assert.equal(finalMetrics.conflict, 0);
});

test('Batch processing maintains bounded memory consumption without leaks', async () => {
  const { commands } = generateSyntheticLoad({ count: 1500, tenants: 4, usersPerTenant: 2 });
  const queue = new SimulatedAtomicQueue();
  for (const cmd of commands) queue.enqueue(cmd);

  const resultSmallBatch = await simulateConcurrentDrain(queue, {
    concurrency: 5,
    batchSize: 25,
    transientErrorRate: 0
  });

  assert.equal(resultSmallBatch.totalAcked, 1500);
  // Memory growth must be bounded (heap delta < 50MB for 1500 commands)
  assert.ok(
    resultSmallBatch.memory.heapDeltaMb < 50,
    `Memory delta ${resultSmallBatch.memory.heapDeltaMb}MB exceeds safety budget of 50MB`
  );
});

test('validateReferentialIntegrity verifies relationships and flags orphan records', () => {
  const { commands, referentialMetadata } = generateSyntheticLoad({ count: 200, tenants: 2 });

  // Valid dataset passes
  const validReport = validateReferentialIntegrity(commands, referentialMetadata);
  assert.equal(validReport.status, 'PASS');
  assert.equal(validReport.orphanCount, 0);

  // Corrupted dataset with orphan loteId
  const corrupted = structuredClone(commands);
  corrupted[0].payload.loteId = 'lote-inexistente-fantasma';
  const invalidReport = validateReferentialIntegrity(corrupted, referentialMetadata);
  assert.equal(invalidReport.status, 'FAIL');
  assert.equal(invalidReport.orphanCount, 1);

  // Corrupted dataset with orphan lancamentoId in foto_cocho
  const corruptedFoto = structuredClone(commands);
  const firstFoto = corruptedFoto.find(c => c.kind === 'foto_cocho');
  assert.ok(firstFoto, 'Must find at least one foto_cocho command');
  firstFoto.payload.lancamentoId = 'lancamento-fantasma-inexistente';
  const invalidFotoReport = validateReferentialIntegrity(corruptedFoto, referentialMetadata);
  assert.equal(invalidFotoReport.status, 'FAIL');
  assert.equal(invalidFotoReport.orphanCount, 1);
});

test('reconcileSnapshots proves zero record loss on intact data and flags divergences', () => {
  const { commands } = generateSyntheticLoad({ count: 100, tenants: 1 });
  const queue = new SimulatedAtomicQueue();
  for (const cmd of commands) queue.enqueue(cmd);

  const sourceSnapshot = exportSnapshot(queue, 'tenant-sim-001');
  const targetSnapshot = JSON.parse(canonicalJson(sourceSnapshot));

  // 1. Identical snapshots pass
  const passReport = reconcileSnapshots(sourceSnapshot, targetSnapshot);
  assert.equal(passReport.status, 'PASS');
  assert.equal(passReport.missing, 0);
  assert.equal(passReport.unexpected, 0);
  assert.equal(passReport.changed, 0);
  assert.equal(passReport.sourceDigest, passReport.targetDigest);

  // 2. Modified payload is caught
  const changedTarget = structuredClone(targetSnapshot);
  changedTarget.rows[0].payload.payload.pesoKg = 999.9;
  const changedReport = reconcileSnapshots(sourceSnapshot, changedTarget);
  assert.equal(changedReport.status, 'FAIL');
  assert.equal(changedReport.changed, 1);

  // 3. Missing record is caught
  const missingTarget = structuredClone(targetSnapshot);
  missingTarget.rows.pop();
  missingTarget.rowCount--;
  const missingReport = reconcileSnapshots(sourceSnapshot, missingTarget);
  assert.equal(missingReport.status, 'FAIL');
  assert.equal(missingReport.missing, 1);

  // 4. Unexpected record is caught
  const unexpectedTarget = structuredClone(targetSnapshot);
  unexpectedTarget.rows.push({
    tenantId: 'tenant-sim-001',
    entity: 'pesagem_animal',
    id: 'cmd-extra-unplanned',
    payload: { sample: 123 }
  });
  unexpectedTarget.rowCount++;
  const unexpectedReport = reconcileSnapshots(sourceSnapshot, unexpectedTarget);
  assert.equal(unexpectedReport.status, 'FAIL');
  assert.equal(unexpectedReport.unexpected, 1);
});

test('LGPD compliance: synthetic data and reports contain zero personally identifiable information (PII)', () => {
  const { commands } = generateSyntheticLoad({ count: 500, tenants: 3 });
  const serialized = JSON.stringify(commands);

  // Proibição estrita de dados reais / PII
  const piiPatterns = [
    /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/, // CPF
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, // E-mail real
    /\bJoão\b|\bMaria\b|\bSilva\b|\bSantos\b|\bOliveira\b/i // Nomes comuns não anonimizados
  ];

  for (const pattern of piiPatterns) {
    assert.doesNotMatch(serialized, pattern, `PII pattern ${pattern} detected in synthetic data`);
  }

  // Verifica relatório de reconciliação
  const queue = new SimulatedAtomicQueue();
  for (const cmd of commands.slice(0, 10)) queue.enqueue(cmd);
  const snapA = exportSnapshot(queue, 'tenant-sim-001');
  const snapB = JSON.parse(canonicalJson(snapA));
  const report = reconcileSnapshots(snapA, snapB);
  const reportStr = JSON.stringify(report);

  // Relatório não deve conter campos de payload operacional
  assert.equal(reportStr.includes('pesoKg'), false);
  assert.equal(reportStr.includes('quantidadeKg'), false);
  assert.equal(reportStr.includes('fotoHash'), false);
});

test('runLoadSimulation executes the complete end-to-end pipeline with PASS result', async () => {
  const report = await runLoadSimulation({
    count: 1000,
    tenants: 5,
    concurrency: 10,
    batchSize: 50
  });

  assert.equal(report.status, 'PASS');
  assert.equal(report.executionKind, 'consubov-phase9-load-simulation');
  assert.equal(report.configuration.commandCount, 1000);
  assert.equal(report.drain.totalAcked, 1000);
  assert.equal(report.idempotency.status, 'PASS');
  assert.equal(report.referentialIntegrity.status, 'PASS');
  assert.equal(report.reconciliation.status, 'PASS');
  assert.equal(report.queueFinalState.pending, 0);
  assert.equal(report.queueFinalState.acked, 1000);
});

test('CLI runs hermetically via subprocess and outputs valid sanitized JSON', () => {
  const proc = spawnSync(
    process.execPath,
    [scriptCliPath, '--count=1000', '--tenants=5', '--concurrency=10', '--batch=50'],
    { encoding: 'utf8', timeout: 15000 }
  );

  assert.equal(proc.status, 0, `CLI failed with error: ${proc.stderr}`);
  const parsed = JSON.parse(proc.stdout);
  assert.equal(parsed.status, 'PASS');
  assert.equal(parsed.configuration.commandCount, 1000);
  assert.ok(parsed.drain.throughputOpsPerSec > 0);
  assert.equal(parsed.reconciliation.missing, 0);
});
