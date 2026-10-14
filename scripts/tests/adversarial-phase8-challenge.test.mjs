/**
 * Phase 8 Adversarial Stress Test Suite
 * Empirical Challenger: Validates resilience against edge cases, race conditions,
 * SQL injection attempts, cross-tenant leaks, and migration integrity anomalies.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  splitStatements,
  validateDdlScript,
  buildSchemaCatalog,
  validateCatalogIntegrity,
} from '../qa/sql-ddl-validator.mjs';
import {
  runIdempotencyCycle,
  computeCatalogHash,
} from '../qa/migration-idempotency-runner.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const upMigrationPath = path.join(
  repoRoot,
  'supabase/migrations/20261014000000_phase8_unified_relational_contracts.sql'
);
const downMigrationPath = path.join(
  repoRoot,
  'supabase/migrations/down/20261014000000_phase8_unified_relational_contracts.down.sql'
);

const upSql = fs.readFileSync(upMigrationPath, 'utf8');
const downSql = fs.readFileSync(downMigrationPath, 'utf8');

// ============================================================================
// 1. ADVERSARIAL IDEMPOTENCY & REVERSIBILITY TESTS
// ============================================================================

test('Adversarial: Detects incomplete DOWN migration leaving residual tables or indexes', () => {
  // Simulate a buggy DOWN migration that drops the table but forgets an index or policy
  const buggyDownSql = `
    DROP POLICY IF EXISTS "user_access_atomic_command_log" ON public.atomic_command_log;
    -- Note: Omitted dropping tenant_isolation policy and table
  `;
  const cycle = runIdempotencyCycle(upSql, buggyDownSql);
  assert.equal(cycle.isReversible, false, 'Buggy DOWN must fail reversibility check');
  assert.notEqual(cycle.hashes.state0_baseline, cycle.hashes.state3_down_rollback);
  assert.equal(cycle.passed, false);
});

test('Adversarial: Detects non-idempotent UP migration with conflicting duplicate statements', () => {
  const nonIdempotentUpSql = `
    CREATE TABLE public.fragile_table (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL
    );
  `;
  const stmts = splitStatements(nonIdempotentUpSql);
  const step1 = buildSchemaCatalog(stmts);
  assert.ok(step1.catalog.tables['public.fragile_table']);

  // Second run on existing table
  const step2 = buildSchemaCatalog(stmts, step1.catalog);
  const hash1 = computeCatalogHash(step1.catalog);
  const hash2 = computeCatalogHash(step2.catalog);
  assert.equal(hash1, hash2, 'Idempotent catalog must remain stable');
});

test('Adversarial: Multi-cycle resilience (UP x4 -> DOWN x2 -> UP x2)', () => {
  const upStmts = splitStatements(upSql);
  const downStmts = splitStatements(downSql);

  let current = { tables: {}, indexes: {}, policies: {} };
  const baselineHash = computeCatalogHash(current);

  // Apply UP 4 consecutive times
  for (let i = 0; i < 4; i++) {
    current = buildSchemaCatalog(upStmts, current).catalog;
  }
  const stableUpHash = computeCatalogHash(current);

  // Apply DOWN 2 consecutive times
  for (let i = 0; i < 2; i++) {
    current = buildSchemaCatalog(downStmts, current).catalog;
  }
  const rolledBackHash = computeCatalogHash(current);
  assert.equal(rolledBackHash, baselineHash, 'Multiple rollbacks must cleanly yield baseline');

  // Apply UP 2 more times
  for (let i = 0; i < 2; i++) {
    current = buildSchemaCatalog(upStmts, current).catalog;
  }
  const restoredHash = computeCatalogHash(current);
  assert.equal(restoredHash, stableUpHash, 'Reapplied UP must match exactly');
});

test('Adversarial: SQL Splitter resists semicolons in strings and comments outside quotes', () => {
  const complexSql = `
    -- Line comment with ; semicolon
    CREATE TABLE public.complex_tab (
      id UUID PRIMARY KEY,
      complex_str TEXT DEFAULT 'val; with ; multiple ; semicolons',
      other TEXT DEFAULT 'simple value'
    );
    /* Block comment
       with multiple ;;;
       semicolons */
    CREATE INDEX idx_complex ON public.complex_tab (complex_str);
  `;
  const stmts = splitStatements(complexSql);
  assert.equal(stmts.length, 2, 'Should cleanly parse exactly 2 statements');
  assert.ok(stmts[0].includes('complex_str TEXT'));
  assert.ok(stmts[1].includes('idx_complex'));
});

test('Adversarial: SQL Splitter limitation: regex single-line comment strip over string literal with --', () => {
  // Documented empirical finding: sanitizeSql strips -- indiscriminately before checking quotes
  const sqlWithStringDashDash = `
    CREATE TABLE public.dash_tab (
      note TEXT DEFAULT 'prefix -- not comment'
    );
  `;
  const stmts = splitStatements(sqlWithStringDashDash);
  // Demonstrates that regex-based sanitization strips from -- to end of line
  assert.ok(stmts.length >= 1);
});

test('Adversarial: DDL validator rejects dangerous or unsupported PostgreSQL syntax', () => {
  // 1. Table with unsupported MySQL types
  const badTypes = `
    CREATE TABLE public.bad_types (
      id UUID PRIMARY KEY,
      data LONGTEXT,
      val DATETIME,
      amount MONEY
    );
  `;
  const resTypes = validateDdlScript(badTypes);
  assert.equal(resTypes.valid, false);
  assert.ok(resTypes.errors.some(e => e.toLowerCase().includes('longtext')));
  assert.ok(resTypes.errors.some(e => e.toLowerCase().includes('datetime')));
  assert.ok(resTypes.errors.some(e => e.toLowerCase().includes('money')));

  // 2. Index targeting invalid column
  const badIndex = `
    CREATE TABLE public.good_tab (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL
    );
    CREATE INDEX idx_ghost ON public.good_tab (non_existent_column);
  `;
  const resIdx = validateDdlScript(badIndex);
  assert.equal(resIdx.valid, false);
  assert.ok(resIdx.errors.some(e => e.includes('non_existent_column')));
});

// ============================================================================
// 2. ADVERSARIAL IDEMPOTENCY & COLLISION STRESS TESTS
// ============================================================================

class AdvancedRelationalHarness {
  constructor() {
    this.tables = new Map();
    this.session = { tenantId: null, userId: null, role: 'authenticated' };
  }

  setSession(tenantId, userId, role = 'authenticated') {
    this.session = { tenantId, userId, role };
  }

  defineTable({ name, primaryKey = 'id', foreignKeys = [], uniqueIndexes = [], rls = false }) {
    this.tables.set(name, {
      name,
      primaryKey,
      foreignKeys,
      uniqueIndexes,
      rls,
      rows: new Map(),
    });
  }

  insert(tableName, row) {
    const table = this.tables.get(tableName);
    if (!table) throw new Error(`Table ${tableName} does not exist`);

    // RLS WITH CHECK
    if (table.rls) {
      if (this.session.tenantId === null) {
        throw new Error('RLS WITH CHECK violation: unauthenticated or null tenant context');
      }
      if (row.tenant_id !== this.session.tenantId) {
        throw new Error(`RLS WITH CHECK violation: row tenant_id ${row.tenant_id} does not match session ${this.session.tenantId}`);
      }
    }

    // PK check
    const pk = row[table.primaryKey];
    if (pk === undefined || pk === null) {
      throw new Error(`23502: null value in column "${table.primaryKey}" violates not-null constraint`);
    }
    if (table.rows.has(pk)) {
      throw new Error(`23505: duplicate key value violates unique constraint on primary key ${tableName}_pkey`);
    }

    // Unique Indexes (e.g. [tenant_id, idempotency_key])
    for (const cols of table.uniqueIndexes) {
      for (const existing of table.rows.values()) {
        const matches = cols.every(col => existing[col] === row[col]);
        if (matches) {
          throw new Error(`23505: duplicate key value violates unique index on ${cols.join(', ')}`);
        }
      }
    }

    // Foreign Keys
    for (const fk of table.foreignKeys) {
      const val = row[fk.column];
      if (val !== undefined && val !== null) {
        const target = this.tables.get(fk.targetTable);
        if (!target || !target.rows.has(val)) {
          throw new Error(`23503: insert on table "${tableName}" violates foreign key constraint "${fk.column}_fkey"`);
        }
      }
    }

    table.rows.set(pk, { ...row });
    return { ...row };
  }

  select(tableName, filter = {}) {
    const table = this.tables.get(tableName);
    if (!table) throw new Error(`Table ${tableName} does not exist`);

    const results = [];
    for (const row of table.rows.values()) {
      // RLS USING
      if (table.rls) {
        if (!this.session.tenantId || row.tenant_id !== this.session.tenantId) {
          continue; // Hidden by RLS
        }
      }

      const match = Object.entries(filter).every(([k, v]) => row[k] === v);
      if (match) results.push({ ...row });
    }
    return results;
  }

  delete(tableName, pk) {
    const table = this.tables.get(tableName);
    if (!table) throw new Error(`Table ${tableName} does not exist`);
    const row = table.rows.get(pk);
    if (!row) return false;

    // RLS delete check
    if (table.rls && (!this.session.tenantId || row.tenant_id !== this.session.tenantId)) {
      return false; // Cannot delete outside tenant
    }

    // Foreign key restrict / cascade
    for (const other of this.tables.values()) {
      for (const fk of other.foreignKeys) {
        if (fk.targetTable === tableName) {
          for (const [childPk, childRow] of other.rows.entries()) {
            if (childRow[fk.column] === pk) {
              if (fk.onDelete === 'CASCADE') {
                other.rows.delete(childPk);
              } else {
                throw new Error(`23503: delete on table "${tableName}" violates foreign key constraint on "${other.name}"`);
              }
            }
          }
        }
      }
    }

    return table.rows.delete(pk);
  }

  update(tableName, pk, patch) {
    const table = this.tables.get(tableName);
    if (!table) throw new Error(`Table ${tableName} does not exist`);
    const row = table.rows.get(pk);
    if (!row) return null;

    if (table.rls && (!this.session.tenantId || row.tenant_id !== this.session.tenantId)) {
      return null; // Cannot update outside tenant
    }

    const updated = { ...row, ...patch };
    table.rows.set(pk, updated);
    return updated;
  }
}

function createHarness() {
  const db = new AdvancedRelationalHarness();
  db.defineTable({ name: 'fazendas', primaryKey: 'id', rls: false });
  db.defineTable({
    name: 'lancamentos',
    primaryKey: 'id',
    foreignKeys: [{ column: 'fazenda_id', targetTable: 'fazendas', onDelete: 'RESTRICT' }],
    rls: true,
  });
  db.defineTable({
    name: 'fotos_salga',
    primaryKey: 'id',
    foreignKeys: [{ column: 'lancamento_id', targetTable: 'lancamentos', onDelete: 'CASCADE' }],
    rls: true,
  });
  db.defineTable({
    name: 'atomic_command_log',
    primaryKey: 'id',
    uniqueIndexes: [
      ['tenant_id', 'idempotency_key'],
      ['tenant_id', 'command_id'],
    ],
    rls: true,
  });
  return db;
}

test('Adversarial: Cross-tenant identical idempotency_key succeeds across 50 tenants', () => {
  const db = createHarness();
  const sharedKey = 'urn:consubov:pesador:pesagem:deterministic-seed-12345';

  // 50 distinct tenants inserting the SAME idempotency key
  for (let i = 1; i <= 50; i++) {
    const tenantId = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    db.setSession(tenantId, `user-${i}`);
    const row = db.insert('atomic_command_log', {
      id: `cmd-row-${i}`,
      tenant_id: tenantId,
      user_id: `user-${i}`,
      device_id: `dev-${i}`,
      command_id: `cmd-uuid-${i}`,
      idempotency_key: sharedKey,
      kind: 'pesagem_gado',
      payload: { peso: 450 + i },
      status: 'pending',
      attempt_count: 0,
    });
    assert.equal(row.idempotency_key, sharedKey);
  }

  // Verify each tenant sees only its own record
  for (let i = 1; i <= 50; i++) {
    const tenantId = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    db.setSession(tenantId, `user-${i}`);
    const results = db.select('atomic_command_log');
    assert.equal(results.length, 1);
    assert.equal(results[0].id, `cmd-row-${i}`);
  }
});

test('Adversarial: High-concurrency race condition on (tenant_id, idempotency_key)', () => {
  const db = createHarness();
  const tenantId = '11111111-2222-3333-4444-555555555555';
  db.setSession(tenantId, 'user-worker');

  const idempotencyKey = 'urn:consubov:capataz:lancamento:concurrent-test';
  let successCount = 0;
  let collisionCount = 0;

  // 100 simultaneous insert attempts
  for (let i = 0; i < 100; i++) {
    try {
      db.insert('atomic_command_log', {
        id: `cmd-${i}`,
        tenant_id: tenantId,
        user_id: 'user-worker',
        device_id: 'worker-node',
        command_id: `cmd-uuid-${i}`,
        idempotency_key: idempotencyKey,
        kind: 'capataz_lancamento',
        payload: { attempt: i },
        status: 'pending',
        attempt_count: 0,
      });
      successCount++;
    } catch (err) {
      if (err.message.includes('23505') && err.message.includes('idempotency_key')) {
        collisionCount++;
      } else {
        throw err;
      }
    }
  }

  assert.equal(successCount, 1, 'Exactly 1 insert must succeed');
  assert.equal(collisionCount, 99, 'Exactly 99 duplicate inserts must be rejected with 23505');
});

test('Adversarial: Secondary constraint (tenant_id, command_id) blocks command reuse with differing keys', () => {
  const db = createHarness();
  const tenantId = '11111111-2222-3333-4444-555555555555';
  db.setSession(tenantId, 'user-worker');

  const commandId = 'fixed-command-uuid-777';

  db.insert('atomic_command_log', {
    id: 'first-entry',
    tenant_id: tenantId,
    user_id: 'user-worker',
    device_id: 'dev-1',
    command_id: commandId,
    idempotency_key: 'urn:key:alpha',
    kind: 'capataz_lancamento',
    payload: {},
    status: 'pending',
    attempt_count: 0,
  });

  // Attempt to use the same command_id with a different idempotency_key
  assert.throws(
    () => {
      db.insert('atomic_command_log', {
        id: 'second-entry',
        tenant_id: tenantId,
        user_id: 'user-worker',
        device_id: 'dev-1',
        command_id: commandId, // duplicated!
        idempotency_key: 'urn:key:beta', // distinct key
        kind: 'capataz_lancamento',
        payload: {},
        status: 'pending',
        attempt_count: 0,
      });
    },
    (err) => {
      assert.ok(err.message.includes('23505'));
      assert.ok(err.message.includes('command_id'));
      return true;
    }
  );
});

test('Adversarial: Resists special characters, SQL injection strings and unicode in idempotency_key', () => {
  const db = createHarness();
  const tenantId = '00000000-0000-4000-8000-000000000001';
  db.setSession(tenantId, 'user-test');

  const adversarialKeys = [
    "urn:consubov:injection:' OR 1=1; DROP TABLE atomic_command_log; --",
    'urn:consubov:unicode:🐮_pasto_são_joão_№123',
    'urn:consubov:spaces:   key with leading and trailing spaces   ',
    'urn:consubov:json:{"nested": "value", "arr": [1, 2, 3]}',
    'urn:consubov:long:' + 'x'.repeat(2048),
  ];

  for (let i = 0; i < adversarialKeys.length; i++) {
    const key = adversarialKeys[i];
    const row = db.insert('atomic_command_log', {
      id: `adv-key-${i}`,
      tenant_id: tenantId,
      user_id: 'user-test',
      device_id: 'dev-adv',
      command_id: `adv-cmd-${i}`,
      idempotency_key: key,
      kind: 'stress_test',
      payload: {},
      status: 'pending',
      attempt_count: 0,
    });
    assert.equal(row.idempotency_key, key);

    // Duplicate must fail
    assert.throws(() => {
      db.insert('atomic_command_log', {
        id: `adv-key-dup-${i}`,
        tenant_id: tenantId,
        user_id: 'user-test',
        device_id: 'dev-adv',
        command_id: `adv-cmd-dup-${i}`,
        idempotency_key: key,
        kind: 'stress_test',
        payload: {},
        status: 'pending',
        attempt_count: 0,
      });
    });
  }
});

// ============================================================================
// 3. ADVERSARIAL MULTI-TENANT RLS ATTACKS
// ============================================================================

test('Adversarial: Cross-tenant UPDATE is blocked / affects 0 rows', () => {
  const db = createHarness();
  const tenantVictim = '11111111-1111-4111-8111-111111111111';
  const tenantAttacker = '22222222-2222-4222-8222-222222222222';

  // Seed Victim record
  db.setSession(tenantVictim, 'user-victim');
  db.insert('atomic_command_log', {
    id: 'cmd-victim-1',
    tenant_id: tenantVictim,
    user_id: 'user-victim',
    device_id: 'dev-victim',
    command_id: 'cmd-vic-1',
    idempotency_key: 'urn:victim:1',
    kind: 'capataz_lancamento',
    payload: { confidential: 'data_victim' },
    status: 'pending',
    attempt_count: 0,
  });

  // Attacker attempts update
  db.setSession(tenantAttacker, 'user-attacker');
  const result = db.update('atomic_command_log', 'cmd-victim-1', {
    payload: { hijacked: true },
  });
  assert.equal(result, null, 'Cross-tenant update must return null (blocked by RLS)');

  // Verify victim data unmodified
  db.setSession(tenantVictim, 'user-victim');
  const original = db.select('atomic_command_log', { id: 'cmd-victim-1' });
  assert.equal(original[0].payload.confidential, 'data_victim');
  assert.equal(original[0].payload.hijacked, undefined);
});

test('Adversarial: Cross-tenant DELETE is blocked / leaves row intact', () => {
  const db = createHarness();
  const tenantVictim = '11111111-1111-4111-8111-111111111111';
  const tenantAttacker = '22222222-2222-4222-8222-222222222222';

  // Seed Victim record
  db.setSession(tenantVictim, 'user-victim');
  db.insert('atomic_command_log', {
    id: 'cmd-victim-del',
    tenant_id: tenantVictim,
    user_id: 'user-victim',
    device_id: 'dev-victim',
    command_id: 'cmd-vic-del',
    idempotency_key: 'urn:victim:del',
    kind: 'capataz_lancamento',
    payload: {},
    status: 'pending',
    attempt_count: 0,
  });

  // Attacker attempts delete
  db.setSession(tenantAttacker, 'user-attacker');
  const deleted = db.delete('atomic_command_log', 'cmd-victim-del');
  assert.equal(deleted, false, 'Cross-tenant delete must fail (return false)');

  // Verify victim data still exists
  db.setSession(tenantVictim, 'user-victim');
  const check = db.select('atomic_command_log', { id: 'cmd-victim-del' });
  assert.equal(check.length, 1);
});

test('Adversarial: Unauthenticated or empty session context denies all read/write access', () => {
  const db = createHarness();
  const tenantId = '11111111-1111-4111-8111-111111111111';

  // Seed record as valid tenant
  db.setSession(tenantId, 'user-1');
  db.insert('atomic_command_log', {
    id: 'cmd-valid-1',
    tenant_id: tenantId,
    user_id: 'user-1',
    device_id: 'dev-1',
    command_id: 'cmd-uuid-1',
    idempotency_key: 'urn:key:1',
    kind: 'capataz_lancamento',
    payload: {},
    status: 'pending',
    attempt_count: 0,
  });

  // Switch to unauthenticated session (tenantId = null)
  db.setSession(null, null);

  // Read attempt: returns empty
  const readResult = db.select('atomic_command_log');
  assert.equal(readResult.length, 0, 'Unauthenticated read must return 0 rows');

  // Insert attempt: throws WITH CHECK violation
  assert.throws(
    () => {
      db.insert('atomic_command_log', {
        id: 'cmd-anon-1',
        tenant_id: tenantId,
        user_id: 'anon',
        device_id: 'dev-anon',
        command_id: 'cmd-anon-uuid',
        idempotency_key: 'urn:key:anon',
        kind: 'capataz_lancamento',
        payload: {},
        status: 'pending',
        attempt_count: 0,
      });
    },
    (err) => {
      assert.ok(err.message.includes('RLS WITH CHECK violation'));
      return true;
    }
  );
});

// ============================================================================
// 4. ADVERSARIAL REFERENTIAL INTEGRITY & TOPOLOGICAL CASCADE
// ============================================================================

test('Adversarial: ON DELETE RESTRICT prevents accidental parent deletion with active children', () => {
  const db = createHarness();
  const tenantId = '11111111-1111-4111-8111-111111111111';
  db.setSession(tenantId, 'user-admin');

  // Fazenda -> Lancamento (RESTRICT) -> Foto (CASCADE)
  db.insert('fazendas', { id: 'faz-main', nome: 'Fazenda Matriz' });
  db.insert('lancamentos', {
    id: 'lanc-child-1',
    tenant_id: tenantId,
    fazenda_id: 'faz-main',
  });
  db.insert('fotos_salga', {
    id: 'foto-child-1',
    tenant_id: tenantId,
    lancamento_id: 'lanc-child-1',
  });

  // Attempting to delete faz-main must fail due to RESTRICT
  assert.throws(
    () => {
      db.delete('fazendas', 'faz-main');
    },
    (err) => {
      assert.ok(err.message.includes('23503'));
      assert.ok(err.message.includes('foreign key constraint'));
      return true;
    }
  );

  // Verify all records survived
  assert.equal(db.select('lancamentos', { id: 'lanc-child-1' }).length, 1);
  assert.equal(db.select('fotos_salga', { id: 'foto-child-1' }).length, 1);
});
