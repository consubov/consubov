/**
 * Phase 8 Relational Simulation, Referential Integrity & Multi-Tenant RLS Dry-Run
 * Simulates in-memory relational database operations, foreign key integrity checks,
 * idempotency constraints, and Row Level Security (RLS) isolation with tenant contexts.
 * Hermetic execution: zero external network or database connection.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * In-memory relational dry-run database engine
 */
class InMemoryRelationalEngine {
  constructor() {
    this.tables = new Map();
    this.session = {
      tenantId: null,
      userId: null,
      role: 'authenticated',
    };
  }

  setSession(tenantId, userId, role = 'authenticated') {
    this.session = { tenantId, userId, role };
  }

  defineTable({ name, primaryKey = 'id', foreignKeys = [], uniqueIndexes = [], rls = false }) {
    this.tables.set(name, {
      name,
      primaryKey,
      foreignKeys, // [{ column, targetTable, targetColumn, onDelete }]
      uniqueIndexes, // [ [col1, col2] ]
      rls,
      rows: new Map(), // pk -> row
    });
  }

  insert(tableName, row) {
    const table = this.tables.get(tableName);
    if (!table) throw new Error(`Table ${tableName} does not exist`);

    // 1. Evaluate RLS WITH CHECK policy
    if (table.rls) {
      if (row.tenant_id && this.session.tenantId && row.tenant_id !== this.session.tenantId) {
        throw new Error(`RLS WITH CHECK violation: row tenant_id ${row.tenant_id} does not match session tenant_id ${this.session.tenantId}`);
      }
    }

    // 2. Evaluate Primary Key uniqueness
    const pkValue = row[table.primaryKey];
    if (pkValue === undefined || pkValue === null) {
      throw new Error(`Primary key ${table.primaryKey} cannot be null on table ${tableName}`);
    }
    if (table.rows.has(pkValue)) {
      throw new Error(`23505: duplicate key value violates unique constraint on primary key ${tableName}_pkey`);
    }

    // 3. Evaluate Unique Indexes (e.g. [tenant_id, idempotency_key])
    for (const cols of table.uniqueIndexes) {
      for (const existing of table.rows.values()) {
        const matches = cols.every(col => existing[col] === row[col]);
        if (matches) {
          throw new Error(`23505: duplicate key value violates unique index on ${cols.join(', ')}`);
        }
      }
    }

    // 4. Evaluate Foreign Key constraints
    for (const fk of table.foreignKeys) {
      const val = row[fk.column];
      if (val !== undefined && val !== null) {
        const targetTable = this.tables.get(fk.targetTable);
        if (!targetTable) throw new Error(`Target table ${fk.targetTable} not found`);
        const targetRow = targetTable.rows.get(val);
        if (!targetRow) {
          throw new Error(`23503: insert or update on table "${tableName}" violates foreign key constraint "${fk.column}_fkey"`);
        }
      }
    }

    table.rows.set(pkValue, { ...row });
    return { ...row };
  }

  select(tableName, filter = {}) {
    const table = this.tables.get(tableName);
    if (!table) throw new Error(`Table ${tableName} does not exist`);

    const results = [];
    for (const row of table.rows.values()) {
      // 1. Evaluate RLS USING policy
      if (table.rls && this.session.tenantId) {
        if (row.tenant_id && row.tenant_id !== this.session.tenantId) {
          continue; // Hidden by RLS tenant policy
        }
      }

      // 2. Evaluate filter predicates
      const matches = Object.entries(filter).every(([k, v]) => row[k] === v);
      if (matches) {
        results.push({ ...row });
      }
    }
    return results;
  }

  delete(tableName, pkValue) {
    const table = this.tables.get(tableName);
    if (!table) throw new Error(`Table ${tableName} does not exist`);
    const existing = table.rows.get(pkValue);
    if (!existing) return false;

    // Check cascading deletes or restrict on child tables
    for (const otherTable of this.tables.values()) {
      for (const fk of otherTable.foreignKeys) {
        if (fk.targetTable === tableName) {
          for (const [childPk, childRow] of otherTable.rows.entries()) {
            if (childRow[fk.column] === pkValue) {
              if (fk.onDelete === 'CASCADE') {
                otherTable.rows.delete(childPk);
              } else {
                throw new Error(`23503: update or delete on table "${tableName}" violates foreign key constraint on "${otherTable.name}"`);
              }
            }
          }
        }
      }
    }

    return table.rows.delete(pkValue);
  }
}

function setupDryRunDatabase() {
  const db = new InMemoryRelationalEngine();

  // 1. Fazendas & Hierarquia
  db.defineTable({ name: 'fazendas', primaryKey: 'id', rls: false });
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

  // 2. Capataz Lançamentos e Fotos
  db.defineTable({
    name: 'lancamentos',
    primaryKey: 'id',
    foreignKeys: [
      { column: 'fazenda_id', targetTable: 'fazendas', onDelete: 'RESTRICT' },
      { column: 'retiro_id', targetTable: 'retiros', onDelete: 'RESTRICT' },
      { column: 'pasto_id', targetTable: 'pastos', onDelete: 'RESTRICT' },
    ],
    rls: true,
  });

  db.defineTable({
    name: 'fotos_salga',
    primaryKey: 'id',
    foreignKeys: [
      { column: 'lancamento_id', targetTable: 'lancamentos', onDelete: 'CASCADE' },
      { column: 'fazenda_id', targetTable: 'fazendas', onDelete: 'RESTRICT' },
      { column: 'pasto_id', targetTable: 'pastos', onDelete: 'RESTRICT' },
    ],
    rls: true,
  });

  // 3. Pesagens
  db.defineTable({
    name: 'pesagens',
    primaryKey: 'id',
    rls: true,
  });

  // 4. Balancão Pecuarista
  db.defineTable({
    name: 'pesagens_lote_pecuarista',
    primaryKey: 'id',
    rls: true,
  });
  db.defineTable({
    name: 'leituras_balancao_pecuarista',
    primaryKey: 'id',
    foreignKeys: [{ column: 'pesagem_lote_id', targetTable: 'pesagens_lote_pecuarista', onDelete: 'CASCADE' }],
    rls: true,
  });

  // 5. Canonical Atomic Command Log
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

test('Referential integrity: rejects child record with non-existent foreign key (Error 23503)', () => {
  const db = setupDryRunDatabase();
  const tenantId = '00000000-0000-4000-8000-000000000001';
  db.setSession(tenantId, 'user-1');

  // Attempt to insert a foto_salga referencing non-existent lancamento_id
  assert.throws(
    () => {
      db.insert('fotos_salga', {
        id: 'foto-orphan-1',
        tenant_id: tenantId,
        lancamento_id: 'non-existent-lancamento-id',
        fazenda_id: 'faz-1',
        pasto_id: 'pas-1',
        caminho: '/photos/orphan.jpg',
        tipo: 'cocho',
      });
    },
    (err) => {
      assert.ok(err.message.includes('23503'), 'Must contain PostgreSQL error code 23503');
      assert.ok(err.message.includes('foreign key constraint'), 'Must mention foreign key constraint');
      return true;
    }
  );
});

test('Referential integrity: accepts child when parent hierarchy is valid and cascades on delete', () => {
  const db = setupDryRunDatabase();
  const tenantId = '00000000-0000-4000-8000-000000000001';
  db.setSession(tenantId, 'user-1');

  // 1. Seed hierarchy
  db.insert('fazendas', { id: 'faz-1', nome: 'Fazenda Santa Maria' });
  db.insert('retiros', { id: 'ret-1', fazenda_id: 'faz-1', nome: 'Retiro Sede' });
  db.insert('pastos', { id: 'pas-1', fazenda_id: 'faz-1', retiro_id: 'ret-1', nome: 'Pasto 01' });

  // 2. Insert valid lancamento
  const lanc = db.insert('lancamentos', {
    id: 'lanc-100',
    tenant_id: tenantId,
    fazenda_id: 'faz-1',
    retiro_id: 'ret-1',
    pasto_id: 'pas-1',
    num_animais: 85,
    num_sacos: 4,
    cocho_cheio: false,
    origem: 'app_capataz',
    dias_no_pasto: 12,
  });
  assert.equal(lanc.id, 'lanc-100');

  // 3. Insert valid child foto_salga
  const foto = db.insert('fotos_salga', {
    id: 'foto-100',
    tenant_id: tenantId,
    lancamento_id: 'lanc-100',
    fazenda_id: 'faz-1',
    pasto_id: 'pas-1',
    caminho: '/photos/cocho-100.jpg',
    tipo: 'cocho',
  });
  assert.equal(foto.id, 'foto-100');

  // 4. Verify selection
  const retrievedFotos = db.select('fotos_salga', { lancamento_id: 'lanc-100' });
  assert.equal(retrievedFotos.length, 1);
  assert.equal(retrievedFotos[0].caminho, '/photos/cocho-100.jpg');

  // 5. Test ON DELETE CASCADE
  db.delete('lancamentos', 'lanc-100');
  const photosAfterCascade = db.select('fotos_salga', { id: 'foto-100' });
  assert.equal(photosAfterCascade.length, 0, 'Child photo should be deleted via CASCADE');
});

test('Idempotency constraint: rejects duplicate idempotency_key for the same tenant', () => {
  const db = setupDryRunDatabase();
  const tenantId = '00000000-0000-4000-8000-000000000001';
  db.setSession(tenantId, 'user-1');

  const idempotencyKey = 'urn:consubov:capataz:lancamento:local-uuid-999';

  // First insertion succeeds
  db.insert('atomic_command_log', {
    id: 'cmd-row-1',
    tenant_id: tenantId,
    user_id: 'user-1',
    device_id: 'dev-chrome-01',
    command_id: 'cmd-uuid-001',
    idempotency_key: idempotencyKey,
    kind: 'capataz_lancamento',
    payload: { num_animais: 50 },
    status: 'pending',
    attempt_count: 0,
  });

  // Second insertion with identical (tenant_id, idempotency_key) must fail with 23505
  assert.throws(
    () => {
      db.insert('atomic_command_log', {
        id: 'cmd-row-2',
        tenant_id: tenantId,
        user_id: 'user-1',
        device_id: 'dev-chrome-01',
        command_id: 'cmd-uuid-002', // different command_id, same idempotencyKey
        idempotency_key: idempotencyKey,
        kind: 'capataz_lancamento',
        payload: { num_animais: 50 },
        status: 'pending',
        attempt_count: 1,
      });
    },
    (err) => {
      assert.ok(err.message.includes('23505'), 'Must raise 23505 unique violation');
      assert.ok(err.message.includes('idempotency_key'));
      return true;
    }
  );
});

test('Multi-tenant isolation: Tenant A cannot view Tenant B records', () => {
  const db = setupDryRunDatabase();
  const tenantA = '11111111-1111-4111-8111-111111111111';
  const tenantB = '22222222-2222-4222-8222-222222222222';

  // Seed Tenant A commands
  db.setSession(tenantA, 'user-a');
  db.insert('atomic_command_log', {
    id: 'cmd-a-1',
    tenant_id: tenantA,
    user_id: 'user-a',
    device_id: 'dev-a',
    command_id: 'cmd-id-a1',
    idempotency_key: 'urn:consubov:tenantA:cmd1',
    kind: 'capataz_pesagem',
    payload: { total_pesado: 1200 },
    status: 'pending',
    attempt_count: 0,
  });

  // Seed Tenant B commands
  db.setSession(tenantB, 'user-b');
  db.insert('atomic_command_log', {
    id: 'cmd-b-1',
    tenant_id: tenantB,
    user_id: 'user-b',
    device_id: 'dev-b',
    command_id: 'cmd-id-b1',
    idempotency_key: 'urn:consubov:tenantB:cmd1',
    kind: 'capataz_pesagem',
    payload: { total_pesado: 3400 },
    status: 'pending',
    attempt_count: 0,
  });

  // Query as Tenant A
  db.setSession(tenantA, 'user-a');
  const rowsA = db.select('atomic_command_log');
  assert.equal(rowsA.length, 1);
  assert.equal(rowsA[0].id, 'cmd-a-1');
  assert.equal(rowsA[0].tenant_id, tenantA);

  // Query as Tenant B
  db.setSession(tenantB, 'user-b');
  const rowsB = db.select('atomic_command_log');
  assert.equal(rowsB.length, 1);
  assert.equal(rowsB[0].id, 'cmd-b-1');
  assert.equal(rowsB[0].tenant_id, tenantB);
});

test('Multi-tenant security: RLS WITH CHECK prevents cross-tenant data insertion', () => {
  const db = setupDryRunDatabase();
  const tenantA = '11111111-1111-4111-8111-111111111111';
  const tenantB = '22222222-2222-4222-8222-222222222222';

  // Session authenticated as Tenant A
  db.setSession(tenantA, 'user-a');

  // Attempting to insert a row with tenant_id = Tenant B must throw an RLS WITH CHECK error
  assert.throws(
    () => {
      db.insert('atomic_command_log', {
        id: 'exploit-cmd-1',
        tenant_id: tenantB, // forged tenant
        user_id: 'user-a',
        device_id: 'dev-attacker',
        command_id: 'cmd-exploit-1',
        idempotency_key: 'urn:consubov:attack:1',
        kind: 'capataz_lancamento',
        payload: { malicious: true },
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

test('Balancão Pecuarista and Mais-Arrobas readings maintain relational integrity', () => {
  const db = setupDryRunDatabase();
  const tenantId = '11111111-1111-4111-8111-111111111111';
  db.setSession(tenantId, 'user-pecuaria');

  // Insert parent pesagem de lote
  const lote = db.insert('pesagens_lote_pecuarista', {
    id: 'lote-101',
    tenant_id: tenantId,
    nome: 'Lote Nelore Machos 2026',
    data: '2026-10-14',
  });
  assert.equal(lote.id, 'lote-101');

  // Insert readings
  const r1 = db.insert('leituras_balancao_pecuarista', {
    id: 'leitura-1',
    pesagem_lote_id: 'lote-101',
    tenant_id: tenantId,
    ordem: 1,
    quantidade_animais: 5,
    peso_total: 2150,
    peso_individual: 430,
  });
  assert.equal(r1.ordem, 1);

  const r2 = db.insert('leituras_balancao_pecuarista', {
    id: 'leitura-2',
    pesagem_lote_id: 'lote-101',
    tenant_id: tenantId,
    ordem: 2,
    quantidade_animais: 4,
    peso_total: 1760,
    peso_individual: 440,
  });
  assert.equal(r2.ordem, 2);

  const readings = db.select('leituras_balancao_pecuarista', { pesagem_lote_id: 'lote-101' });
  assert.equal(readings.length, 2);
});
