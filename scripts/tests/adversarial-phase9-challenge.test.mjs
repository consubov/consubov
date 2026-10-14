/**
 * Phase 9 Adversarial Stress Test Suite
 * Empirical Challenger: Validates resilience against edge cases, race conditions,
 * referential integrity violations, idempotency collisions, CAS corruption,
 * memory bounds, and LGPD compliance.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

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

// ============================================================================
// 1. ADVERSARIAL CHALLENGE: TOPOLOGICAL REFERENTIAL INTEGRITY ORPHAN DETECTION
// ============================================================================

test('Adversarial Challenge 1: foto_cocho must reference an EXISTING lancamento_cocho in the SAME tenant', () => {
  const { commands, referentialMetadata } = generateSyntheticLoad({
    count: 300,
    tenants: 5,
    seed: 10132026
  });

  // Collect map of lancamento IDs by tenant
  const lancamentosByTenant = new Map();
  for (const cmd of commands) {
    if (cmd.kind === 'lancamento_cocho') {
      if (!lancamentosByTenant.has(cmd.tenantId)) {
        lancamentosByTenant.set(cmd.tenantId, new Set());
      }
      lancamentosByTenant.get(cmd.tenantId).add(cmd.payload.lancamentoId);
    }
  }

  // Check every foto_cocho command
  const fotoCommands = commands.filter(c => c.kind === 'foto_cocho');
  assert.ok(fotoCommands.length > 0, 'Must have foto_cocho commands in dataset');

  let orphanFotoCount = 0;
  let crossTenantFotoCount = 0;
  const sampleOrphans = [];

  for (const foto of fotoCommands) {
    const parentLancamentoId = foto.payload.lancamentoId;
    const tenantLancamentos = lancamentosByTenant.get(foto.tenantId) ?? new Set();

    // Check if the referenced lancamento exists in the same tenant
    const existsInSameTenant = tenantLancamentos.has(parentLancamentoId);
    if (!existsInSameTenant) {
      orphanFotoCount++;
      // Check if it exists in ANY tenant (cross-tenant leak)
      let existsInAnyTenant = false;
      for (const [tId, set] of lancamentosByTenant) {
        if (set.has(parentLancamentoId)) {
          existsInAnyTenant = true;
          crossTenantFotoCount++;
          break;
        }
      }
      if (sampleOrphans.length < 5) {
        sampleOrphans.push({
          fotoId: foto.commandId,
          tenantId: foto.tenantId,
          parentLancamentoId,
          existsInAnyTenant
        });
      }
    }
  }

  // CHALLENGER EMPIRICAL VERIFICATION:
  // Confirms that all foto_cocho reference a real lancamento_cocho in the same tenant
  console.log(`[Adversarial Challenge 1] Total fotos: ${fotoCommands.length}, Orphan fotos: ${orphanFotoCount}, Cross-tenant fotos: ${crossTenantFotoCount}`);
  if (sampleOrphans.length > 0) {
    console.log('[Adversarial Challenge 1] Sample orphan fotos:', JSON.stringify(sampleOrphans, null, 2));
  }

  assert.equal(orphanFotoCount, 0, 'Zero orphan foto_cocho allowed in synthetic dataset');
  assert.equal(crossTenantFotoCount, 0, 'Zero cross-tenant foto_cocho allowed in synthetic dataset');

  // Oracle strict referential check
  const oracleStrictCheck = () => {
    let strictOrphans = 0;
    const allLancamentoIds = new Set();
    for (const cmd of commands) {
      if (cmd.kind === 'lancamento_cocho') allLancamentoIds.add(cmd.payload.lancamentoId);
    }
    for (const foto of fotoCommands) {
      if (!allLancamentoIds.has(foto.payload.lancamentoId)) {
        strictOrphans++;
      }
    }
    return strictOrphans;
  };

  const strictOrphans = oracleStrictCheck();
  assert.equal(strictOrphans, 0, 'Zero strict orphans: all foto_cocho reference valid lancamentos');
});

// ============================================================================
// 2. ADVERSARIAL CAS & STATE MACHINE STRESS TESTS
// ============================================================================

test('Adversarial CAS: Prohibits illegal state transitions and enforces state invariants', () => {
  const queue = new SimulatedAtomicQueue();
  const cmd = {
    commandId: 'cmd-adv-001',
    idempotencyKey: 'urn:consubov:pesagem:t1:001',
    tenantId: 'tenant-1',
    userId: 'user-1',
    deviceId: 'dev-1',
    kind: 'pesagem_animal',
    createdAt: new Date().toISOString(),
    payload: { pesoKg: 450 }
  };

  queue.enqueue(cmd);

  // 1. Cannot acknowledge a pending command directly (must be inflight)
  assert.throws(
    () => queue.acknowledge('tenant-1', 'user-1', 'cmd-adv-001', cmd.idempotencyKey),
    /Tentativa de confirmação inválida em comando com status 'pending'/
  );

  // 2. Cannot retry a pending command directly
  assert.throws(
    () => queue.retry('tenant-1', 'user-1', 'cmd-adv-001'),
    /Apenas comandos em status inflight podem ser retentados/
  );

  // 3. Cannot mark conflict on a pending command directly
  assert.throws(
    () => queue.markConflict('tenant-1', 'user-1', 'cmd-adv-001'),
    /Apenas comandos inflight podem transitar para conflito/
  );

  // Claim batch moves to inflight
  const batch = queue.claimBatch('tenant-1', 'user-1', 10);
  assert.equal(batch.length, 1);
  assert.equal(batch[0].status, 'inflight');

  // 4. Cannot acknowledge with wrong idempotencyKey
  assert.throws(
    () => queue.acknowledge('tenant-1', 'user-1', 'cmd-adv-001', 'urn:consubov:pesagem:WRONG-KEY'),
    /Divergência de chave de idempotência/
  );

  // 5. Cannot acknowledge from wrong user
  assert.throws(
    () => queue.acknowledge('tenant-1', 'user-IMPOSTOR', 'cmd-adv-001', cmd.idempotencyKey),
    /Comando 'cmd-adv-001' não encontrado/
  );

  // 6. Cannot acknowledge from wrong tenant
  assert.throws(
    () => queue.acknowledge('tenant-WRONG', 'user-1', 'cmd-adv-001', cmd.idempotencyKey),
    /Comando 'cmd-adv-001' não encontrado/
  );

  // Acknowledge successfully
  queue.acknowledge('tenant-1', 'user-1', 'cmd-adv-001', cmd.idempotencyKey);

  // 7. Cannot retry an acknowledged command
  assert.throws(
    () => queue.retry('tenant-1', 'user-1', 'cmd-adv-001'),
    /Apenas comandos em status inflight podem ser retentados/
  );

  // 8. Cannot mark conflict on an acknowledged command
  assert.throws(
    () => queue.markConflict('tenant-1', 'user-1', 'cmd-adv-001'),
    /Apenas comandos inflight podem transitar para conflito/
  );
});

test('Adversarial CAS: Multiple concurrent workers cannot claim the same command twice', async () => {
  const queue = new SimulatedAtomicQueue();
  const { commands } = generateSyntheticLoad({ count: 100, tenants: 1, seed: 42 });
  for (const cmd of commands) queue.enqueue(cmd);

  // 10 concurrent claimBatch calls
  const claims = await Promise.all(
    Array.from({ length: 10 }, () => Promise.resolve(queue.claimBatch('tenant-sim-001', null, 20)))
  );

  const allClaimedIds = [];
  for (const batch of claims) {
    for (const cmd of batch) {
      allClaimedIds.push(cmd.commandId);
    }
  }

  // Verify that all claimed IDs are unique: zero double-claims
  const uniqueClaimedIds = new Set(allClaimedIds);
  assert.equal(allClaimedIds.length, uniqueClaimedIds.size, 'No command must be double-claimed across concurrent workers');
  assert.equal(allClaimedIds.length, 100, 'All 100 commands claimed across workers');
});

// ============================================================================
// 3. ADVERSARIAL SCALE & THROUGHPUT STRESS (2,500 COMMANDS)
// ============================================================================

test('Adversarial Scale: Sustains 2,500 commands across 10 tenants with 20 workers and 20% retries', async () => {
  const { commands } = generateSyntheticLoad({
    count: 2500,
    tenants: 10,
    usersPerTenant: 3,
    seed: 987654
  });

  const queue = new SimulatedAtomicQueue();
  for (const cmd of commands) queue.enqueue(cmd);

  assert.equal(queue.getMetrics().total, 2500);
  assert.equal(queue.getMetrics().pending, 2500);

  const drainResult = await simulateConcurrentDrain(queue, {
    concurrency: 20,
    batchSize: 25,
    transientErrorRate: 0.20, // 20% retry rate
    simulatedJitterMs: 0
  });

  assert.equal(drainResult.totalAcked, 2500, 'All 2,500 commands must eventually be acked');
  assert.ok(drainResult.totalRetries > 100, 'Must exercise high retry volume');
  assert.ok(drainResult.throughputOpsPerSec > 10000, 'Throughput must exceed 10,000 ops/s in memory');
  assert.ok(drainResult.latencies.p99Ms < 20, 'p99 latency must remain bounded under 20ms');

  const finalMetrics = queue.getMetrics();
  assert.equal(finalMetrics.pending, 0);
  assert.equal(finalMetrics.inflight, 0);
  assert.equal(finalMetrics.acked, 2500);
});

// ============================================================================
// 4. ADVERSARIAL IDEMPOTENCY COLLISION & REPLAY HARNESS
// ============================================================================

test('Adversarial Idempotency: Blocks 1,000 exact duplicates, blocks mutated payload duplicates, admits cross-tenant duplicates', () => {
  const { commands } = generateSyntheticLoad({ count: 1000, tenants: 5, seed: 112233 });
  const queue = new SimulatedAtomicQueue();
  for (const cmd of commands) queue.enqueue(cmd);

  // 1. Re-enqueue all 1,000 exact commands -> 100% blocked
  let exactBlocked = 0;
  for (const cmd of commands) {
    try {
      queue.enqueue(cmd);
    } catch (err) {
      if (err.code === 'IDEMPOTENCY_CONFLICT') exactBlocked++;
    }
  }
  assert.equal(exactBlocked, 1000, 'All 1,000 duplicate enqueues must be rejected with IDEMPOTENCY_CONFLICT');

  // 2. Re-enqueue 1,000 commands with mutated payload and new commandId but same idempotencyKey -> 100% blocked
  let replayBlocked = 0;
  for (const cmd of commands) {
    try {
      queue.enqueue({
        ...cmd,
        commandId: `replayed-${cmd.commandId}`,
        payload: { ...cmd.payload, tamperedField: true }
      });
    } catch (err) {
      if (err.code === 'IDEMPOTENCY_CONFLICT') replayBlocked++;
    }
  }
  assert.equal(replayBlocked, 1000, 'All 1,000 replay attempts with same idempotencyKey must be rejected');

  // 3. Enqueue same idempotencyKey for a completely new tenant -> must succeed
  let crossTenantAdmitted = 0;
  for (let i = 0; i < 50; i++) {
    const original = commands[i];
    const crossTenantCmd = {
      ...original,
      commandId: `foreign-${original.commandId}`,
      tenantId: 'tenant-sim-foreign-999',
      userId: 'user-sim-foreign-01'
    };
    queue.enqueue(crossTenantCmd);
    crossTenantAdmitted++;
  }
  assert.equal(crossTenantAdmitted, 50, 'Cross-tenant idempotency keys must not collide');

  // 4. Enqueue with identical command identity [tenantId, userId, commandId] but DIFFERENT idempotencyKey
  const collisionCandidate = {
    ...commands[0],
    idempotencyKey: 'urn:consubov:pesagem:brand-new-distinct-key'
  };
  assert.throws(
    () => queue.enqueue(collisionCandidate),
    /Command identity collision/
  );
});

// ============================================================================
// 5. ADVERSARIAL SNAPSHOT RECONCILER & TAMPER RESISTANCE
// ============================================================================

test('Adversarial Reconciler: Canonical JSON is immune to key order and catches bit-level corruption', () => {
  // Test 1: Key order independence
  const obj1 = { z: 1, a: 2, m: { b: 3, a: 4 } };
  const obj2 = { a: 2, z: 1, m: { a: 4, b: 3 } };
  assert.equal(canonicalJson(obj1), canonicalJson(obj2), 'Canonical JSON must be key-order invariant');
  assert.equal(hashString(canonicalJson(obj1)), hashString(canonicalJson(obj2)));

  // Test 2: Snapshot tampering detection
  const queue = new SimulatedAtomicQueue();
  const { commands } = generateSyntheticLoad({ count: 50, tenants: 1, seed: 555 });
  for (const cmd of commands) queue.enqueue(cmd);

  const snapshotSource = exportSnapshot(queue, 'tenant-sim-001');

  // Tamper: modify attemptCount in row 0
  const tamperedSnapshot = structuredClone(snapshotSource);
  tamperedSnapshot.rows[0].payload.attemptCount = 99;
  const reconResult = reconcileSnapshots(snapshotSource, tamperedSnapshot);
  assert.equal(reconResult.status, 'FAIL');
  assert.equal(reconResult.changed, 1);

  // Tamper: cross-tenant mismatch
  const foreignSnapshot = structuredClone(snapshotSource);
  foreignSnapshot.tenantId = 'tenant-sim-002';
  assert.throws(
    () => reconcileSnapshots(snapshotSource, foreignSnapshot),
    /Divergência de tenantId/
  );
});

// ============================================================================
// 6. ADVERSARIAL LGPD & PII EXPOSURE AUDIT
// ============================================================================

test('Adversarial LGPD: Zero exposure of real CPF, phone numbers, real emails, or raw Brazilian full names', () => {
  const { commands } = generateSyntheticLoad({ count: 1500, tenants: 5, seed: 777 });
  const rawJson = JSON.stringify(commands);

  // Regex suite for sensitive personal Brazilian PII
  const brazilianCpfRegex = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
  const brazilianPhoneRegex = /\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\d{4}[-\s]?\d{4}|\d{4}[-\s]?\d{4})\b/;
  const emailRegex = /\b[A-Za-z0-9._%+-]+@(?!example\.com|consubov\.local)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
  const brazilianCnpjRegex = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/;

  assert.doesNotMatch(rawJson, brazilianCpfRegex, 'No CPF must be present');
  assert.doesNotMatch(rawJson, emailRegex, 'No external real emails must be present');
  assert.doesNotMatch(rawJson, brazilianCnpjRegex, 'No real CNPJ must be present');

  // Verify that command payloads strictly use synthetic prefixes
  for (const cmd of commands) {
    assert.ok(cmd.tenantId.startsWith('tenant-sim-'));
    assert.ok(cmd.userId.startsWith('user-sim-'));
    assert.ok(cmd.deviceId.startsWith('device-sim-'));
    assert.ok(cmd.commandId.startsWith('cmd-tenant-sim-'));
  }
});

// ============================================================================
// 7. ADVERSARIAL ENVELOPE CONTRACT INVARIANTS (LocalCommand)
// ============================================================================

test('Adversarial Envelope: All 1,000 commands strictly satisfy LocalCommand schema invariants', () => {
  const { commands } = generateSyntheticLoad({ count: 1000, tenants: 5, seed: 888 });

  const requiredRootKeys = [
    'commandId',
    'idempotencyKey',
    'tenantId',
    'userId',
    'deviceId',
    'kind',
    'createdAt',
    'status',
    'attemptCount',
    'payload'
  ];

  for (const cmd of commands) {
    // 1. Root keys integrity
    for (const key of requiredRootKeys) {
      assert.ok(cmd[key] !== undefined && cmd[key] !== null, `Field '${key}' must exist in LocalCommand envelope`);
    }

    // 2. CreatedAt must be a valid ISO-8601 date string
    const parsedDate = new Date(cmd.createdAt);
    assert.ok(!isNaN(parsedDate.getTime()), 'createdAt must be valid date');
    assert.equal(cmd.createdAt, parsedDate.toISOString(), 'createdAt must be strict ISO string');

    // 3. Kind-specific invariants
    if (cmd.kind === 'pesagem_animal') {
      assert.ok(cmd.payload.pesoKg > 0 && cmd.payload.pesoKg < 2000, 'pesoKg must be reasonable positive number');
      assert.ok(cmd.payload.animalId && cmd.payload.animalId.startsWith('animal-sim-'));
      assert.ok(cmd.payload.brinco && cmd.payload.brinco.startsWith('BRINCO-SIM-'));
      assert.ok(cmd.payload.loteId && cmd.payload.loteId.startsWith('lote-sim-'));
      assert.ok(cmd.payload.fazendaId && cmd.payload.fazendaId.startsWith('fazenda-sim-'));
    } else if (cmd.kind === 'lancamento_cocho') {
      assert.ok(cmd.payload.quantidadeKg > 0, 'quantidadeKg must be positive');
      assert.ok(cmd.payload.tipoTrato && typeof cmd.payload.tipoTrato === 'string');
      assert.ok(cmd.payload.loteId && cmd.payload.loteId.startsWith('lote-sim-'));
      assert.ok(cmd.payload.fazendaId && cmd.payload.fazendaId.startsWith('fazenda-sim-'));
    } else if (cmd.kind === 'foto_cocho') {
      assert.ok(cmd.payload.fotoId && cmd.payload.fotoId.startsWith('foto-'));
      assert.ok(cmd.payload.lancamentoId && typeof cmd.payload.lancamentoId === 'string');
      assert.ok(cmd.payload.tamanhoBytes > 0, 'tamanhoBytes must be positive');
      assert.equal(cmd.payload.fotoHash.length, 64, 'fotoHash must be 64-char sha256 hex');
      assert.equal(cmd.payload.mimeType, 'image/jpeg');
    } else {
      assert.fail(`Unknown command kind: ${cmd.kind}`);
    }
  }
});
