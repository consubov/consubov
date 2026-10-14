/**
 * PostgreSQL Migration Idempotency and Reversibility Runner (Local Dry-Run)
 * Executes the full deterministic migration lifecycle:
 *   State 0 (Baseline) -> State 1 (UP) -> State 2 (UP Idempotent) -> State 3 (DOWN) -> State 4 (UP Reapplied)
 * Compares cryptographic SHA-256 signatures of the resulting schema catalogs:
 *   1. Idempotency:   hash(State 1) === hash(State 2)
 *   2. Reversibility: hash(State 3) === hash(State 0) [Zero residue]
 *   3. Determinism:   hash(State 4) === hash(State 1)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { splitStatements, buildSchemaCatalog, validateCatalogIntegrity } from './sql-ddl-validator.mjs';

/**
 * Produces a stable, deterministic SHA-256 signature for a schema catalog.
 */
export function computeCatalogHash(catalog) {
  // Deep sort all keys and arrays for deterministic JSON serialization
  const canonicalize = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return [...obj].sort().map(canonicalize);
    }
    const sorted = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = canonicalize(obj[key]);
    }
    return sorted;
  };

  const canonical = canonicalize({
    tables: catalog.tables || {},
    indexes: catalog.indexes || {},
    policies: catalog.policies || {},
  });

  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

/**
 * Runs the full UP -> UP -> DOWN -> UP verification cycle on SQL strings.
 */
export function runIdempotencyCycle(upSql, downSql, initialCatalog = { tables: {}, indexes: {}, policies: {} }) {
  const upStatements = splitStatements(upSql);
  const downStatements = splitStatements(downSql);

  // State 0: Baseline
  const catalog0 = JSON.parse(JSON.stringify(initialCatalog));
  const hash0 = computeCatalogHash(catalog0);

  // State 1: Apply UP first time
  const step1 = buildSchemaCatalog(upStatements, catalog0);
  const catalog1 = step1.catalog;
  const hash1 = computeCatalogHash(catalog1);
  const val1 = validateCatalogIntegrity(catalog1);

  // State 2: Apply UP second time (Idempotency check)
  const step2 = buildSchemaCatalog(upStatements, catalog1);
  const catalog2 = step2.catalog;
  const hash2 = computeCatalogHash(catalog2);

  // State 3: Apply DOWN (Rollback / Reversibility check)
  const step3 = buildSchemaCatalog(downStatements, catalog2);
  const catalog3 = step3.catalog;
  const hash3 = computeCatalogHash(catalog3);

  // State 4: Apply UP again after rollback (Determinism check)
  const step4 = buildSchemaCatalog(upStatements, catalog3);
  const catalog4 = step4.catalog;
  const hash4 = computeCatalogHash(catalog4);

  const isIdempotent = hash1 === hash2;
  const isReversible = hash0 === hash3;
  const isDeterministic = hash1 === hash4;
  const passed = isIdempotent && isReversible && isDeterministic && val1.errors.length === 0;

  return {
    passed,
    isIdempotent,
    isReversible,
    isDeterministic,
    integrityErrors: val1.errors,
    hashes: {
      state0_baseline: hash0,
      state1_up: hash1,
      state2_up_reapply: hash2,
      state3_down_rollback: hash3,
      state4_up_reapplied: hash4,
    },
    tablesCount: Object.keys(catalog1.tables).length,
    indexesCount: Object.keys(catalog1.indexes).length,
    policiesCount: Object.values(catalog1.policies).reduce((acc, p) => acc + Object.keys(p).length, 0),
  };
}

/**
 * Runs the cycle from file paths.
 */
export function runMigrationIdempotencyFiles(upPath, downPath) {
  const upSql = fs.readFileSync(path.resolve(process.cwd(), upPath), 'utf8');
  const downSql = fs.readFileSync(path.resolve(process.cwd(), downPath), 'utf8');
  return runIdempotencyCycle(upSql, downSql);
}

/**
 * CLI execution entrypoint
 */
if (process.argv[1] && process.argv[1].endsWith('migration-idempotency-runner.mjs')) {
  const upFile = process.argv[2];
  const downFile = process.argv[3];

  if (!upFile || !downFile) {
    console.error('Usage: node scripts/qa/migration-idempotency-runner.mjs <up_migration.sql> <down_migration.sql>');
    process.exit(2);
  }

  const result = runMigrationIdempotencyFiles(upFile, downFile);

  console.log(`[migration-idempotency-runner] Testing: ${upFile} <-> ${downFile}`);
  console.log(`[migration-idempotency-runner] State 0 (Baseline):       ${result.hashes.state0_baseline}`);
  console.log(`[migration-idempotency-runner] State 1 (UP Applied):     ${result.hashes.state1_up}`);
  console.log(`[migration-idempotency-runner] State 2 (UP Re-applied):  ${result.hashes.state2_up_reapply}`);
  console.log(`[migration-idempotency-runner] State 3 (DOWN Rollback):  ${result.hashes.state3_down_rollback}`);
  console.log(`[migration-idempotency-runner] State 4 (UP Restored):    ${result.hashes.state4_up_reapplied}`);

  console.log(`[migration-idempotency-runner] Checks:`);
  console.log(`  - Idempotency (State 1 == State 2):   ${result.isIdempotent ? 'PASS' : 'FAIL'}`);
  console.log(`  - Reversibility (State 3 == State 0): ${result.isReversible ? 'PASS' : 'FAIL'}`);
  console.log(`  - Determinism (State 1 == State 4):   ${result.isDeterministic ? 'PASS' : 'FAIL'}`);

  if (result.integrityErrors.length > 0) {
    console.error('[migration-idempotency-runner] Schema Integrity Errors:');
    result.integrityErrors.forEach(err => console.error(`  - ${err}`));
  }

  if (!result.passed) {
    console.error('[migration-idempotency-runner] FAIL: Migration cycle failed idempotency or reversibility invariants.');
    process.exit(1);
  }

  console.log('[migration-idempotency-runner] PASS: 100% idempotent, reversible and deterministic migration cycle.');
  process.exit(0);
}
