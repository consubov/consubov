/**
 * Phase 8 Schema & DDL Integrity Test Suite
 * Validates PostgreSQL DDL syntax, type safety, primary keys, unique constraints,
 * indexes, Row Level Security (RLS) policies and cryptographic idempotency.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  splitStatements,
  validateDdlScript,
  parseColumnDef,
  VALID_PG_TYPES,
} from '../qa/sql-ddl-validator.mjs';
import { runIdempotencyCycle } from '../qa/migration-idempotency-runner.mjs';

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

test('UP migration file exists and is readable', () => {
  assert.ok(fs.existsSync(upMigrationPath), 'UP migration file must exist');
  const content = fs.readFileSync(upMigrationPath, 'utf8');
  assert.ok(content.length > 50, 'UP migration file must not be empty');
});

test('DOWN migration file exists and is readable', () => {
  assert.ok(fs.existsSync(downMigrationPath), 'DOWN migration file must exist');
  const content = fs.readFileSync(downMigrationPath, 'utf8');
  assert.ok(content.length > 50, 'DOWN migration file must not be empty');
});

test('SQL statement splitter strips comments and handles quoted semicolons', () => {
  const sql = `
    -- Single line comment
    CREATE TABLE test_tab (
      id UUID PRIMARY KEY,
      note TEXT DEFAULT 'hello; world' /* inline block */
    );
    /* Multi-line
       block comment */
    CREATE INDEX idx_test ON test_tab (id);
  `;
  const stmts = splitStatements(sql);
  assert.equal(stmts.length, 2);
  assert.ok(stmts[0].startsWith('CREATE TABLE test_tab'));
  assert.ok(stmts[1].startsWith('CREATE INDEX idx_test'));
});

test('parseColumnDef correctly parses column types and constraints', () => {
  const col1 = parseColumnDef('id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY');
  assert.equal(col1.name, 'id');
  assert.equal(col1.dataType, 'uuid');
  assert.equal(col1.isNotNull, true);
  assert.equal(col1.isPrimaryKey, true);

  const col2 = parseColumnDef('created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()');
  assert.equal(col2.name, 'created_at');
  assert.equal(col2.dataType, 'timestamp with time zone');
  assert.equal(col2.isNotNull, true);

  const col3 = parseColumnDef('payload JSONB NOT NULL DEFAULT \'{}\'::jsonb');
  assert.equal(col3.name, 'payload');
  assert.equal(col3.dataType, 'jsonb');

  const col4 = parseColumnDef('attempt_count INTEGER NOT NULL DEFAULT 0');
  assert.equal(col4.name, 'attempt_count');
  assert.equal(col4.dataType, 'integer');
});

test('UP migration passes static DDL validation with zero errors', () => {
  const upSql = fs.readFileSync(upMigrationPath, 'utf8');
  const result = validateDdlScript(upSql);

  assert.equal(result.valid, true, `Validation failed: ${result.errors.join('; ')}`);
  assert.equal(result.errors.length, 0);
  assert.ok(result.statementsCount >= 8, 'Expected at least 8 DDL statements');
});

test('UP migration creates public.atomic_command_log with correct schema', () => {
  const upSql = fs.readFileSync(upMigrationPath, 'utf8');
  const result = validateDdlScript(upSql);
  const table = result.catalog.tables['public.atomic_command_log'];

  assert.ok(table, 'public.atomic_command_log must be present in catalog');
  assert.deepEqual(table.primaryKeys, ['id']);

  const requiredColumns = [
    ['id', 'uuid'],
    ['tenant_id', 'uuid'],
    ['user_id', 'uuid'],
    ['device_id', 'text'],
    ['command_id', 'uuid'],
    ['idempotency_key', 'text'],
    ['kind', 'text'],
    ['payload', 'jsonb'],
    ['status', 'text'],
    ['attempt_count', 'integer'],
    ['created_at', 'timestamp with time zone'],
    ['acknowledged_at', 'timestamp with time zone'],
    ['server_applied_at', 'timestamp with time zone'],
    ['error_detail', 'text'],
    ['conflict_resolution', 'jsonb'],
  ];

  for (const [colName, expectedType] of requiredColumns) {
    const col = table.columns[colName];
    assert.ok(col, `Column "${colName}" must exist on atomic_command_log`);
    assert.equal(
      col.dataType,
      expectedType,
      `Column "${colName}" type must be ${expectedType}, found ${col.dataType}`
    );
  }
});

test('UP migration defines required unique idempotency constraints and indexes', () => {
  const upSql = fs.readFileSync(upMigrationPath, 'utf8');
  const result = validateDdlScript(upSql);
  const indexes = result.catalog.indexes;

  // Uniqueness indexes
  const uqIdempotency = indexes['uq_atomic_commands_tenant_idempotency'];
  assert.ok(uqIdempotency, 'uq_atomic_commands_tenant_idempotency index must exist');
  assert.equal(uqIdempotency.isUnique, true);
  assert.deepEqual(uqIdempotency.columns, ['tenant_id', 'idempotency_key']);

  const uqCommand = indexes['uq_atomic_commands_tenant_command'];
  assert.ok(uqCommand, 'uq_atomic_commands_tenant_command index must exist');
  assert.equal(uqCommand.isUnique, true);
  assert.deepEqual(uqCommand.columns, ['tenant_id', 'command_id']);

  // Performance query indexes
  const idxStatus = indexes['idx_atomic_commands_tenant_status'];
  assert.ok(idxStatus, 'idx_atomic_commands_tenant_status index must exist');
  assert.deepEqual(idxStatus.columns, ['tenant_id', 'status', 'created_at']);

  const idxUser = indexes['idx_atomic_commands_user'];
  assert.ok(idxUser, 'idx_atomic_commands_user index must exist');
  assert.deepEqual(idxUser.columns, ['user_id', 'created_at']);

  const idxKind = indexes['idx_atomic_commands_kind'];
  assert.ok(idxKind, 'idx_atomic_commands_kind index must exist');
  assert.deepEqual(idxKind.columns, ['tenant_id', 'kind']);
});

test('UP migration enables Row Level Security and defines tenant & user policies', () => {
  const upSql = fs.readFileSync(upMigrationPath, 'utf8');
  const result = validateDdlScript(upSql);
  const table = result.catalog.tables['public.atomic_command_log'];
  assert.equal(table.rlsEnabled, true, 'Row Level Security must be enabled');

  const policies = result.catalog.policies['public.atomic_command_log'];
  assert.ok(policies, 'Policies must be defined for atomic_command_log');

  assert.equal(policies['tenant_isolation_atomic_command_log'], undefined,
    'A permissive tenant-only policy would bypass the user-level RLS check');
  assert.equal(Object.keys(policies).length, 1,
    'The table must have only one permissive policy with tenant and user checks');

  const userPolicy = policies['user_access_atomic_command_log'];
  assert.ok(userPolicy, 'user_access_atomic_command_log must exist');
  assert.ok(
    userPolicy.using.includes('user_id = auth.uid()'),
    'User policy must check user_id = auth.uid()'
  );
  assert.ok(userPolicy.using.includes('app.current_tenant_id'));
  assert.ok(userPolicy.withCheck?.includes('user_id = auth.uid()'),
    'INSERT/UPDATE checks must require the current user');
  assert.ok(userPolicy.withCheck?.includes('app.current_tenant_id'));
});

test('DOWN migration cleans up all created tables, indexes, and policies', () => {
  const upSql = fs.readFileSync(upMigrationPath, 'utf8');
  const downSql = fs.readFileSync(downMigrationPath, 'utf8');

  const cycle = runIdempotencyCycle(upSql, downSql);
  assert.equal(cycle.isReversible, true, 'Rollback must return catalog to exact baseline hash');
  assert.equal(cycle.hashes.state0_baseline, cycle.hashes.state3_down_rollback);
});

test('Migration cycle verifies 100% cryptographic idempotency and determinism', () => {
  const upSql = fs.readFileSync(upMigrationPath, 'utf8');
  const downSql = fs.readFileSync(downMigrationPath, 'utf8');

  const cycle = runIdempotencyCycle(upSql, downSql);
  assert.equal(cycle.passed, true);
  assert.equal(cycle.isIdempotent, true, 'UP applied twice must yield identical catalog hash');
  assert.equal(cycle.isDeterministic, true, 'UP reapplied after rollback must match original UP hash');
  assert.equal(cycle.hashes.state1_up, cycle.hashes.state2_up_reapply);
  assert.equal(cycle.hashes.state1_up, cycle.hashes.state4_up_reapplied);
});

test('Validator rejects tables missing a primary key constraint', () => {
  const badSql = `
    CREATE TABLE public.orphan_table (
      note TEXT NOT NULL,
      num INTEGER
    );
  `;
  const result = validateDdlScript(badSql);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(err => err.includes('lacks a PRIMARY KEY')));
});

test('Validator rejects columns with unsupported or invalid PostgreSQL data types', () => {
  const badSql = `
    CREATE TABLE public.bad_type_tab (
      id UUID PRIMARY KEY,
      invalid_data imaginary_super_type
    );
  `;
  const result = validateDdlScript(badSql);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(err => err.includes('invalid PostgreSQL type')));
});
