/**
 * Challenger 2 Empirical Stress Test Suite - FASE 8
 * Tests:
 * 1. Referential integrity & FK rejection (23503 / isDependencyError) across 4-level visita topology
 * 2. Topological sort of mutations & deletion ordering
 * 3. ON DELETE CASCADE on fotos_salga vs parent data retention
 * 4. Strict TypeScript vs PostgreSQL type mappings & nullable boundaries
 * 5. Error classification edge cases
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateDdlScript } from '../qa/sql-ddl-validator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const typesTsPath = path.join(repoRoot, 'apps/web/src/integrations/supabase/types.ts');
const commandPolicyPath = path.join(repoRoot, 'apps/web/src/platform/offline/commandPolicy.ts');
const upMigrationPath = path.join(repoRoot, 'supabase/migrations/20261014000000_phase8_unified_relational_contracts.sql');
const queuePath = path.join(repoRoot, 'apps/api/src/modules/sync/domain/queue.ts');

// Pure domain logic mirror for testing
const SYNC_TABLE_PRIORITY = {
  visitas_tecnicas: 0,
  visita_pastos: 1,
  visita_currais: 1,
  visita_topicos: 1,
  avaliacoes_score: 2,
  avaliacoes_fabrica_quesito: 2,
  visita_fotos: 3,
  visita_topico_fotos: 3,
};
const SYNC_DEFAULT_TABLE_PRIORITY = 2;

function mutationRank(mutation) {
  const base = SYNC_TABLE_PRIORITY[mutation.table] ?? SYNC_DEFAULT_TABLE_PRIORITY;
  return (mutation.operation ?? "update") === "delete" ? base + 10 : base;
}

function sortSyncMutations(items) {
  return [...items].sort((a, b) => {
    const rank = mutationRank(a) - mutationRank(b);
    if (rank !== 0) return rank;
    return String(a.createdAt).localeCompare(String(b.createdAt));
  });
}

function isDependencyError(message) {
  const normalized = (message || "").toLowerCase();
  return (
    normalized.includes("foreign key") ||
    normalized.includes("fkey") ||
    normalized.includes("23503")
  );
}

function nextSyncFailureState(input) {
  const tries = input.tries ?? 0;
  const deferredRounds = input.deferredRounds ?? 0;
  if (isDependencyError(input.errorMessage)) {
    return {
      status: "pending",
      tries,
      deferredRounds: deferredRounds + 1,
      lastError: `aguardando sincronização do registro principal (${input.errorMessage})`,
    };
  }
  return {
    status: "error",
    tries: tries + 1,
    deferredRounds,
    lastError: input.errorMessage,
  };
}

// ============================================================================
// SIMULATION ENGINE FOR MULTI-LEVEL RELATIONAL TOPOLOGY
// ============================================================================
class MultiLevelRelationalEngine {
  constructor() {
    this.tables = new Map();
  }

  defineTable({ name, primaryKey = 'id', foreignKeys = [] }) {
    this.tables.set(name, {
      name,
      primaryKey,
      foreignKeys, // [{ column, targetTable, targetColumn, onDelete }]
      rows: new Map(),
    });
  }

  insert(tableName, row) {
    const table = this.tables.get(tableName);
    if (!table) throw new Error(`Table ${tableName} does not exist`);

    const pk = row[table.primaryKey];
    if (pk === undefined || pk === null) {
      throw new Error(`23502: null value in column "${table.primaryKey}" violates not-null constraint`);
    }
    if (table.rows.has(pk)) {
      throw new Error(`23505: duplicate key value violates unique constraint on primary key ${tableName}_pkey`);
    }

    // Verify all FK constraints
    for (const fk of table.foreignKeys) {
      const val = row[fk.column];
      if (val !== undefined && val !== null) {
        const target = this.tables.get(fk.targetTable);
        if (!target || !target.rows.has(val)) {
          throw new Error(
            `23503: insert or update on table "${tableName}" violates foreign key constraint "${fk.column}_fkey"`
          );
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

    // Check dependent children in other tables
    for (const other of this.tables.values()) {
      for (const fk of other.foreignKeys) {
        if (fk.targetTable === tableName) {
          for (const [childPk, childRow] of other.rows.entries()) {
            if (childRow[fk.column] === pk) {
              if (fk.onDelete === 'CASCADE') {
                this.delete(other.name, childPk); // Recursive cascade
              } else {
                throw new Error(
                  `23503: update or delete on table "${tableName}" violates foreign key constraint "${fk.column}_fkey" on table "${other.name}"`
                );
              }
            }
          }
        }
      }
    }

    return table.rows.delete(pk);
  }
}

function setupTopologyDatabase() {
  const db = new MultiLevelRelationalEngine();

  // Visita Topology (4 Levels)
  // Level 0: visitas_tecnicas
  db.defineTable({ name: 'visitas_tecnicas', primaryKey: 'id' });

  // Level 1: visita_pastos, visita_currais, visita_topicos
  db.defineTable({
    name: 'visita_pastos',
    primaryKey: 'id',
    foreignKeys: [{ column: 'visita_id', targetTable: 'visitas_tecnicas', onDelete: 'CASCADE' }],
  });
  db.defineTable({
    name: 'visita_currais',
    primaryKey: 'id',
    foreignKeys: [{ column: 'visita_id', targetTable: 'visitas_tecnicas', onDelete: 'CASCADE' }],
  });
  db.defineTable({
    name: 'visita_topicos',
    primaryKey: 'id',
    foreignKeys: [{ column: 'visita_id', targetTable: 'visitas_tecnicas', onDelete: 'CASCADE' }],
  });

  // Level 2: avaliacoes_score, avaliacoes_fabrica_quesito
  db.defineTable({
    name: 'avaliacoes_score',
    primaryKey: 'id',
    foreignKeys: [
      { column: 'visita_pasto_id', targetTable: 'visita_pastos', onDelete: 'CASCADE' },
      { column: 'visita_curral_id', targetTable: 'visita_currais', onDelete: 'CASCADE' },
    ],
  });

  // Level 3: visita_fotos, visita_topico_fotos
  db.defineTable({
    name: 'visita_fotos',
    primaryKey: 'id',
    foreignKeys: [
      { column: 'visita_pasto_id', targetTable: 'visita_pastos', onDelete: 'CASCADE' },
      { column: 'visita_curral_id', targetTable: 'visita_currais', onDelete: 'CASCADE' },
    ],
  });
  db.defineTable({
    name: 'visita_topico_fotos',
    primaryKey: 'id',
    foreignKeys: [
      { column: 'visita_topico_id', targetTable: 'visita_topicos', onDelete: 'CASCADE' },
    ],
  });

  // Capataz Topology: fazendas -> retiros -> pastos -> lancamentos (RESTRICT) -> fotos_salga (CASCADE)
  db.defineTable({ name: 'fazendas', primaryKey: 'id' });
  db.defineTable({
    name: 'retiros',
    primaryKey: 'id',
    foreignKeys: [{ column: 'fazenda_id', targetTable: 'fazendas', onDelete: 'CASCADE' }],
  });
  db.defineTable({
    name: 'pastos',
    primaryKey: 'id',
    foreignKeys: [
      { column: 'fazenda_id', targetTable: 'fazendas', onDelete: 'CASCADE' },
      { column: 'retiro_id', targetTable: 'retiros', onDelete: 'CASCADE' },
    ],
  });
  db.defineTable({
    name: 'lancamentos',
    primaryKey: 'id',
    foreignKeys: [
      { column: 'fazenda_id', targetTable: 'fazendas', onDelete: 'RESTRICT' },
      { column: 'retiro_id', targetTable: 'retiros', onDelete: 'RESTRICT' },
      { column: 'pasto_id', targetTable: 'pastos', onDelete: 'RESTRICT' },
    ],
  });
  db.defineTable({
    name: 'fotos_salga',
    primaryKey: 'id',
    foreignKeys: [
      { column: 'lancamento_id', targetTable: 'lancamentos', onDelete: 'CASCADE' },
      { column: 'fazenda_id', targetTable: 'fazendas', onDelete: 'RESTRICT' },
      { column: 'pasto_id', targetTable: 'pastos', onDelete: 'RESTRICT' },
    ],
  });

  return db;
}

// ============================================================================
// CHALLENGE 1: REFERENTIAL INTEGRITY, DEPENDENCY ERRORS & TOPOLOGY
// ============================================================================

test('Challenge 1.1: Rejects orphan Level 1 child without Level 0 parent with 23503', () => {
  const db = setupTopologyDatabase();

  assert.throws(
    () => {
      db.insert('visita_pastos', {
        id: 'pasto-orphan-1',
        visita_id: 'non-existent-visita-0',
      });
    },
    (err) => {
      assert.ok(err.message.includes('23503'));
      assert.ok(isDependencyError(err.message), 'isDependencyError must classify 23503 as true');
      return true;
    }
  );
});

test('Challenge 1.2: Rejects orphan Level 2 child without Level 1 parent with 23503', () => {
  const db = setupTopologyDatabase();

  assert.throws(
    () => {
      db.insert('avaliacoes_score', {
        id: 'score-orphan-1',
        visita_curral_id: 'non-existent-curral-1',
      });
    },
    (err) => {
      assert.ok(err.message.includes('23503'));
      assert.ok(isDependencyError(err.message), 'isDependencyError must classify 23503 as true');
      return true;
    }
  );
});

test('Challenge 1.3: Rejects orphan Level 3 photo without Level 1 parent with 23503', () => {
  const db = setupTopologyDatabase();

  assert.throws(
    () => {
      db.insert('visita_fotos', {
        id: 'foto-orphan-1',
        visita_pasto_id: 'non-existent-pasto-1',
      });
    },
    (err) => {
      assert.ok(err.message.includes('23503'));
      assert.ok(isDependencyError(err.message));
      return true;
    }
  );
});

test('Challenge 1.4: isDependencyError edge cases and pattern robustness', () => {
  // Test variations of PostgreSQL error strings
  const positiveCases = [
    '23503: foreign key constraint violation',
    'insert or update on table "visita_fotos" violates foreign key constraint "visita_fotos_visita_pasto_id_fkey"',
    'Key (visita_id)=(123) is not present in table "visitas_tecnicas", violates foreign key constraint',
    'violates foreign key constraint "avaliacoes_score_visita_curral_id_fkey"',
    'error: update or delete on table "fazendas" violates foreign key constraint on "lancamentos"',
    'duplicate key violates unique constraint "x_fkey"',
    '23503',
  ];

  for (const msg of positiveCases) {
    assert.equal(isDependencyError(msg), true, `Should detect as dependency error: "${msg}"`);
  }

  const negativeCases = [
    '23505: duplicate key value violates unique constraint',
    '42P01: relation "tabela_fantasma" does not exist',
    '23502: null value in column "id" violates not-null constraint',
    'permission denied for table atomic_command_log',
    'network timeout: 30000ms exceeded',
    '',
  ];

  for (const msg of negativeCases) {
    assert.equal(isDependencyError(msg), false, `Should NOT detect as dependency error: "${msg}"`);
  }
});

test('Challenge 1.5: nextSyncFailureState preserves attempts and defers on 23503', () => {
  // 1. Dependency error: should defer, NOT increment tries
  const deferredState = nextSyncFailureState({
    tries: 2,
    deferredRounds: 1,
    errorMessage: '23503: insert on table "visita_fotos" violates foreign key constraint "visita_fotos_visita_pasto_id_fkey"',
  });
  assert.equal(deferredState.status, 'pending');
  assert.equal(deferredState.tries, 2, 'tries must NOT be incremented on dependency error');
  assert.equal(deferredState.deferredRounds, 2, 'deferredRounds must increment');
  assert.ok(deferredState.lastError.includes('aguardando sincronização do registro principal'));

  // 2. Non-dependency error: should fail, consume attempt
  const errorState = nextSyncFailureState({
    tries: 2,
    deferredRounds: 1,
    errorMessage: '42501: permission denied for table lancamentos',
  });
  assert.equal(errorState.status, 'error');
  assert.equal(errorState.tries, 3, 'tries must increment on non-dependency error');
  assert.equal(errorState.deferredRounds, 1, 'deferredRounds must remain unchanged');
  assert.equal(errorState.lastError, '42501: permission denied for table lancamentos');
});

test('Challenge 1.6: sortSyncMutations strictly respects 4-level topological order', () => {
  const scrambledMutations = [
    { table: 'visita_fotos', createdAt: '2026-10-14T10:03:00Z', patch: { id: 'f1' } },
    { table: 'visitas_tecnicas', createdAt: '2026-10-14T10:00:00Z', patch: { id: 'v1' } },
    { table: 'avaliacoes_score', createdAt: '2026-10-14T10:02:00Z', patch: { id: 's1' } },
    { table: 'visita_pastos', createdAt: '2026-10-14T10:01:00Z', patch: { id: 'p1' } },
    { table: 'visita_topicos', createdAt: '2026-10-14T10:01:30Z', patch: { id: 't1' } },
    { table: 'visita_topico_fotos', createdAt: '2026-10-14T10:03:30Z', patch: { id: 'tf1' } },
  ];

  const sorted = sortSyncMutations(scrambledMutations);
  const tableOrder = sorted.map(m => m.table);

  assert.deepEqual(tableOrder, [
    'visitas_tecnicas',      // Priority 0
    'visita_pastos',         // Priority 1
    'visita_topicos',        // Priority 1 (sorted by createdAt)
    'avaliacoes_score',      // Priority 2
    'visita_fotos',          // Priority 3
    'visita_topico_fotos',   // Priority 3 (sorted by createdAt)
  ]);
});

// ============================================================================
// CHALLENGE 2: ON DELETE CASCADE IN fotos_salga VS PARENT DATA RETENTION
// ============================================================================

test('Challenge 2.1: Deleting lancamento cascades to all its fotos_salga', () => {
  const db = setupTopologyDatabase();

  // Setup hierarchy
  db.insert('fazendas', { id: 'faz-10' });
  db.insert('retiros', { id: 'ret-10', fazenda_id: 'faz-10' });
  db.insert('pastos', { id: 'pas-10', fazenda_id: 'faz-10', retiro_id: 'ret-10' });

  // Insert lancamento
  db.insert('lancamentos', {
    id: 'lanc-test-cascade',
    fazenda_id: 'faz-10',
    retiro_id: 'ret-10',
    pasto_id: 'pas-10',
    num_animais: 150,
  });

  // Insert 3 fotos_salga
  db.insert('fotos_salga', { id: 'f-1', lancamento_id: 'lanc-test-cascade', fazenda_id: 'faz-10', pasto_id: 'pas-10' });
  db.insert('fotos_salga', { id: 'f-2', lancamento_id: 'lanc-test-cascade', fazenda_id: 'faz-10', pasto_id: 'pas-10' });
  db.insert('fotos_salga', { id: 'f-3', lancamento_id: 'lanc-test-cascade', fazenda_id: 'faz-10', pasto_id: 'pas-10' });

  assert.equal(db.select('fotos_salga', { lancamento_id: 'lanc-test-cascade' }).length, 3);

  // Delete lancamento
  const deleted = db.delete('lancamentos', 'lanc-test-cascade');
  assert.equal(deleted, true);

  // All 3 child photos must be gone
  assert.equal(db.select('fotos_salga', { lancamento_id: 'lanc-test-cascade' }).length, 0);
  assert.equal(db.select('fotos_salga', { id: 'f-1' }).length, 0);
  assert.equal(db.select('fotos_salga', { id: 'f-2' }).length, 0);
  assert.equal(db.select('fotos_salga', { id: 'f-3' }).length, 0);
});

test('Challenge 2.2: Deleting child foto_salga DOES NOT delete or mutate parent lancamento', () => {
  const db = setupTopologyDatabase();

  db.insert('fazendas', { id: 'faz-20' });
  db.insert('retiros', { id: 'ret-20', fazenda_id: 'faz-20' });
  db.insert('pastos', { id: 'pas-20', fazenda_id: 'faz-20', retiro_id: 'ret-20' });

  db.insert('lancamentos', {
    id: 'lanc-retain-parent',
    fazenda_id: 'faz-20',
    retiro_id: 'ret-20',
    pasto_id: 'pas-20',
    num_animais: 99,
    num_sacos: 5,
    cocho_cheio: true,
  });

  db.insert('fotos_salga', {
    id: 'foto-standalone-del',
    lancamento_id: 'lanc-retain-parent',
    fazenda_id: 'faz-20',
    pasto_id: 'pas-20',
  });

  // Delete ONLY the photo
  const delPhoto = db.delete('fotos_salga', 'foto-standalone-del');
  assert.equal(delPhoto, true);

  // Parent lancamento must be completely retained with exact fields
  const parent = db.select('lancamentos', { id: 'lanc-retain-parent' });
  assert.equal(parent.length, 1);
  assert.equal(parent[0].num_animais, 99);
  assert.equal(parent[0].num_sacos, 5);
  assert.equal(parent[0].cocho_cheio, true);
});

test('Challenge 2.3: ON DELETE RESTRICT on pastos prevents deleting pasto while lancamentos exist', () => {
  const db = setupTopologyDatabase();

  db.insert('fazendas', { id: 'faz-30' });
  db.insert('retiros', { id: 'ret-30', fazenda_id: 'faz-30' });
  db.insert('pastos', { id: 'pas-30', fazenda_id: 'faz-30', retiro_id: 'ret-30' });

  db.insert('lancamentos', {
    id: 'lanc-block-pasto-del',
    fazenda_id: 'faz-30',
    retiro_id: 'ret-30',
    pasto_id: 'pas-30',
  });

  assert.throws(
    () => {
      db.delete('pastos', 'pas-30');
    },
    (err) => {
      assert.ok(err.message.includes('23503'));
      assert.ok(err.message.includes('foreign key constraint'));
      return true;
    }
  );

  // Verify pasto and lancamento still exist
  assert.equal(db.select('pastos', { id: 'pas-30' }).length, 1);
  assert.equal(db.select('lancamentos', { id: 'lanc-block-pasto-del' }).length, 1);
});

// ============================================================================
// CHALLENGE 3: STRICT TYPESCRIPT VS POSTGRESQL TYPES CORRESPONDENCE
// ============================================================================

test('Challenge 3.1: DDL data types match standard PostgreSQL type catalog', () => {
  const upSql = fs.readFileSync(upMigrationPath, 'utf8');
  const ddlResult = validateDdlScript(upSql);
  assert.equal(ddlResult.valid, true);

  const table = ddlResult.catalog.tables['public.atomic_command_log'];
  assert.ok(table);

  // Strict type definitions:
  assert.equal(table.columns['id'].dataType, 'uuid');
  assert.equal(table.columns['tenant_id'].dataType, 'uuid');
  assert.equal(table.columns['user_id'].dataType, 'uuid');
  assert.equal(table.columns['command_id'].dataType, 'uuid');
  assert.equal(table.columns['idempotency_key'].dataType, 'text');
  assert.equal(table.columns['kind'].dataType, 'text');
  assert.equal(table.columns['device_id'].dataType, 'text');
  assert.equal(table.columns['payload'].dataType, 'jsonb');
  assert.equal(table.columns['status'].dataType, 'text');
  assert.equal(table.columns['attempt_count'].dataType, 'integer');
  assert.equal(table.columns['created_at'].dataType, 'timestamp with time zone');
  assert.equal(table.columns['acknowledged_at'].dataType, 'timestamp with time zone');
  assert.equal(table.columns['server_applied_at'].dataType, 'timestamp with time zone');
  assert.equal(table.columns['error_detail'].dataType, 'text');
  assert.equal(table.columns['conflict_resolution'].dataType, 'jsonb');
});

test('Challenge 3.2: Nullability constraints in atomic_command_log enforce non-nullable core fields', () => {
  const upSql = fs.readFileSync(upMigrationPath, 'utf8');
  const ddlResult = validateDdlScript(upSql);
  const table = ddlResult.catalog.tables['public.atomic_command_log'];

  // Core immutable envelope fields must be NOT NULL
  const notNullFields = [
    'id',
    'tenant_id',
    'user_id',
    'device_id',
    'command_id',
    'idempotency_key',
    'kind',
    'payload',
    'status',
    'attempt_count',
    'created_at',
  ];

  for (const field of notNullFields) {
    assert.equal(table.columns[field].isNotNull, true, `Field ${field} must be NOT NULL`);
  }

  // Server projection/resolution fields must be nullable
  const nullableFields = [
    'acknowledged_at',
    'server_applied_at',
    'error_detail',
    'conflict_resolution',
  ];

  for (const field of nullableFields) {
    assert.equal(table.columns[field].isNotNull, false, `Field ${field} must be nullable`);
  }
});

test('Challenge 3.3: fotos_salga columns in types.ts match legacy storage expectations', () => {
  const typesContent = fs.readFileSync(typesTsPath, 'utf8');
  const match = typesContent.match(/\bfotos_salga:\s*\{[\s\S]*?Row:\s*\{([\s\S]*?)\}\s*Insert:/m);
  assert.ok(match, 'fotos_salga block must exist in types.ts');

  const row = match[1];
  assert.ok(row.includes('caminho: string'));
  assert.ok(row.includes('fazenda_id: string'));
  assert.ok(row.includes('lancamento_id: string'));
  assert.ok(row.includes('pasto_id: string'));
  assert.ok(row.includes('tipo: string'));
  assert.ok(row.includes('tamanho_bytes: number | null'));
  assert.ok(row.includes('tirada_em: string | null'));
  assert.ok(row.includes('enviado_por: string | null'));
});

// ============================================================================
// CHALLENGE 4: DELETION ORDERING & POST-CASCADE IDEMPOTENCY
// ============================================================================

test('Challenge 4.1: Parent deletion ranks before child deletion, necessitating CASCADE', () => {
  const parentDelete = { table: 'visitas_tecnicas', operation: 'delete', createdAt: '2026-10-14T10:00:00Z' };
  const childDelete = { table: 'visita_fotos', operation: 'delete', createdAt: '2026-10-14T10:00:00Z' };
  const parentCreate = { table: 'visitas_tecnicas', operation: 'insert', createdAt: '2026-10-14T10:00:00Z' };
  const childCreate = { table: 'visita_fotos', operation: 'insert', createdAt: '2026-10-14T10:00:00Z' };

  const sorted = sortSyncMutations([childDelete, parentDelete, childCreate, parentCreate]);

  // Assert creations first in dependency order (parent -> child), then deletions
  assert.deepEqual(
    sorted.map(m => `${m.table}:${m.operation}`),
    [
      'visitas_tecnicas:insert', // Rank 0
      'visita_fotos:insert',     // Rank 3
      'visitas_tecnicas:delete', // Rank 10 (0 + 10)
      'visita_fotos:delete',     // Rank 13 (3 + 10)
    ]
  );
});

test('Challenge 4.2: Post-cascade child deletion is safely idempotent (no error on absent child)', () => {
  const db = setupTopologyDatabase();

  db.insert('fazendas', { id: 'faz-99' });
  db.insert('lancamentos', { id: 'lanc-99', fazenda_id: 'faz-99' });
  db.insert('fotos_salga', { id: 'foto-99', lancamento_id: 'lanc-99', fazenda_id: 'faz-99' });

  // 1. Delete parent lancamento (cascades and deletes foto-99)
  const delParent = db.delete('lancamentos', 'lanc-99');
  assert.equal(delParent, true);
  assert.equal(db.select('fotos_salga', { id: 'foto-99' }).length, 0);

  // 2. Child deletion arrives later from queue (row already removed by cascade)
  // Idempotent deletion must return false (0 rows affected) without throwing error
  const delChildAfterCascade = db.delete('fotos_salga', 'foto-99');
  assert.equal(delChildAfterCascade, false, 'Redundant child delete must be a safe no-op');
});

test('Challenge 4.3: queue.ts source code matches topological priorities verbatim', () => {
  const queueSrc = fs.readFileSync(queuePath, 'utf8');

  // Verify priority block
  assert.ok(queueSrc.includes('visitas_tecnicas: 0'));
  assert.ok(queueSrc.includes('visita_pastos: 1'));
  assert.ok(queueSrc.includes('visita_currais: 1'));
  assert.ok(queueSrc.includes('visita_topicos: 1'));
  assert.ok(queueSrc.includes('avaliacoes_score: 2'));
  assert.ok(queueSrc.includes('avaliacoes_fabrica_quesito: 2'));
  assert.ok(queueSrc.includes('visita_fotos: 3'));
  assert.ok(queueSrc.includes('visita_topico_fotos: 3'));

  // Verify dependency error detection
  assert.ok(queueSrc.includes('normalized.includes("foreign key")'));
  assert.ok(queueSrc.includes('normalized.includes("fkey")'));
  assert.ok(queueSrc.includes('normalized.includes("23503")'));
});

